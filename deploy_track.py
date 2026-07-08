#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""단일 안전 배포 도구 — 트랙 격리를 '구조적으로' 강제 (2026-07-07)
================================================================
근본 해결: 배포가 로컬 전체트리를 스냅샷하지 않는다. 항상 '라이브 매니페스트에서
시작해 한 트랙 파일만 오버레이'하고, 그 트랙 경로 밖은 sha 불변을 하드게이트로 강제.
→ 로컬 트리가 어긋나도·스크립트를 잘못 골라도 다른 트랙을 건드리는 게 불가능.

원칙(교수 지시 2026-07-07 '4트랙 절대 격리'):
  - 한 배포 = 한 트랙 = 그 트랙 라이브 경로만. 전체트리 배포 없음.
  - 배포 전 격리검사(check_track_isolation·check_system_isolation) 의무 통과.
  - 삭제 불가능(라이브 파일은 전부 유지, 트랙 파일만 add/update).

사용:
  python3 deploy_track.py <track> [--scope <subpath>]        # 드라이런(기본·배포 안 함)
  python3 deploy_track.py <track> [--scope <subpath>] --deploy
  python3 deploy_track.py --list
예:
  python3 deploy_track.py pitching/theia --scope korea          # 드라이런
  python3 deploy_track.py pitching/theia --scope korea --deploy # 실제 배포
