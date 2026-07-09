/* [2026-07-09] 힘판 미측정 세션(고려대) GRF 임펄스 변인 ML 추정 주입 — 베이크 통합(재베이크 시 자동 재생성).
 * 2_bake_finalize.js가 korea PLAYERS(grf_absent) 완성 후, players.js 기록 전에 injectGrfEstimate(PLAYERS) 호출.
 * 블록=앞발 수직 지지 임펄스(A·LOSO r≈0.85), 드라이브=뒷발 추진 임펄스(B·r≈0.73). "추정" 표기·est:true.
 * 제동임펄스(≈comVelReduction·물리동일)·peak(고주파 불가)는 이중계산/원리한계로 제외.
 * pos=엔진 _pctScore(z→정규CDF) 동일. 모델=자체 힘판 94선수 학습(_분석/grf_ml). 출처: Driveline OBP(CC BY-NC-SA·검증).
 * 재현/검증: _분석/grf_ml/inject_korea_grf.py (동일 로직·Python). */
const path = require('path');
const M = require(path.join(__dirname, '../_분석/grf_ml/grf_impulse_model.json'));
const FEATS = M.features, mu = M.mu, sd = M.sd, med = M.median_impute;

// 규준(monotonic·higher-better) — pitch_norms.js와 동일값(발행 SSOT 변경 시 여기도 갱신)
const NORM = {
  leadVGRFImpulse: { p25: 19.858, med: 20.965, p75: 22.8 },
  propImpPct:      { p25: 22.953, med: 24.505, p75: 26.11 },
};
const CAT_BLK = "전진 에너지 제동 · COM 제어 · 앞다리 지지 · 앞무릎 전략/위험 분리";
const CAT_DRV = "KH→FC · Pre-FC 준비의 생성 단계 — 앞으로 미는 힘 생성 · 낮은 자세 유지 · 회전 준비 · 착지(FC) 블로킹 조건 형성";
const NOTE = "[추정] 힘판 미측정 세션 — 키네마틱 기반 ML 추정(자체 힘판 94선수 학습·선수별 LOSO, 출처 Driveline OBP 검증). 순위/백분위 참고용·실측 아님.";
const SPEC = [
  { key: "leadVGRFImpulse", stage: "block", name: "앞발 수직 지지 임펄스 (추정)", unit: "%BW·s", cat: CAT_BLK },
  { key: "propImpPct",      stage: "drive", name: "뒷발 추진 임펄스 (추정)",     unit: "%BW·s", cat: CAT_DRV },
];

function pctScore(v, key) { // hi=1(monotonic·higher-better)
  const n = NORM[key]; if (!n) return null;
  const sig = Math.abs(n.p75 - n.p25) / 1.349 || 1, z = (v - n.med) / sig;
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const cdf = z > 0 ? 1 - p : p;
  return Math.round(Math.max(1, Math.min(99, cdf * 100)));
}
const stLabel = (pos) => pos >= 75 ? "우수" : (pos >= 40 ? "정상" : "미흡");

function featVal(pd, key) {
  for (const st in pd) for (const m of pd[st]) if (m && m.key === key && typeof m.val === "number") return m.val;
  return NaN;
}
function estimate(pd, tgt) {
  const w = M.models[tgt].w, b = M.models[tgt].b; let acc = b;
  for (let j = 0; j < FEATS.length; j++) {
    let x = featVal(pd, FEATS[j]); if (!isFinite(x)) x = med[j];
    acc += ((x - mu[j]) / sd[j]) * w[j];
  }
  return acc;
}

/** korea PLAYERS(grf_absent) 각 선수 phaseData에 추정 임펄스 변인을 scored로 주입. 멱등(이미 있으면 스킵). */
function injectGrfEstimate(PLAYERS) {
  let cnt = 0;
  for (const nm in PLAYERS) {
    const p = PLAYERS[nm]; if (!p || !p.grf_absent || !p.phaseData) continue;
    for (const s of SPEC) {
      if (!M.models[s.key] || !p.phaseData[s.stage]) continue;
      if (p.phaseData[s.stage].some(m => m.key === s.key)) continue; // 멱등
      const val = Math.round(estimate(p.phaseData, s.key) * 10) / 10, pos = pctScore(val, s.key);
      if (pos == null) continue;
      const metric = { key: s.key, name: s.name, val, unit: s.unit, cat: s.cat, scored: true, st: stLabel(pos), pos, est: true, flagDetail: NOTE };
      if (s.stage === "block") { // 제동(comVelReduction) 뒤에 삽입
        const i = p.phaseData.block.findIndex(m => m.key === "comVelReductionFCBR");
        p.phaseData.block.splice(i >= 0 ? i + 1 : p.phaseData.block.length, 0, metric);
      } else p.phaseData[s.stage].push(metric);
      cnt++;
    }
  }
  console.log("  [grf-estimate] 추정 임펄스 주입:", cnt, "개(블록 앞발수직·드라이브 뒷발추진 · '추정' 표기)");
  return PLAYERS;
}
module.exports = { injectGrfEstimate };
