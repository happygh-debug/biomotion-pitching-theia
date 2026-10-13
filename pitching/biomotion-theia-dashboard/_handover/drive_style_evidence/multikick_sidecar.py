#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""이중 킥 「해석 주의」 사이드카 데이터 — multikick_refined_trials.csv(원자료 판별 결과) → dashboard/데이터/multikick_data.js
교수 결정(2026-09-23 · 이 창 「권장대로 해줘」): 이중 킥 투수에게 킥 정점 기준 값 「해석 주의」 표시만 · 점수 무변경 · 기준점 재정의는 전후 비교 뒤 별건.
표시 대상 = 시행의 절반 이상이 이중 킥(판별: 6 Hz 저역 통과 · 들어 올린 높이 절반 이상에서 5 cm 이상 되내림 · 정점 간격 ≥0.3 s).
sw = 장비 KH 태그(최대 무릎 높이)가 시행마다 첫째·둘째 정점을 오감 = 킥 정점 기준 값이 투구마다 흔들림.
실행: python3 multikick_sidecar.py (멱등)"""
import os, json
import pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
OUT = os.path.join(REPO, "netlify_통합배포/pitching/theia/dashboard/데이터/multikick_data.js")
T = pd.read_csv(os.path.join(HERE, "multikick_refined_trials.csv"))
data = {}
for (g, nm), d in T.groupby(["group", "player"]):
    k = int((d.n_5cm >= 2).sum()); n = int(len(d))
    if n == 0 or k / n < 0.5:
        continue
    tags = set(d.loc[d.n_5cm >= 2, "tag_on"].dropna())
    data[f"{g}|{nm}"] = {"n": n, "k": k, "sw": len(tags) > 1}
js = ("/* 이중 킥 「해석 주의」 사이드카 데이터(표시 전용 · 점수·규준 무접촉) — multikick_sidecar.py 산출(원자료 무릎 높이 판별).\n"
      "   n = 시행 수 · k = 이중 킥 시행 수 · sw = 측정 장비의 무릎 최고점이 시행마다 첫째·둘째 정점을 오감. 주입기 = multikick_card.js */\n"
      "window.MULTIKICK=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(OUT, "w", encoding="utf-8").write(js)
print("표시 대상 선수", len(data), "· 정점 오감", sum(1 for v in data.values() if v["sw"]), "→", os.path.relpath(OUT, REPO))