트랙: pitching/theia · pitching/uplift · pitching/imu · batting/theia · batting/uplift · batting/imu
"""
import os, re, sys, json, time, hashlib, unicodedata, subprocess, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
NETLIFY = "netlify_통합배포"
TRACKS = {
    "pitching/theia":  "/pitching/theia/",
    "pitching/uplift": "/pitching/uplift/",
    "pitching/imu":    "/pitching/imu/",
    "batting/theia":   "/batting/theia/",
    "batting/uplift":  "/batting/uplift/",
    "batting/imu":     "/batting/imu/",
}
# 토큰 위치 후보(레포 밖·메인 플랫폼 레포 소유). 값은 절대 출력 안 함.
# 머신마다 메인 레포명이 다름: biomotion-platform(원본) · biomotion-dashboard(SamsungSSD 체크아웃).
# 네 트랙 모두 동일 Netlify 사이트라 형제 피칭 레포의 conf도 같은 SITE_ID(백업 후보).
CONF_CANDS = [
    os.path.join(os.path.dirname(ROOT), "biomotion-platform", ".netlify_deploy.conf"),
    os.path.join(os.path.dirname(ROOT), "biomotion-dashboard", ".netlify_deploy.conf"),
    "/Users/biomotion/Projects/biomotion-platform/.netlify_deploy.conf",
    os.path.join(ROOT, ".netlify_deploy.conf"),
    os.path.join(os.path.dirname(ROOT), "biomotion-dashboard-uplift-pitching", ".netlify_deploy.conf"),
]

def nfc(s): return unicodedata.normalize("NFC", s)
def sha1(p):
    h = hashlib.sha1()
    with open(p, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""): h.update(ch)
    return h.hexdigest()

def load_conf():
    for c in CONF_CANDS:
        if os.path.isfile(c):
            t = open(c).read()
            return re.search(r"NETLIFY_TOKEN=(\S+)", t).group(1), re.search(r"NETLIFY_SITE_ID=(\S+)", t).group(1)
    sys.exit("[중단] .netlify_deploy.conf 못 찾음(biomotion-platform 소유): " + " · ".join(CONF_CANDS))

def preflight_isolation():
    """배포 전 격리검사 의무 — 하나라도 FAIL(exit!=0)이면 배포 차단."""
    for chk in ("check_track_isolation.py", "check_system_isolation.py"):
        p = os.path.join(ROOT, chk)
        if not os.path.isfile(p):
            sys.exit(f"[중단·격리] 검사 스크립트 없음: {chk} — 격리 미검증 배포 금지")
        r = subprocess.run([sys.executable, p], cwd=ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout[-2000:]); print(r.stderr[-1000:])
            sys.exit(f"[중단·격리] {chk} FAIL — 트랙 격리 위반, 배포 차단")
        print(f"  ✓ 격리 통과: {chk}")

def main():
    args = sys.argv[1:]
    if not args or "--list" in args:
        print("트랙:"); [print("  ", t, "→", pre) for t, pre in TRACKS.items()]
        print("\n드라이런: python3 deploy_track.py <track> [--scope <subpath>]")
        print("실배포:   ... --deploy"); return
    track = args[0]
    if track not in TRACKS:
        sys.exit(f"[중단] 미등록 트랙 '{track}'. 등록: {', '.join(TRACKS)}")
    do_deploy = "--deploy" in args
    scope = None
    if "--scope" in args: scope = args[args.index("--scope") + 1].strip("/")
    src_root = os.path.join(ROOT, NETLIFY)
    if "--src-root" in args: src_root = args[args.index("--src-root") + 1]

    base_prefix = TRACKS[track]
    prefix = base_prefix + (scope + "/" if scope else "")
    src_dir = os.path.join(src_root, track.replace("/", os.sep) + (os.sep + scope if scope else ""))
    if not os.path.isdir(src_dir):
        sys.exit(f"[중단] 소스 디렉터리 없음: {src_dir}")

    print(f"=== deploy_track: {track}{'·'+scope if scope else ''} ({'실배포' if do_deploy else '드라이런'}) ===")
    print(f"라이브 경로 스코프: {prefix}")
    print(f"소스: {src_dir}")
    print("── 격리검사(의무) ──")
    preflight_isolation()

    TK, SI = load_conf()
    A = "https://api.netlify.com/api/v1"
    def rq(method, url, data=None, raw=None):
        h = {"Authorization": "Bearer " + TK}; body = None
        if data is not None: body = json.dumps(data).encode(); h["Content-Type"] = "application/json"
        elif raw is not None: body = raw; h["Content-Type"] = "application/octet-stream"
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h, method=method), timeout=180) as r:
            t = r.read(); return json.loads(t) if (t and method != "PUT") else None

    live = {nfc(f["path"]): f["sha"] for f in rq("GET", f"{A}/sites/{SI}/files")}
    src = {}
    for dp, dns, fns in os.walk(src_dir):
        dns[:] = [d for d in dns if not d.startswith(".")]
        for fn in fns:
            if fn.startswith("."): continue
            fp = os.path.join(dp, fn)
            rel = prefix + nfc(os.path.relpath(fp, src_dir)).replace(os.sep, "/")
            src[rel] = (sha1(fp), fp)
    src_sha = {p: s for p, (s, _) in src.items()}
    man = dict(live); man.update(src_sha)

    changed = sorted(p for p in man if man[p] != live.get(p))
    leak = [p for p in changed if not p.startswith(prefix)]
    if leak:
        sys.exit("[중단·게이트1] 스코프 밖 경로 변경(격리 위반):\n  " + "\n  ".join(leak[:20]))
    live_prefix_n = len([p for p in live if p.startswith(base_prefix)])
    other_n = len(live) - len([p for p in live if p.startswith(prefix)])
    print(f"── 변경 대상: {len(changed)}개 (스코프 내) · 나머지 라이브 {other_n}개 핀(불변 보장) ──")
    for p in changed: print("   ", ("신규" if p not in live else "변경"), p)
    if not changed:
        print("변경 없음 — 라이브가 이미 소스와 동일."); return
    if not do_deploy:
        print("\n[드라이런] 실제 배포하려면 --deploy 추가. (아무 파일도 바뀌지 않음)"); return

    dep = rq("POST", f"{A}/sites/{SI}/deploys", {"files": man, "draft": False})
    did = dep["id"]; required = set(dep.get("required") or [])
    ours = set(src_sha.values())
    nonours = [s for s in required if s not in ours]
    if nonours:
        sys.exit("[중단·게이트2] 스코프 밖 파일 업로드 요구(격리 위반): " + str(nonours[:10]))
    print(f"deploy: {did} · 업로드 요구 {len(required)}개(전부 스코프 내)")
    for p, (s, fp) in src.items():
        if s in required:
            rq("PUT", f"{A}/deploys/{did}/files/{urllib.parse.quote(p.lstrip('/'))}", raw=open(fp, "rb").read())
            print("  업로드:", p, os.path.getsize(fp), "bytes")
    st = None
    for _ in range(90):
        d = rq("GET", f"{A}/deploys/{did}"); st = d.get("state")
        if st in ("ready", "error"): break
        time.sleep(2)
    after = {nfc(f["path"]): f["sha"] for f in rq("GET", f"{A}/sites/{SI}/files")}
    drift = [p for p in set(list(live) + list(after)) if not p.startswith(prefix) and live.get(p) != after.get(p)]
    if drift:
        sys.exit("[경보·게이트3] 스코프 밖 sha 변동(격리 위반 의심):\n  " + "\n  ".join(drift[:20]))
    print(f"state: {st} · 게이트3 통과(스코프 밖 전부 불변) · url: {d.get('ssl_url') or d.get('url')}")
    print("✅ 배포 완료 — 다른 트랙 무영향 보장됨.")

if __name__ == "__main__":
    main()
