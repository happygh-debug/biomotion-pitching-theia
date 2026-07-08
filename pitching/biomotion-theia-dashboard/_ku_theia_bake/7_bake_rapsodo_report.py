# -*- coding: utf-8 -*-
"""KU Theia 구종설계 — 랩소도 리포트(DATA 표) 베이크 (2026-07-07)
연구원 Rapsodo Report 양식(첨부 이미지) 재현: 구종별 Velo·Max Velo·RPM·Max RPM·
Vert/Horz Break(trajectory)·Spin Eff·Gyro·Spin Dir·Strike%.

근거: rapsodo.js/summary는 mm SSW-break라 리포트의 trajectory-break와 단위·지표가 다름.
그래서 원본 랩소도 CSV(rapsodo_0628)의 'VB/HB (trajectory)'·'Total Spin'·'Gyro Degree'·
'Spin Direction'을 직접 집계. 이름 매핑=reuse.json(name_en→name·권위). CSV 별칭 2건 처리.
독립 검증: 홍은성 FB VB33.8/HB42.8/gyro17/maxRPM2369/dir≈01:51 = 첨부 이미지와 일치.

출력: korea/데이터/rapsodo_report.js (window.KU_RAPSODO_REPORT). 렌더 무브먼트 맵/변화구 완성도는
기존 rapsodo.js(존·무브 산포) 유지 — 이 파일은 DATA 표 전용 SSOT.
"""
import os, re, json, csv, glob, math

HERE = os.path.dirname(os.path.abspath(__file__))
KOREA = os.path.abspath(os.path.join(HERE, "../../../netlify_통합배포/pitching/theia/korea"))
OUT = os.path.join(KOREA, "데이터/rapsodo_report.js")
REUSE = json.load(open(os.path.join(HERE, "reuse.json"), encoding="utf-8"))

# 원본 CSV 디렉터리(다른 차선·읽기전용). 여러 후보 경로 탐색.
CSV_CANDIDATES = [
    "/Volumes/SamsungSSD/ClaudeCode/biomotion-dashboard-uplift-pitching/pitching/biomotion-uplift-dashboard/_ku_data/rapsodo_0628",
    "/Users/biomotion/Projects/biomotion-platform-uplift-pitching/pitching/biomotion-uplift-dashboard/_ku_data/rapsodo_0628",
]
CSVDIR = next((p for p in CSV_CANDIDATES if os.path.isdir(p)), None)
if not CSVDIR:
    raise SystemExit("rapsodo_0628 CSV 디렉터리를 찾지 못함: " + repr(CSV_CANDIDATES))

_alias = {"kimbumgeun": "kimbeomkeun", "kimjunyoung": "kimjunyeong"}
_csvs = {os.path.basename(f).replace("_rapsodo.csv", ""): f
         for f in glob.glob(os.path.join(CSVDIR, "*_rapsodo.csv"))}

KO = {"Fastball": "포심", "TwoSeam": "투심", "Sinker": "싱커", "Cutter": "커터",
      "Slider": "슬라이더", "CurveBall": "커브", "ChangeUp": "체인지업", "Splitter": "스플리터"}
BREAK_ORDER = ["TwoSeam", "Sinker", "Cutter", "Slider", "CurveBall", "Splitter", "ChangeUp"]


def fnum(s):
    try:
        return float(str(s).strip())
    except Exception:
        return None


def clock_to_deg(s):
    m = re.match(r"^\s*(\d{1,2}):(\d{2})", str(s or ""))
    if not m:
        return None
    h, mi = int(m.group(1)) % 12, int(m.group(2))
    return (h * 60 + mi) * 0.5  # 720분 → 360도, 1분=0.5도


