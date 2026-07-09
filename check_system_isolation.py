#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""시스템(@SYSTEM 태그) 격리 검사 — 무단 cp 방지 배포가드 (2026-07-02)
================================================================
check_track_isolation.py 가 '파일 소유·교차 네비게이션'을 본다면, 이 가드는
각 트랙 배포물에 인라인된 점수 코어(dashboard_core: phases/pitch_norms/mech5/
etdiag)가 '자기 시스템 태그'만 달고 있는지 — 다른 트랙의 코어가 실수로 복사되어
들어오지 않았는지 — 를 검증한다.  (phases.js 헤더가 약속하는 바로 그 배포가드.)

원칙
----
- 각 트랙 배포물(theia/·uplift/·imu/)은 @SYSTEM=<자기> 태그만 포함해야 한다.
- 다른 트랙의 @SYSTEM 태그가 하나라도 보이면 = 무단 cp = 배포 차단(FAIL).
- 자기 태그가 없으면 경고(WARN) — 아직 코어가 안 들어간 placeholder(예: imu)는 정상.

용도
----
  python3 check_system_isolation.py         # 배포 직전 게이트(3종목_클라우드분리_배포.command 에서 호출)
반환: 0=격리 OK(경고 무방), 1=타시스템 태그 침입(배포 차단).
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
NETLIFY = "netlify_통합배포"

# 트랙 → (배포 디렉터리, 자기 시스템 태그)
TRACKS = {
    "pitching/theia":  (f"{NETLIFY}/pitching/theia",  "THEIA"),
    "pitching/uplift": (f"{NETLIFY}/pitching/uplift", "UPLIFT"),
    "pitching/imu":    (f"{NETLIFY}/pitching/imu",    "IMU"),
    # [2026-07-07] 타격 트랙까지 확장 — 감시 사각 제거(교수 '4트랙 절대 격리').
    # @SYSTEM 태그는 엔진(THEIA/UPLIFT/IMU) 식별 — 타 엔진 코어가 이 트랙에 복사되면 검출.
    # (종목 격리=투구/타격은 디렉터리 소유로 별도 강제: check_track_isolation.py)
    "batting/theia":   (f"{NETLIFY}/batting/theia",   "THEIA"),
    "batting/uplift":  (f"{NETLIFY}/batting/uplift",  "UPLIFT"),
    "batting/imu":     (f"{NETLIFY}/batting/imu",     "IMU"),
}
ALL_TAGS = ["THEIA", "UPLIFT", "IMU"]
TAG_RE = re.compile(r"@SYSTEM=([A-Z]+)")


def scan_dir(d):
    """디렉터리 내 모든 .html 에서 @SYSTEM 태그 집계 → {tag: count}."""
    counts = {}
    for dp, _, files in os.walk(d):
        if "_superseded" in dp:
            continue
        for f in files:
            if not f.endswith(".html"):
                continue
            try:
                txt = open(os.path.join(dp, f), encoding="utf-8", errors="ignore").read()
            except Exception:
                continue
            for m in TAG_RE.finditer(txt):
                counts[m.group(1)] = counts.get(m.group(1), 0) + 1
    return counts


def main():
    print("바이오모션 시스템(@SYSTEM) 격리 검사\n" + "=" * 34)
    fail = warn = 0
    for track, (rel, own) in TRACKS.items():
        d = os.path.join(ROOT, rel)
        if not os.path.isdir(d):
            print(f"  {track:16s} (배포 없음 — 스킵)")
            continue
        counts = scan_dir(d)
        foreign = {t: c for t, c in counts.items() if t != own and t in ALL_TAGS}
        own_n = counts.get(own, 0)
        if foreign:
            fail += 1
            flist = ", ".join(f"@SYSTEM={t}×{c}" for t, c in sorted(foreign.items()))
            print(f"  ❌ {track:16s} 자기={own}×{own_n}  타시스템 침입: {flist}")
        elif own_n == 0:
            warn += 1
            print(f"  ⚠️ {track:16s} @SYSTEM 태그 없음(코어 미주입 placeholder면 정상)")
        else:
            print(f"  ✓ {track:16s} @SYSTEM={own}×{own_n}  (타시스템 0)")
    print()
    if fail:
        print(f"❌ 시스템 격리 위반 {fail}건 — 무단 cp 의심. 배포 차단.")
        return 1
    print("✅ 시스템 격리 OK — 각 트랙 배포물이 자기 코어만 포함"
          + (f" (경고 {warn}건)" if warn else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
