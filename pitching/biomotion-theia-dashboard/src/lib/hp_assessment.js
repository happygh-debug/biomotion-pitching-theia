/* HP Assessment 섹션 렌더러 — Theia & Uplift 공통
 * HS-Team-Dashboard (kkl0511) biomotionHPDiagnosis 이식:
 *   점수 = (측정값 / HS평균) × 100  (100 = 고교평균, 상한 200)
 *   6축: 최대힘 · 체중대비힘 · 점프파워 · 체중대비파워 · 반응성 · 상체파워(미측정)
 *   Overall = 측정 축 가중평균.  145km/h+ cohort 를 목표 참조선으로 표시.
 *   참고: 국내 H2 코호트 · 야구 표준규준(2024) 백분위는 표에 함께 표기.
 */
function renderHPA(payload) {
  const root = document.getElementById('hpa-body');
  if (!root) return;
  const hpa = payload?.hp_assessment;
  if (!hpa) {
    root.innerHTML = '<p style="color:var(--fg2)">체력 데이터가 없습니다 (data/fitness/HJ.csv 등 4종 CSV 필요).</p>';
    return;
  }

  const allAxes = hpa.axes || [];
  const axes = allAxes.filter(a => a.key !== 'upper_power');  // 6번째(미측정)는 레이더 제외
  const overall = hpa.overall_score ?? '—';
  const pv_kmh = hpa.predicted_velo_kmh ?? '—';
  const cohort_n = hpa.cohort_n ?? null;
  const norm_src = hpa.norm_source || null;
  const ov_coh = hpa.overall_cohort_pct ?? null;
  const ov_norm = hpa.overall_norm_pct ?? null;

  /* ─── SVG 점수 레이더 (145km/h+=100, 상한 100) ─── */
  const N = Math.max(5, axes.length);
  const SZ = 360, CX = SZ/2, CY = SZ/2 + 6, R = 128, CAP = 100;
  const ang = i => -Math.PI/2 + (2*Math.PI*i/N);
  const pt = (i, score) => {
    const r = Math.max(0, Math.min(CAP, score||0))/CAP * R;
    return [CX + r*Math.cos(ang(i)), CY + r*Math.sin(ang(i))];
  };
  // grid rings 50/100/150/200 (100 = HS평균 강조)
  const rings = [25,50,75,100].map(lv => {
    const pts = axes.map((_,i)=>pt(i,lv).map(v=>v.toFixed(1)).join(',')).join(' ');
    const hi = lv===100;
    return `<polygon points="${pts}" fill="none" stroke="${hi?'#5b6b82':'#2c3442'}" stroke-width="${hi?1.4:1}" ${hi?'':'stroke-dasharray="2 3"'}/>`;
  }).join('');
  const spokes = axes.map((_,i)=>{ const [ex,ey]=pt(i,CAP); return `<line x1="${CX}" y1="${CY}" x2="${ex}" y2="${ey}" stroke="#2c3442"/>`; }).join('');
  // 145km/h+ cohort 목표 (점선 cyan)
  const elitePts = axes.map((a,i)=>pt(i, a.elite_score||130).map(v=>v.toFixed(1)).join(',')).join(' ');
  const elitePoly = `<polygon points="${elitePts}" fill="none" stroke="var(--cyan)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.85"/>`;
  // 본인 점수 polygon
  const myPts = axes.map((a,i)=>pt(i, a.score||0).map(v=>v.toFixed(1)).join(',')).join(' ');
  const myPoly = `<polygon points="${myPts}" fill="rgba(232,140,46,0.30)" stroke="var(--amber)" stroke-width="2.5"/>`;
  const myDots = axes.map((a,i)=>{ if(a.score==null) return ''; const [px,py]=pt(i,a.score); return `<circle cx="${px}" cy="${py}" r="4" fill="var(--amber)" stroke="#0b0d12" stroke-width="1"/>`; }).join('');
  const _short = { 'Relative Strength':'체중대비힘', 'Relative Power':'체중대비파워', 'Reactive Strength':'반응성', 'Strength':'최대힘', 'Power':'점프파워' };
  const labels = axes.map((a,i)=>{
    const [lx,ly]=pt(i, CAP*1.16);
    const anchor = Math.abs(lx-CX)<6 ? 'middle' : (lx>CX?'start':'end');
    const txt = _short[a.axis] || a.label_kr || a.axis;
    return `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#e8ecf2">${txt}</text>
      <text x="${lx}" y="${ly+13}" text-anchor="${anchor}" font-size="10" fill="#7d8898">${a.score!=null?a.score+'점':'—'}</text>`;
  }).join('');
  const svg = `<svg viewBox="-70 -10 ${SZ+140} ${SZ+30}" width="100%" style="max-width:460px">
    ${spokes}${rings}${elitePoly}${myPoly}${myDots}${labels}
    <circle cx="${CX}" cy="${CY}" r="30" fill="var(--bg2)" stroke="var(--amber)" stroke-width="2"/>
    <text x="${CX}" y="${CY-1}" text-anchor="middle" font-size="22" font-weight="800" fill="var(--amber)">${overall}</text>
    <text x="${CX}" y="${CY+13}" text-anchor="middle" font-size="8.5" fill="#7d8898">HP 종합</text>
  </svg>
  <div style="display:flex;gap:16px;margin-top:6px;font-size:11px;color:var(--fg2);justify-content:center">
    <span><span style="display:inline-block;width:14px;height:3px;background:var(--amber);vertical-align:middle"></span> 본인</span>
    <span><span style="display:inline-block;width:14px;height:0;border-top:2px dashed var(--cyan);vertical-align:middle"></span> 145km/h+ 목표</span>
    <span><span style="display:inline-block;width:14px;height:0;border-top:1.4px solid #5b6b82;vertical-align:middle"></span> 145km/h+(100)</span>
  </div>`;

  /* ─── 종합 멘트 ─── */
  const measured = axes.filter(a => a.score != null);
  const sorted = measured.slice().sort((a,b)=>b.score-a.score);
  const top = sorted[0], bot = sorted[sorted.length-1];
  let tier = '개선 여지';
  if (overall >= 130) tier = '90+ cohort 수준 (elite)';
  else if (overall >= 110) tier = '양호';
  else if (overall >= 90) tier = '고교 평균권';
  const summary = (typeof overall === 'number')
    ? `체력 종합 <b>${overall}점</b> · ${tier}${(top&&bot&&top!==bot)?` · 강점 <b>${top.label_kr}</b>(${top.score}) · 보강 <b>${bot.label_kr}</b>(${bot.score})`:''}`
    : '';

  /* ─── KPI 카드 ─── */
  const kpi = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
      <div style="background:var(--bg2);padding:12px;border-radius:8px;border-left:4px solid var(--amber)">
        <div style="font-size:11px;color:var(--fg2)">HP 종합 점수</div>
        <div style="font-size:26px;font-weight:bold">${overall}<span style="font-size:13px;color:var(--fg1)"> /100 = 145km/h+</span></div>
        <div style="font-size:11px;color:var(--fg1)">6축 가중평균 (HS-Team-Dashboard HP)</div>
      </div>
      
    </div>`;

  /* ─── 변인별 표 ─── */
  const rows = allAxes.map(a => {
    const measuredAx = a.value != null && a.score != null;
    const val = a.value != null ? `${a.value} ${a.unit}` : '<span style="color:var(--fg2)">미측정</span>';
    const sc  = a.score != null ? `${a.score}` : '—';
    const tgt = a.elite_target != null ? `${a.elite_target} ${a.unit}<span style="font-size:11px;color:var(--fg2)"> (${a.elite_score??'—'})</span>` : '—';
    const coh = a.cohort_pct != null ? `${Math.round(a.cohort_pct)}%` : '—';
    const nrm = a.norm_pct != null ? `${Math.round(a.norm_pct)}%` : '—';
    const _gc = !measuredAx ? 'var(--fg2)' : (a.score >= 110 ? 'var(--green)' : (a.score >= 90 ? 'var(--yellow)' : 'var(--red)'));
    const grade = `<span style="color:${_gc}">●</span>`;
    return `<tr>
      <td>${grade} <strong>${a.label_kr||a.axis}</strong><div style="font-size:11px;color:var(--fg2)">${a.sub||''}</div></td>
      <td style="text-align:right;font-weight:bold">${val}</td>
      <td style="text-align:right;font-weight:bold;color:var(--amber)">${sc}</td>
      <td style="text-align:right;color:var(--cyan)">${tgt}</td>
    </tr>`;
  }).join('');
  const tbl = `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
      <thead style="background:var(--bg1)">
        <tr>
          <th style="text-align:left;padding:8px">축 / 변인</th>
          <th style="text-align:right;padding:8px">측정값</th>
          <th style="text-align:right;padding:8px">점수</th>
          <th style="text-align:right;padding:8px">145km/h+</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  /* ─── Asymmetry warnings ─── */
  const asyms = hpa.asymmetry_flags || [];
  const asym_html = asyms.length ? `
    <div style="margin-top:18px;padding:12px;background:rgba(255,90,90,.10);border-left:4px solid var(--red);border-radius:6px">
      <strong style="color:var(--red)">⚠ 비대칭 경고 (≥15% = risk)</strong>
      <ul style="margin:6px 0 0 18px;color:var(--fg1)">
        ${asyms.map(a => `<li>${a.label}: <strong>${a.value}%</strong> (threshold ${a.threshold}%${a.note ? ' — '+a.note : ''})</li>`).join('')}
      </ul>
    </div>` : '';

  /* ─── 출처 ─── */
  const cite = `
    <div style="margin-top:18px;padding:10px;background:var(--bg1);font-size:11px;color:var(--fg1);border-radius:6px">
      상체파워(Plyo Push Up)는 미측정 항목입니다.
    </div>`;

  /* ─── 조립 ─── */
  root.innerHTML = `
    ${summary ? `<div style="margin-bottom:12px;font-size:14px;color:var(--fg0)">${summary}</div>` : ''}
    ${kpi}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
      <div style="display:grid;place-items:center">${svg}</div>
      <div style="overflow-x:auto">${tbl}</div>
    </div>
    ${asym_html}
    ${cite}`;
}

// 양쪽 main.js 에서 호출 가능하도록 window 노출
if (typeof window !== 'undefined') window.renderHPA = renderHPA;
