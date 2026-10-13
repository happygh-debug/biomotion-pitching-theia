#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""다중 킥 판별 — 추적 튐 제거판. 앞다리 무릎 높이를 6 Hz 저역 통과(양방향 4차)로 부드럽게 한 뒤,
뚜렷한 정점 = 들어 올린 높이의 절반 이상 · 사이로 5 cm 이상(또는 3 cm) 내려갔다 다시 오름 · 두 정점 간격 0.3 초 이상.
근거: 1차 판별(필터 없음·간격 0.1 초)에 걸린 124시행 중 간격 하위 사분위(≤250 ms)는 몇 프레임짜리 추적 튐이었고,
      진짜 「들고 버티다 처진 뒤 다시 듦」은 정점 간격이 0.5~1.5 초였다(예시 그림 확인).
추가: 걸린 투수에서 장비 KH 태그(최대 무릎 높이)가 시행마다 첫째/둘째 정점을 오가는지 = KH 기준 값이 실제로 흔들리는지.
읽기 전용 · 집계만. 실행: python3 multikick_refined.py → multikick_refined_result.json"""
import os, sys, json, unicodedata, warnings
import numpy as np, pandas as pd
from multiprocessing import Pool
from scipy.signal import find_peaks, butter, filtfilt

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import trunk_tilt_extract as TT
import nextbase_checks as NB
nfc = lambda s: unicodedata.normalize("NFC", str(s))
HANDS = None
GAP_S = 0.30
PROMS = [0.03, 0.05]


def init(h):
    global HANDS
    HANDS = h


def detect(seg, dt, prom):
    fs = 1.0 / dt
    b, a = butter(4, 6.0 / (fs / 2.0), btype="low")
    zf = filtfilt(b, a, seg)
    base = float(np.min(zf[: max(3, int(0.3 / dt))])); amp = float(np.max(zf)) - base
    if amp < 0.05:
        return None, None
    pk, _ = find_peaks(zf, prominence=prom, distance=max(1, int(GAP_S / dt)))
    keep = [int(i) for i in pk if zf[i] >= base + 0.5 * amp]
    return keep, zf


def _trial(args):
    import dbc_feasibility as DF
    p, g, nm = args
    col, tk, n = DF.load(p); nk = len(tk); dt = float(np.nanmedian(np.diff(tk)))
    tFC = DF.ev(col, ["Footstrike", "Foot_Contact"]); tKH = DF.ev(col, ["MaxKneeHeight"])
    if tFC is None:
        return None
    lead = "L_KNEE" if HANDS.get(nfc(nm), "R") == "R" else "R_KNEE"
    z = col(lead, "Z")
    if z is None:
        return None
    iFC = int(np.clip(round((tFC - tk[0]) / dt), 0, nk - 1))
    seg = pd.Series(np.asarray(z[:nk], float)[: iFC + 1]).interpolate(limit_direction="both").values
    if len(seg) < 30:
        return None
    r = {"group": g, "player": nfc(nm), "file": os.path.basename(p)}
    for pr in PROMS:
        keep, zf = detect(seg, dt, pr)
        if keep is None:
            return None
        r[f"n_{int(pr * 100)}cm"] = len(keep)
        if pr == 0.05 and len(keep) >= 2 and tKH is not None:
            top2 = sorted(sorted(keep, key=lambda i: -zf[i])[:2])
            iKH = (tKH - tk[0]) / dt
            r["tag_on"] = "first" if abs(iKH - top2[0]) < abs(iKH - top2[1]) else "second"
            r["gap_ms"] = round((top2[1] - top2[0]) * dt * 1000)
    return r


def trial(args):
    try:
        return _trial(args)
    except Exception:
        return None


def main():
    H = NB.hands()
    J, _ = TT.jobs(include_minor=True)      # 투구별 판별은 선수 본인 표시(사이드카)용이라 전원
    with Pool(8, initializer=init, initargs=(H,)) as pool:
        rows = [r for r in pool.map(trial, J, chunksize=4) if r]
    T_all = pd.DataFrame(rows)
    T = T_all[~T_all.group.isin(TT.MINOR_GROUPS)].copy()   # ★집계 모집단 = 중학 제외(교수 반복 지시)
    TT.assert_no_minor(T.group, "multikick_refined 집계")
    out = {"n_시행": int(len(T)), "n_투수": int(T.player.nunique()), "모집단": "참조 4그룹 + 고려대 · 중학 제외(교수 반복 지시)", "기준": "6 Hz 저역 통과 · 정점 간격 ≥0.3 s · 들어 올린 높이 절반 이상"}
    for pr in PROMS:
        c = f"n_{int(pr * 100)}cm"; hit = T[T[c] >= 2]
        out[f"되내림 {int(pr * 100)}cm 이상"] = {"시행": int(len(hit)), "투수": int(hit.player.nunique()), "그룹별 시행": hit.group.value_counts().to_dict()}
    h5 = T[T.n_5cm >= 2]
    per = h5.groupby("player").agg(n=("file", "size"), first=("tag_on", lambda s: int((s == "first").sum())), second=("tag_on", lambda s: int((s == "second").sum())))
    tot = T.groupby("player").size()
    per["전체시행"] = tot.reindex(per.index).values
    out["5cm 걸린 투수: 시행 비율 분포(0.25/0.5/0.75)"] = [round(float(q), 2) for q in (per.n / per["전체시행"]).quantile([.25, .5, .75])]
    out["5cm 걸린 투수 중 KH 태그가 시행마다 첫째·둘째 정점을 오간 투수"] = int(((per["first"] > 0) & (per["second"] > 0)).sum())
    out["5cm 정점 간격(ms) 사분위"] = [round(float(q)) for q in h5.gap_ms.quantile([.25, .5, .75])]
    # 양성·음성 대조
    rng = np.random.default_rng(1)
    t = np.arange(0, 3.0, 1 / 300.0)
    single = 0.65 * np.exp(-0.5 * ((t - 2.0) / 0.25) ** 2) + 0.5
    double = single + 0.55 * np.exp(-0.5 * ((t - 1.1) / 0.22) ** 2) - 0.0
    glitch = single.copy(); glitch[590:596] -= 0.25
    res = {}
    for nm_, s in (("단일 킥(음성)", single), ("단일 킥 + 추적 튐 6프레임(음성)", glitch), ("들고 버티다 다시 드는 이중 킥(양성)", double)):
        k, _ = detect(s + rng.normal(0, 0.002, len(s)), 1 / 300.0, 0.05)
        res[nm_] = f"정점 {len(k)}개 → {'다중 킥' if len(k) >= 2 else '단일'}"
    out["대조(합성)"] = res
    json.dump(out, open(os.path.join(HERE, "multikick_refined_result.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    T_all.to_csv(os.path.join(HERE, "multikick_refined_trials.csv"), index=False, encoding="utf-8")   # 선수별 표시 원천(전원)
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
