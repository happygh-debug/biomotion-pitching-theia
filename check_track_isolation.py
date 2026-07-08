#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""트랙 격리 검사 (2026-06-25)
================================
투구·타격 × {Theia · Uplift · IMU} = 6 트랙이 소스/배포/상호참조에서 '섞이지 않았는지' 검증한다.

용도
----
1) 전체 점검:   python3 check_track_isolation.py
2) 배포 게이트:  python3 check_track_isolation.py --track pitching/theia --changed-from HEAD
   → git 변경 파일이 해당 트랙(또는 공유코어) 밖이면 FAIL (다른 트랙을 건드린 배포 차단).

원칙
----
- 각 트랙은 자기 소스 디렉터리 + 자기 배포 디렉터리만 소유한다.
- 트랙 배포물(theia/·uplift/·imu/) 안의 사용자 네비게이션은 '다른 트랙'을 직접 가리키면 안 된다.
  (허브 index.html = 트랙 선택기라 예외 — 모든 트랙을 링크해도 됨.)
- pitching/dashboard_core 는 공유 스냅샷: 변경 시 '여러 트랙 영향 가능' 경고만(차단 아님).
"""
import os, sys, re, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
NETLIFY = "netlify_통합배포"

# 트랙 등록부 — 소유 소스/배포 디렉터리
TRACKS = {
    "pitching/theia":  {"src": "pitching/biomotion-theia-dashboard",       "deploy": f"{NETLIFY}/pitching/theia"},
    "pitching/uplift": {"src": "pitching/biomotion-uplift-dashboard",       "deploy": f"{NETLIFY}/pitching/uplift"},
    "pitching/imu":    {"src": "pitching/biomotion-imu-dashboard",          "deploy": f"{NETLIFY}/pitching/imu"},
    "batting/theia":   {"src": "batting/biomotion-batting-theia-dashboard", "deploy": f"{NETLIFY}/batting/theia"},
    "batting/uplift":  {"src": "batting/biomotion-uplift-batting-dashboard","deploy": f"{NETLIFY}/batting/uplift"},
    "batting/imu":     {"src": "batting/biomotion-imu-batting-dashboard",   "deploy": f"{NETLIFY}/batting/imu"},
}
# 공유(차단 아님·경고)
SHARED = ["pitching/dashboard_core"]
# 허브(트랙 선택기) — 모든 트랙 링크 허용(교차참조 예외)
HUBS = {f"{NETLIFY}/index.html", f"{NETLIFY}/pitching/index.html", f"{NETLIFY}/batting/index.html"}

# ── 저장소 오배선 검사(비투구 트리→투구) 상수 ──
# 투구 트랙 전용 저장소 식별자 — 타격/골프 트리에 나타나면 오배선(투구 데이터 오염 위험).
# 주의: 'Uplift' 라벨은 타격에서도 정당하게 쓰이므로 검출 문자열에 넣지 않는다(오탐 방지).
# 한계: 리터럴 검사라 동적 문자열 조립('pitching'+'-data')은 회피 가능 — 현 트리에 해당 사례 없음 실측.
PITCHING_STORE_TOKENS = ("pitching-data", "pitching_reports", "biomotion_pitching")
MISWIRE_SCAN_EXTS = (".html", ".js")  # 문서(.md 등)는 언급만으로 오탐될 수 있어 제외
MISWIRE_TREES = ("batting", "golf")   # 비투구 트리 — 소스=경고, 배포물=차단

# 다른 트랙의 배포 경로 토큰(교차 네비 탐지용)
def _other_deploy_tokens(track):
    toks = []
    for t, info in TRACKS.items():
        if t == track:
            continue
        # /pitching/uplift/ · /batting/theia/ 형태
        toks.append("/" + info["deploy"].split("/", 1)[1] + "/")
    return toks


def _exists(p):
    return os.path.exists(os.path.join(ROOT, p))


def check_registry():
    """각 트랙 소스/배포 존재 여부 리포트."""
    print("=== 트랙 등록부 ===")
    missing = []
    for t, info in TRACKS.items():
        s = "✓" if _exists(info["src"]) else "✗"
        d = "✓" if _exists(info["deploy"]) else "✗"
        if s == "✗" or d == "✗":
            missing.append((t, s, d))
        print(f"  {t:16s}  소스 {s}  배포 {d}")
    if missing:
        print("  ⚠️ 미완 슬롯(스캐폴드 필요):")
        for t, s, d in missing:
            print(f"     {t}  (소스 {s} · 배포 {d})")
    return missing


def check_cross_links():
    """트랙 배포물이 다른 트랙 배포 경로를 직접 네비게이션하는지 검사(허브 예외)."""
    print("\n=== 교차 네비게이션 검사(트랙→다른 트랙 직접 링크 금지) ===")
    viol = []
    for t, info in TRACKS.items():
        ddir = os.path.join(ROOT, info["deploy"])
        if not os.path.isdir(ddir):
            continue
        toks = _other_deploy_tokens(t)
        for dp, _, files in os.walk(ddir):
            if "_superseded" in dp:
                continue
            for f in files:
                if not f.endswith(".html"):
                    continue
                fp = os.path.join(dp, f)
                rel = os.path.relpath(fp, ROOT)
                if rel in HUBS:
                    continue
                try:
                    txt = open(fp, encoding="utf-8", errors="ignore").read()
                except Exception:
                    continue
                # href/window.open/location 으로 다른 트랙 경로를 직접 참조하는지(절대경로 토큰)
                for tok in toks:
                    for m in re.finditer(r'(?:href|src)\s*=\s*["\'][^"\']*' + re.escape(tok), txt):
                        viol.append((t, rel, tok, m.group(0)[:60]))
    if not viol:
        print("  ✓ 위반 없음 — 트랙 배포물이 다른 트랙을 직접 링크하지 않음")
    else:
        print(f"  ❌ 교차 네비 {len(viol)}건:")
        for t, rel, tok, snip in viol[:40]:
            print(f"     [{t}] {rel}  → {tok}  ({snip})")
    return viol


def check_storage_miswiring():
    """비투구 트리(타격·골프)가 투구 저장소(버킷/테이블/IndexedDB)를 참조하는지 검사.
    - 배포물 netlify_통합배포/{batting,golf}/** 에서 발견 → FAIL(배포 차단)
    - 소스 batting/**·golf/** 에서 발견 → 경고만(휴면 오배선 — 배포 전 자기 저장소로 교체 필요)
    배경: batting/biomotion-baseball-batting-dashboard 베타포크가 pitching-data/pitching_reports/
    biomotion_pitching 오배선 상태로 휴면 중(2026-07-02 감사) — 실배포되면 투구 데이터 오염.
    줄번호는 split("\\n") 기준 — splitlines()는 제어문자(FS/GS/RS/NEL)를 줄 경계로 취급해 grep과 어긋남.
    """
    print("\n=== 비투구 트리→투구 저장소 오배선 검사 (" + " · ".join(PITCHING_STORE_TOKENS) + ") ===")

    def _scan(base):
        hits = []
        top = os.path.join(ROOT, base)
        if not os.path.isdir(top):
            return hits
        for dp, _, files in os.walk(top):
            if "_superseded" in dp:
                continue
            for f in files:
                if not f.endswith(MISWIRE_SCAN_EXTS):
                    continue
                fp = os.path.join(dp, f)
                rel = os.path.relpath(fp, ROOT)
                try:
                    txt = open(fp, encoding="utf-8", errors="ignore").read()
                except Exception:
                    continue
                for i, line in enumerate(txt.split("\n"), 1):
                    for tok in PITCHING_STORE_TOKENS:
                        if tok in line:
                            hits.append((rel, i, tok))
        return hits

    deploy_hits, src_hits = [], []
    for tree in MISWIRE_TREES:
        deploy_hits += _scan(f"{NETLIFY}/{tree}")
        src_hits += _scan(tree)
    if deploy_hits:
        print(f"  ❌ 배포물 오배선 {len(deploy_hits)}건 — 배포물이 투구 저장소를 참조(배포 차단):")
        for rel, ln, tok in deploy_hits[:40]:
            print(f"     {rel}:{ln}  → {tok}")
    else:
        print(f"  ✓ 배포물({NETLIFY}/{{batting,golf}}) — 투구 저장소 참조 없음")
    if src_hits:
        nfiles = len(set(r for r, _, _ in src_hits))
        print(f"  ⚠️ 소스 오배선 {len(src_hits)}건/{nfiles}파일 — 미배포 휴면이라 경고만. 배포 전 자기 트랙 저장소로 교체 필요:")
        for rel, ln, tok in src_hits[:40]:
            print(f"     {rel}:{ln}  → {tok}")
    else:
        print("  ✓ 소스(batting/·golf/) — 투구 저장소 참조 없음")
    return deploy_hits


def _git_changed(base):
    try:
        out = subprocess.check_output(["git", "-C", ROOT, "diff", "--name-only", base], text=True)
        out += subprocess.check_output(["git", "-C", ROOT, "diff", "--name-only", "--cached"], text=True)
        # 미추적
        out += subprocess.check_output(["git", "-C", ROOT, "ls-files", "--others", "--exclude-standard"], text=True)
    except Exception as e:
        print("  (git 변경목록 실패:", e, ")")
        return None
    return sorted(set(p for p in out.splitlines() if p.strip()))


def gate(track, base):
    """배포 게이트: 변경 파일이 track 소유(소스/배포) 또는 공유코어 밖이면 FAIL."""
    if track not in TRACKS:
        print("알 수 없는 트랙:", track, "— 가능:", ", ".join(TRACKS)); return 2
    info = TRACKS[track]
    own = (info["src"], info["deploy"])
    changed = _git_changed(base)
    if changed is None:
        return 2
    print(f"\n=== 배포 게이트: {track} (기준 {base}) ===")
    print(f"  소유: {own[0]} · {own[1]}")
    bad, shared_hit, ok = [], [], 0
    for p in changed:
        if any(p == h or p.startswith(NETLIFY + "/" + h.split("/", 1)[1].rsplit("/", 1)[0]) for h in HUBS) or p in HUBS:
            ok += 1; continue  # 허브 변경 허용
        if p.startswith(own[0]) or p.startswith(own[1]):
            ok += 1
        elif any(p.startswith(s) for s in SHARED):
            shared_hit.append(p)
        elif p.startswith(("pitching/", "batting/", NETLIFY + "/pitching/", NETLIFY + "/batting/")):
            # 다른 트랙 소유인지 판별
            other = None
            for t2, i2 in TRACKS.items():
                if t2 != track and (p.startswith(i2["src"]) or p.startswith(i2["deploy"])):
                    other = t2; break
            if other:
                bad.append((p, other))
            else:
                ok += 1  # 트랙 외(코어 아닌 공통) — 통과
        else:
            ok += 1
    print(f"  변경 {len(changed)}건 · 트랙내/허브 {ok} · 공유코어 {len(shared_hit)} · 타트랙 {len(bad)}")
    for p in shared_hit:
        print(f"  ⚠️ 공유코어 변경(여러 트랙 영향 가능): {p}")
    if bad:
        print("  ❌ 타 트랙 파일 변경 — 배포 차단:")
        for p, other in bad:
            print(f"     {p}  (소유: {other})")
        return 1
    print("  ✓ 게이트 통과 — 이 배포는 다른 트랙을 건드리지 않음")
    return 0


def main():
    args = sys.argv[1:]
    track = base = None
    if "--track" in args:
        track = args[args.index("--track") + 1]
    if "--changed-from" in args:
        base = args[args.index("--changed-from") + 1]
    elif track:
        base = "HEAD"

    print("바이오모션 트랙 격리 검사\n" + "=" * 28)
    missing = check_registry()
    viol = check_cross_links()
    miswire = check_storage_miswiring()
    rc = 0
    if viol or miswire:
        rc = 1
    if track:
        g = gate(track, base)
        if g:
            rc = g
    print("\n" + ("✅ 격리 OK" if rc == 0 else "❌ 격리 위반/차단 — 위 항목 확인"))
    return rc


if __name__ == "__main__":
    sys.exit(main())