def deg_to_clock(deg):
    if deg is None:
        return None
    deg %= 360.0
    total_min = deg / 0.5  # 0~720
    h = int(total_min // 60) % 12
    mi = int(round(total_min - (int(total_min // 60) * 60)))
    if mi == 60:
        mi = 0
        h = (h + 1) % 12
    return "%02d:%02d" % (12 if h == 0 else h, mi)


def circular_mean_clock(dirs):
    xs, ys = [], []
    for d in dirs:
        deg = clock_to_deg(d)
        if deg is None:
            continue
        r = math.radians(deg)
        xs.append(math.cos(r)); ys.append(math.sin(r))
    if not xs:
        return None
    ang = math.degrees(math.atan2(sum(ys) / len(ys), sum(xs) / len(xs)))
    return deg_to_clock(ang)


def agg_player(csv_path):
    rows = list(csv.reader(open(csv_path, encoding="utf-8-sig")))
    hi = next(i for i, r in enumerate(rows) if "Pitch Type" in r)
    col = {c.strip(): j for j, c in enumerate(rows[hi])}

    def g(r, k):
        j = col.get(k)
        return r[j].strip() if (j is not None and j < len(r)) else ""

    buckets = {}
    total = 0
    for r in rows[hi + 1:]:
        if not any(c.strip() for c in r):
            continue
        t = g(r, "Pitch Type")
        if not t:
            continue
        total += 1
        b = buckets.setdefault(t, {"velo": [], "spin": [], "eff": [], "vb": [], "hb": [],
                                   "gyro": [], "dir": [], "strike": 0, "n": 0})
        b["n"] += 1
        b["velo"].append(fnum(g(r, "Velocity")))
        b["spin"].append(fnum(g(r, "Total Spin")))
        b["eff"].append(fnum(g(r, "Spin Efficiency (release)")))
        b["vb"].append(fnum(g(r, "VB (trajectory)")))
        b["hb"].append(fnum(g(r, "HB (trajectory)")))
        b["gyro"].append(fnum(g(r, "Gyro Degree (deg)")))
        b["dir"].append(g(r, "Spin Direction"))
        if g(r, "Is Strike").lower() in ("y", "yes", "true", "1", "strike"):
            b["strike"] += 1

    def avg(x, nd=1):
        x = [v for v in x if v is not None]
        return round(sum(x) / len(x), nd) if x else None

    def mx(x, nd=0):
        x = [v for v in x if v is not None]
        return round(max(x), nd) if x else None

    out = []
    for t, b in buckets.items():
        out.append({
            "type": t, "typeKo": KO.get(t, t), "n": b["n"],
            "usage": round(b["n"] / total * 100, 1) if total else None,
            "veloAvg": avg(b["velo"]), "veloMax": mx(b["velo"], 1),
            "rpm": avg(b["spin"], 0), "rpmMax": mx(b["spin"], 0),
            "eff": avg(b["eff"]), "vb": avg(b["vb"]), "hb": avg(b["hb"]),
            "gyro": avg(b["gyro"]), "spinDir": circular_mean_clock(b["dir"]),
            "strikePct": round(b["strike"] / b["n"] * 100, 1) if b["n"] else None,
        })

    def rank(o):
        if o["type"] == "Fastball":
            return (0, 0)
        try:
            oi = BREAK_ORDER.index(o["type"])
        except ValueError:
            oi = 99
        return (1, -(o["usage"] or 0), oi)
    out.sort(key=rank)
    return out, total


REPORT = {}
print("=== 검증표(참조 이미지 대조용) — 홍은성 FB: VB33.8 HB42.8 gyro17 dir≈01:51 maxRPM2369 ===")
for en, info in REUSE.items():
    name = info.get("name")
    if not name or not info.get("has0628"):
        continue
    ck = en if en in _csvs else _alias.get(en)
    if not ck or ck not in _csvs:
        print(f"  [SKIP] {name}({en}) CSV 없음")
        continue
    types, total = agg_player(_csvs[ck])
    REPORT[name] = {"session": "2026-06-28", "nTotal": total, "types": types}
    fb = next((x for x in types if x["type"] == "Fastball"), None)
    if fb:
        print(f"  {name:5s}({en:14s}) n={total:2d} | FB velo {fb['veloAvg']}/{fb['veloMax']} "
              f"VB {fb['vb']} HB {fb['hb']} eff {fb['eff']}% gyro {fb['gyro']} dir {fb['spinDir']} "
              f"RPM {fb['rpm']}/{fb['rpmMax']} S% {fb['strikePct']}")

open(OUT, "w", encoding="utf-8").write(
    "window.KU_RAPSODO_REPORT = " + json.dumps(REPORT, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"\n완료: {len(REPORT)}명 → {OUT} ({round(os.path.getsize(OUT)/1024,1)}KB)")
