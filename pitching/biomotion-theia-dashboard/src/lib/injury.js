/* 부상 위험 평가 렌더러 — Joint Moments / Forces (다크 테마) */
function renderInjury(payload) {
  const root = document.getElementById('injury-body');
  if (!root) return;
  const ir = payload && payload.injury_risk;
  if (!ir || !ir.metrics) {
    root.innerHTML = '<div style="padding:12px;background:rgba(245,197,66,.10);border-left:4px solid var(--yellow);border-radius:6px;font-size:13px;color:var(--fg1)">지면반력 기반 <b>직접</b> 관절부하(Theia·포스플레이트 전용)는 이 리포트에 없습니다. 아래 <b>상지 추정 부하 시계열</b>은 마커리스 역동역학으로 <b>추정</b>한 어깨→팔꿈치 관절 토크·관절력(14쌍 보정)입니다 — 부상 확률이 아니라 임계 대비 상대 부하 스크리닝이며, 참고용·단독 진단 금지.</div>';
    return;
  }
  // ── 현재 문헌 기반 임계로 등급 재판정(저장 시점 옛 임계 무시) — 클라우드 선수도 즉시 반영 ──
  var _TH = { elbow_valgus:{hs_mean:60,warn:85,danger:105}, shoulder_ir:{hs_mean:70,warn:95,danger:115}, shoulder_distraction:{hs_mean:90,warn:110,danger:130} };
  ir.metrics.forEach(function(m){ var th=_TH[m.key]; if(!th)return; m.hs_mean=th.hs_mean; m.warn=th.warn; m.danger=th.danger; m.ref='문헌 기반 일반 기준(Local축)';
    m.grade=(m.value==null)?'unavailable':(m.value>=th.danger?'danger':(m.value>=th.warn?'caution':'normal')); });
  ir.note='축 정의(연구원 답변 v2): Elbow Varus=Y, Shoulder IR=Z, Distraction=Force_Y(상완·몸통 Local축). 임계값=투구 바이오메카닉스 문헌(Fleisig/ASMI 등) 피크 부하 일반 범위 — 정규화·축 정의에 따라 미세조정 가능. 참고용·단독 진단 금지.';
  const gColor = { normal:'#5aa888', caution:'#c9b15c', danger:'#cf6f6c', unavailable:'#7d8898' };
  const _dot = c => `<span style="color:${c}">●</span>`;
  const gLabel = { normal:_dot('#5aa888')+' 정상', caution:_dot('#c9b15c')+' 주의', danger:_dot('#cf6f6c')+' 위험', unavailable:_dot('#7d8898')+' N/A' };

  const cards = ir.metrics.map(m => {
    const c = gColor[m.grade] || '#7d8898';
    const val = m.value != null ? `${m.value} <span style="font-size:13px;color:var(--fg2)">${m.unit}</span>` : 'N/A';
    const loadPct = (m.value != null && m.danger) ? Math.round(m.value/m.danger*100) : null;  // 위험 임계 대비 부하 수준(부상확률 아님)
    const warnPct = (m.warn && m.danger) ? Math.round(m.warn/m.danger*100) : null;
    const pct = (m.value != null && m.danger) ? Math.min(100, m.value/m.danger*100) : 0;
    return `<div style="background:var(--bg2);border:1px solid var(--line);border-left:5px solid ${c};border-radius:8px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="font-size:14px;color:var(--fg0)">${m.label}</strong>
        <span style="color:${c};font-weight:bold">${gLabel[m.grade]||''}</span>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:6px 0">
        <span style="font-size:24px;font-weight:bold;color:var(--fg0)">${val}</span>
        <span style="font-size:13px;color:var(--fg1)">부하 수준 <b style="font-size:20px;color:${c}">${loadPct!=null?loadPct+'%':'—'}</b></span>
      </div>
      <div style="position:relative;background:var(--bg0);height:9px;border-radius:5px;overflow:hidden;margin:6px 0">
        <div style="width:${pct}%;height:100%;background:${c}"></div>
        ${warnPct!=null?`<div style="position:absolute;top:-2px;bottom:-2px;left:${warnPct}%;width:1.5px;background:#c9b15c" title="주의 임계"></div>`:''}
      </div>
      <div style="font-size:11px;color:var(--fg1)">
        부하 % = 값 ÷ 위험 임계 ×100 (주의선 ${warnPct!=null?warnPct+'%':'—'} · 위험선 100%) — <b>부상 확률 아님</b>, 임계 대비 상대 부하<br>
        문헌 기준 ${m.hs_mean}${m.unit} · 주의 ≥${m.warn} · 위험 ≥${m.danger} · 축: ${m.axis} · ${m.ref}
      </div>
    </div>`;
  }).join('');

  const axes = ir.all_axes || {};
  const axRows = Object.entries(axes).filter(([k,v])=>v!=null).map(([k,v]) =>
    `<tr><td style="padding:4px 6px;color:var(--fg1)">${k}</td><td style="text-align:right;padding:4px 6px;color:var(--fg0)">${v}</td></tr>`).join('');

  root.innerHTML = `
    <div style="padding:12px;background:rgba(245,197,66,.10);border-left:4px solid var(--yellow);border-radius:6px;margin-bottom:16px;font-size:13px;color:var(--yellow)">
      <strong>⚠ 참고용 — 단독 진단 금지.</strong> ${ir.note}
    </div>
    ${cards}
    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:13px;color:var(--fg1)">전체 Moment/Force 축별 peak (FC~BR 평균)</summary>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
        <thead style="background:var(--bg1)"><tr><th style="text-align:left;padding:6px;color:var(--fg1)">변수</th><th style="text-align:right;padding:6px;color:var(--fg1)">평균 peak |abs|</th></tr></thead>
        <tbody>${axRows}</tbody>
      </table>
      <p style="font-size:11px;color:var(--fg2);margin-top:6px">Moment 단위 Nm, Force 단위 N. body weight = ${ir.bw_n} N.</p>
    </details>`;
}
if (typeof window !== 'undefined') window.renderInjury = renderInjury;
