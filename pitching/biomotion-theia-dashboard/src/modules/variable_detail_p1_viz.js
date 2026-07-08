/* variable_detail_p1_viz.js — P1/P2 변인 detail 보완(B)·신규(C) 시각화 (계산 로직 변경 없음) */
(function (root) {
  var P2_ENHANCED = {
    earlyArmRisk: 1, armTransferRatio: 1, ppTrunkHum: 1,
    driveKneeFlexKF: 1, leadFootAngleFC: 1, strideTime: 1,
    trunkLeanChange: 1, trunkResistRatio: 1
  };
  var FC_SER_B = {
    backHipMoment: 1, backHipWork: 1, backKneeFlex: 1, elbowFlexAsym: 1, gHandH: 1,
    gloveHumME: 1, gloveShPow: 1, humMEt: 1, kneeFlexSym: 1, leadHipMoment: 1,
    leadHipWork: 1, leadKneeFlex: 1, leadKneeForce: 1, leadKneeMoment: 1,
    pelObliq: 1, shAbdAsym: 1, trunkLat: 1, xfAtFC: 1
  };
  var B = {
    armTransferRatio: 1, ppTrunkHum: 1, hssFC: 1, earlyArmRisk: 1, windupType: 1, strideType: 1,
    kneeTrunkLag: 1, grfDelay: 1
  };
  Object.keys(FC_SER_B).forEach(function (k) { B[k] = 1; });
  var C = {
    blockRiskPenalty: 1, linRotRatio: 1, rotKEgain: 1,
    driveKneeFlexKF: 1, leadFootAngleFC: 1, strideTime: 1,
    trunkLeanChange: 1, trunkResistRatio: 1,
    wuPelCoil: 1, wuTrunkCoil: 1, wuPelCloseKH: 1, wuTrunkCloseKH: 1, wuHSS: 1, wuHSSbuild: 1,
    wuCoilTq: 1, wuDriveHipER: 1, wuPelVel: 1, wuTrkVel: 1
  };

  var WU_SER = {
    wuPelCoil: { s: 'Pelvis_Angle_Z', label: '골반 각 (PI→KH)' },
    wuTrunkCoil: { s: 'Trunk_Angle_Z', label: '몸통 각 (PI→KH)' },
    wuPelCloseKH: { s: 'Pelvis_Angle_Z', label: '골반 닫힘각' },
    wuTrunkCloseKH: { s: 'Trunk_Angle_Z', label: '몸통 닫힘각' },
    wuHSS: { x: 1, label: '골반-어깨 비틀림' },
    wuHSSbuild: { x: 1, label: '비틀림 변화 (PI→KH)' },
    wuCoilTq: { s: 'FP1_Z_3', label: '축발 비틀림 토크', coil: 1 },
    wuDriveHipER: { s: 'Back_Hip_Angle_Z', label: '축발 고관절 ER' },
    wuPelVel: { s: 'Pelvis_Ang_Vel_Z', label: '골반 각속도', abs: 1 },
    wuTrkVel: { s: 'Thorax_Ang_Vel_Z', label: '몸통 각속도', abs: 1 }
  };

  function tier(key) {
    if (C[key]) return 'C';
    if (B[key]) return 'B';
    return '';
  }

  function suppOpen(key, card, m, bandFn) {
    if (!tier(key)) return false;
    if (card && (card.isRisk || card.isCriticalRisk || card.isTypeContext)) return true;
    var pr = card && card.priority != null ? card.priority : 999;
    if (pr < 70) return true;
    if (bandFn) {
      var b = bandFn(m, key);
      if (b && (b.code === 'weak' || b.code === 'caution' || b.code === 'risk')) return true;
    }
    return false;
  }

  function safeCid(key) {
    return 'vdt-' + String(key).replace(/[^a-zA-Z0-9_]/g, '_');
  }

  function suppTitle(key) {
    if (P2_ENHANCED[key]) return 'P2 보완 시각화 · ' + key;
    return (tier(key) === 'C' ? '신규 맥락 시각화' : '보완 시각화') + ' · ' + key;
  }

  function norms(key) {
    if (typeof BIOMOTION_NORMS !== 'undefined' && BIOMOTION_NORMS[key]) return BIOMOTION_NORMS[key];
    if (typeof PITCH_NORMS !== 'undefined' && PITCH_NORMS[key]) return PITCH_NORMS[key];
    return null;
  }

  function miniBandStrip(key, m, bandFn) {
    var nm = norms(key), val = m && m.value;
    if (!nm || val == null || !isFinite(val)) return '';
    var lo = nm.p25, hi = nm.p75, span = hi - lo || 1;
    var pos = Math.max(0, Math.min(100, ((val - lo) / span) * 100));
    var band = bandFn ? bandFn(m, key) : null;
    var st = band ? (' · ' + band.label) : '';
    var dir = (m && m.dir === 'range') ? '적정 p25–p75' : '엘리트 p25–p75';
    var bandLabel = (key === 'armTransferRatio') ? '전달비율 bandGauge' : '밴드';
    return '<div class="p1-mini-band" style="margin:8px 0;padding:8px 10px;background:var(--bg2);border-radius:8px">'
      + '<div class="sub2" style="margin-bottom:4px">' + bandLabel + ' · ' + dir + ': ' + lo + ' – ' + hi + (nm.med != null ? (' (med ' + nm.med + ')') : '') + st + '</div>'
      + '<div style="height:8px;background:var(--bg1);border-radius:4px;position:relative">'
      + '<div style="position:absolute;left:0;width:100%;height:100%;background:linear-gradient(90deg,rgba(232,149,78,.3),rgba(70,201,140,.35),rgba(91,182,230,.3));border-radius:4px"></div>'
      + '<div style="position:absolute;left:' + pos + '%;top:-2px;width:3px;height:12px;background:#fff;border-radius:2px;transform:translateX(-50%)"></div></div></div>';
  }

  function armTransferFlowHtml(rv) {
    var pct = rv != null && isFinite(rv) ? Math.max(0, Math.min(100, rv)) : null;
    var trunkW = pct != null ? Math.round(pct) : 55;
    var selfW = pct != null ? (100 - trunkW) : 45;
    var interp = '';
    if (pct != null) {
      if (pct < 70) interp = '<div class="note" style="margin-top:6px;color:var(--amber)">낮음 · 몸통에서 만든 에너지가 팔로 충분히 넘어가지 못할 수 있음 → 팔꿈치·어깨 부하(humME·elbowMoment)와 함께 확인</div>';
      else if (pct >= 86) interp = '<div class="note" style="margin-top:6px;color:var(--cyan)">높음 · 몸통 전달 비율은 양호하나, 팔 부하·MER 타이밍·채찍 순서와 함께 해석</div>';
      else interp = '<div class="note" style="margin-top:6px;color:var(--green)">코호트 적정 구간 · 몸통→팔 전달 흐름과 타이밍(ppTrunkHum)을 함께 확인</div>';
    }
    return '<div class="p1-mini-flow" style="display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap">'
      + '<div style="flex:1;min-width:88px;padding:10px 8px;background:rgba(192,132,252,.12);border:1px solid #c084fc;border-radius:8px;text-align:center">'
      + '<div style="font-size:10px;color:var(--fg2)">몸통 ME</div><div style="font-size:13px;font-weight:800;color:#c084fc">생성</div></div>'
      + '<div style="font-size:18px;color:var(--cyan)">→</div>'
      + '<div style="flex:1;min-width:88px;padding:10px 8px;background:rgba(91,182,230,.1);border:1px solid var(--cyan);border-radius:8px;text-align:center">'
      + '<div style="font-size:10px;color:var(--fg2)">팔 총 에너지</div><div style="font-size:13px;font-weight:800">전달 ' + (pct != null ? pct + '%' : '—') + '</div></div>'
      + '<div style="font-size:10px;color:var(--fg2);width:100%">막대: 몸통 수용 ' + trunkW + '% · 팔 자체 ' + selfW + '% (개념도)</div>'
      + '</div>' + interp
      + '<div class="sub2" style="margin-top:4px">flowMiniDiagram · 공용 ed-trunk / ed-ta-1 과 중복 없음</div>';
  }

  function stickPanelHint(text) {
    return '<div class="sub2" style="margin-top:8px">' + (text || '좌측 stick 패널에서 시각 증거 확인 · 관련 변인은 카드 하단 칩') + '</div>';
  }

  function strideRhythmHtml(sec, m) {
    var nm = norms('strideTime');
    var lo = nm && nm.p25 != null ? nm.p25 : 0.35;
    var hi = nm && nm.p75 != null ? nm.p75 : 0.75;
    var span = hi - lo || 0.4;
    var pos = (sec != null && isFinite(sec)) ? Math.max(0, Math.min(100, ((sec - lo) / span) * 100)) : 50;
    var word = (sec == null) ? '—' : (sec < lo ? '짧음 · 빠른 템포' : (sec > hi ? '김 · 여유 템포' : '코호트 적정'));
    return '<div class="p1-stride-rhythm" style="margin:8px 0;padding:8px 10px;background:var(--bg2);border-radius:8px">'
      + '<div class="sub2" style="margin-bottom:6px"><b>strideRhythmTimeline</b> · KH → FC</div>'
      + '<div style="font-size:15px;font-weight:800">' + (sec != null ? sec + (m && m.unit ? m.unit : 's') : '—') + ' · ' + word + '</div>'
      + '<div style="height:8px;background:var(--bg1);border-radius:4px;position:relative;margin-top:8px">'
      + '<div style="position:absolute;left:0;width:100%;height:100%;background:linear-gradient(90deg,rgba(91,182,230,.25),rgba(70,201,140,.35),rgba(91,182,230,.25));border-radius:4px"></div>'
      + '<div style="position:absolute;left:' + pos + '%;top:-2px;width:3px;height:12px;background:#fff;border-radius:2px;transform:translateX(-50%)"></div></div>'
      + '<div class="sub2" style="margin-top:4px">엘리트 p25–p75 ' + lo + '–' + hi + 's · strideType 맥락 병행</div></div>';
  }

  function trunkLeanNote(delta) {
    if (delta == null || !isFinite(delta)) return '<div class="note">Trunk_X[KH]−[FC] · 음수=전경 유지 · postureMaint 성분</div>';
    if (delta < -1) return '<div class="note" style="color:var(--green)">음수 · 상체 전경 유지 가능 · comVDrop·postureMaint와 정합</div>';
    if (delta > 2) return '<div class="note" style="color:var(--amber)">양수 큼 · 드라이브 중 상체가 뒤로 젖힘 · 자세 유지 점수 하락 요인</div>';
    return '<div class="note" style="color:var(--cyan)">적정 변화 · strideType·comVDrop 맥락 병행</div>';
  }

  function trunkResistNote(ratio) {
    var nm = norms('trunkResistRatio');
    var med = nm && nm.med != null ? nm.med : 2.01;
    if (ratio == null || !isFinite(ratio)) return '<div class="note">골반 열림 ÷ 몸통 열림 @FC · >1=골반 선행</div>';
    if (ratio >= med) return '<div class="note" style="color:var(--green)">≥엘리트 중앙(' + med + ') · 근위부(골반) 선행·몸통 버팀 양호</div>';
    if (ratio >= 1) return '<div class="note" style="color:var(--cyan)">1 이상 · 골반이 몸통보다 먼저 열림 · hssBuildKF·pelOpenKF 확인</div>';
    return '<div class="note" style="color:var(--amber)">&lt;1 · 몸통이 골반과 같거나 먼저 열림 · flying open·조기 열림 위험 맥락</div>';
  }

  function driveKneeFlexNote(delta) {
    if (delta == null || !isFinite(delta)) return '<div class="note">KH→FC 뒷무릎 각 변화 · +값 = 더 굽음</div>';
    if (delta > 8) return '<div class="note" style="color:var(--amber)">+값 큼 · 주저앉음 vs 힙힌지 — postureMaint·comVDrop와 함께 확인</div>';
    if (delta < -2) return '<div class="note" style="color:var(--cyan)">−값 · 드라이브 중 신전 성분 · 힙힌지 유지 여부 확인</div>';
    return '<div class="note" style="color:var(--green)">적정 변화 · 고관절 힌지 유지 가능 구간</div>';
  }

  function leadFootOrientHtml(deg) {
    var rot = (deg != null && isFinite(deg)) ? deg : 0;
    var rad = rot * Math.PI / 180;
    var cx = 60, cy = 50, len = 32;
    var x2 = cx + Math.sin(rad) * len, y2 = cy - Math.cos(rad) * len;
    return '<div class="p1-foot-orient" style="display:flex;gap:12px;align-items:center;margin:8px 0">'
      + '<svg viewBox="0 0 120 100" width="120" height="100" style="background:var(--bg2);border-radius:8px">'
      + '<ellipse cx="60" cy="72" rx="22" ry="10" fill="rgba(91,182,230,.2)" stroke="#5bd3ff" stroke-width="1.2"/>'
      + '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#e8954e" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="' + x2 + '" cy="' + y2 + '" r="4" fill="#e8954e"/>'
      + '<text x="6" y="14" fill="#8ea9cf" font-size="8">탑뷰 · FC 앞발 방향</text>'
      + '<text x="6" y="92" fill="#8ea9cf" font-size="8">' + rot + '°</text>'
      + '</svg>'
      + '<div style="font-size:12px;line-height:1.5;flex:1">착지 앞발이 홈(↑) 대비 어느 방향인지 · 리드레그 제동·블로킹 입력 조건</div></div>';
  }

  function ppTrunkTimingLabel(val) {
    var nm = norms('ppTrunkHum');
    if (val == null || !isFinite(val)) return { word: '—', color: 'var(--fg2)' };
    if (val < 0) return { word: '너무 빠름 · 팔이 몸통보다 먼저', color: 'var(--red)' };
    if (nm) {
      if (val < nm.p25) return { word: '너무 빠름 · 팔 피크가 몸통에 가까움', color: 'var(--amber)' };
      if (val > nm.p75) return { word: '늦음 · 팔 피크가 몸통보다 많이 늦음', color: 'var(--amber)' };
      return { word: '정상 · 몸통 선행 후 팔', color: 'var(--green)' };
    }
    return { word: '정상(+) · 몸통 선행', color: 'var(--cyan)' };
  }

  function earlyArmPoseGuideHtml(ea, escFn) {
    var hp = ea.handPost, ep = ea.elbowPost, ha = ea.horizAbd;
    var riskCol = (ea.label === 'risk') ? 'var(--red)' : (ea.label === 'caution' ? 'var(--amber)' : 'var(--green)');
    return '<div class="p1-ea-pose" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;margin:8px 0">'
      + '<svg viewBox="0 0 200 120" width="200" height="120" style="flex:0 0 200px;background:var(--bg2);border-radius:8px">'
      + '<line x1="100" y1="28" x2="100" y2="95" stroke="#8ea9cf" stroke-width="3"/>'
      + '<text x="104" y="24" fill="#8ea9cf" font-size="9">어깨선</text>'
      + '<circle cx="118" cy="52" r="5" fill="#5bd3ff"/><text x="124" y="55" fill="#5bd3ff" font-size="8">팔꿈치</text>'
      + '<circle cx="' + (hp != null && hp > 2 ? '88' : '112') + '" cy="38" r="5" fill="' + riskCol + '"/>'
      + '<text x="8" y="112" fill="#8ea9cf" font-size="8">측면 가이드 · KH 스냅샷</text>'
      + '<text x="8" y="14" fill="' + riskCol + '" font-size="9">던지는 손·팔꿈치가 어깨 뒤쪽이면 조기 준비</text>'
      + '</svg>'
      + '<div style="flex:1;min-width:140px;font-size:12px;line-height:1.5">'
      + '<div><b>handPostKH</b> · 손 뒤쪽 ' + escFn(hp != null ? hp + '%키' : '—') + '</div>'
      + '<div style="margin-top:4px"><b>elbowPostKH</b> · 팔꿈치 뒤 ' + escFn(ep != null ? ep + '%키' : '—') + '</div>'
      + '<div style="margin-top:4px"><b>horizAbdKH</b> · 수평외전 ' + escFn(ha != null ? ha + '°' : '—') + '</div>'
      + '<div class="note" style="margin-top:8px">팔이 몸통보다 너무 빨리 준비되면 몸통 에너지를 받기 전에 팔이 먼저 일할 수 있습니다.</div>'
      + (ea.conf === false ? '<div class="sub2" style="margin-top:4px">손 추적 불안정 · 수치 참고만</div>' : '')
      + '</div></div>';
  }

  function htmlOnly(key, inner, open) {
    return '<details class="var-detail-p1-supp" style="margin-top:10px"' + (open ? ' open' : '') + '>'
      + '<summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--cyan)">'
      + suppTitle(key) + '</summary>'
      + '<div style="padding:8px 2px 4px">' + inner + '</div></details>';
  }

  function canvasBlock(key, open, note, heightPx) {
    var cid = safeCid(key) + '-p1';
    var h = heightPx || (P2_ENHANCED[key] ? 112 : 148);
    return '<details class="var-detail-p1-supp" style="margin-top:10px"' + (open ? ' open' : '') + '>'
      + '<summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--cyan)">'
      + suppTitle(key) + '</summary>'
      + '<div style="padding:8px 2px 4px">'
      + (note ? '<div class="sub2" style="margin-bottom:6px">' + note + '</div>' : '')
      + '<canvas class="var-detail-p1-cv" id="' + cid + '" data-var-p1-key="' + key + '" '
      + 'style="width:100%;height:' + h + 'px;display:block;background:var(--bg2);border-radius:8px"></canvas></div></details>';
  }

  function mixedBlock(key, open, inner, withCanvas, heightPx) {
    var cid = safeCid(key) + '-p1';
    var h = heightPx || 112;
    var cv = withCanvas
      ? '<canvas class="var-detail-p1-cv" id="' + cid + '" data-var-p1-key="' + key + '" '
        + 'style="width:100%;height:' + h + 'px;display:block;margin-top:8px;background:var(--bg2);border-radius:8px"></canvas>'
      : '';
    return '<details class="var-detail-p1-supp" style="margin-top:10px"' + (open ? ' open' : '') + '>'
      + '<summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--cyan)">'
      + suppTitle(key) + '</summary>'
      + '<div style="padding:8px 2px 4px">' + inner + cv + '</div></details>';
  }

  function supplementHtml(key, m, spec, card, bandFn, escFn) {
    if (!tier(key)) return '';
    var open = suppOpen(key, card, m, bandFn);
    escFn = escFn || function (s) { return String(s == null ? '' : s); };

    if (key === 'earlyArmRisk') {
      var ea = (typeof DATA !== 'undefined' && DATA.phases) ? DATA.phases.earlyArm : null;
      if (!ea) return '';
      var riskCol = (ea.label === 'risk') ? 'var(--red)' : (ea.label === 'caution' ? 'var(--amber)' : 'var(--green)');
      var bars = [
        ['손 뒤쪽 (handPostKH)', ea.handPost, '%키'],
        ['팔꿈치 뒤 (elbowPostKH)', ea.elbowPost, '%키'],
        ['수평외전 (horizAbdKH)', ea.horizAbd, '°'],
        ['위험도', ea.risk, '/100']
      ];
      var bh = bars.map(function (b) {
        var v = b[1] != null ? b[1] + (b[2] || '') : '—';
        return '<div style="margin-top:6px"><span style="font-size:11px;color:var(--fg2)">' + b[0] + '</span>'
          + '<div style="font-size:15px;font-weight:800;color:' + riskCol + '">' + escFn(v) + '</div></div>';
      }).join('');
      var inner = '<div class="note" style="margin-bottom:6px"><b>KH event pose card</b> · riskPanel 보강 · stickEventSnapshot(측면 스틱) · 이벤트 KH</div>'
        + '<div style="font-size:18px;font-weight:800;color:' + riskCol + '">' + escFn(ea.risk != null ? ea.risk + '/100' : '—') + '</div>'
        + bh + earlyArmPoseGuideHtml(ea, escFn)
        + '<div class="sub2" style="margin-top:6px">관련 변인: handPostKH · elbowPostKH · horizAbdKH (위 수치)</div>'
        + stickPanelHint('좌측 stick 패널 · KH 스냅샷·위험 신호');
      return mixedBlock(key, open, inner, true, 100);
    }

    if (key === 'blockRiskPenalty') {
      var ph = (typeof DATA !== 'undefined' && DATA.phases) ? DATA.phases : null;
      var br = ph && ph.blockingRisk;
      function gv(k) {
        try {
          if (typeof _phaseMetricByKey === 'function') {
            var h = _phaseMetricByKey(k);
            if (h && h.metric && h.metric.value != null && isFinite(h.metric.value)) return h.metric.value;
          }
        } catch (e) { }
        return null;
      }
      var rows = [
        ['kneeCollapse', gv('kneeCollapse'), '°'],
        ['apBrakeImpulse', gv('apBrakeImpulse'), '%BW·s'],
        ['comVelReductionFCBR', gv('comVelReductionFCBR'), '%']
      ];
      var tbl = rows.map(function (r) {
        return '<tr><td style="padding:4px 8px 4px 0;color:var(--fg2)">' + r[0] + '</td><td style="font-weight:700">'
          + (r[1] != null ? r[1] + r[2] : '—') + '</td></tr>';
      }).join('');
      var pen = br && br.penalty != null ? ('<div style="margin-top:8px;font-weight:800;color:var(--red)">조건부 penalty '
        + br.penalty + '점</div>') : '<div class="note" style="margin-top:8px;color:var(--green)">조건 미충족 · penalty 없음</div>';
      return htmlOnly(key, (br && br.warning ? '<div class="note" style="color:var(--amber)">' + escFn(br.warning) + '</div>' : '')
        + '<table style="margin-top:8px;font-size:12px">' + tbl + '</table>' + pen, open);
    }

    if (key === 'windupType') {
      var ph2 = (typeof DATA !== 'undefined' && DATA.phases) ? DATA.phases : null;
      var wt = ph2 && ph2.windupType;
      var TY = (typeof mech6 !== 'undefined' && mech6.WINDUP_TYPES) ? mech6.WINDUP_TYPES : null;
      var pm = wt && TY && wt.primary ? TY[wt.primary] : null;
      var txt = pm ? (pm.easy || wt.primary) : (wt && wt.primary) || '—';
      return htmlOnly(key, '<div style="font-size:14px;font-weight:800">' + escFn(txt) + '</div>'
        + '<div class="sub2" style="margin-top:6px">좌측 stick 패널에 전략 비율·위험 신호 표시 · hipHinge·wu*는 단계 하단 「보조 증거」에서 선택 확인</div>', open);
    }

    if (key === 'strideType') {
      var ph3 = (typeof DATA !== 'undefined' && DATA.phases) ? DATA.phases : null;
      var st = ph3 && ph3.strideType;
      var STY = (typeof mech6 !== 'undefined' && mech6.STRIDE_TYPES) ? mech6.STRIDE_TYPES : null;
      var pm2 = st && STY && st.primary ? STY[st.primary] : null;
      var txt2 = pm2 ? (pm2.easy || st.primary) : (st && st.primary) || '—';
      var risks = (ph3 && ph3.strideRisk && ph3.strideRisk.length)
        ? '<ul style="margin:8px 0 0;padding-left:18px;font-size:12px">' + ph3.strideRisk.map(function (r) {
          return '<li>' + escFn(r.label || r.detail) + '</li>';
        }).join('') + '</ul>' : '';
      return htmlOnly(key, '<div style="font-size:14px;font-weight:800">' + escFn(txt2) + '</div>'
        + '<div class="sub2" style="margin-top:6px">좌측 stick 패널에 전략 비율 표시 · rearProp 등은 단계 하단 「보조 증거」에서 선택 확인</div>' + risks, open);
    }

    if (key === 'armTransferRatio') {
      var rv = m && m.value != null ? m.value : null;
      var innerA = miniBandStrip(key, m, bandFn) + armTransferFlowHtml(rv)
        + stickPanelHint();
      return mixedBlock(key, open, innerA, false);
    }
    if (key === 'ppTrunkHum') {
      var lag = m && m.value != null ? m.value : null;
      var tl = ppTrunkTimingLabel(lag);
      var innerP = '<div class="note" style="margin-bottom:6px"><b>timingLollipop</b> · trunk peak · humerus peak · FC→BR</div>'
        + '<div style="font-size:16px;font-weight:800;color:' + tl.color + '">' + (lag != null ? lag + (m.unit || 'ms') : '—') + ' · ' + tl.word + '</div>'
        + '<div class="note" style="margin-top:6px">몸통이 먼저 힘을 만들고 팔이 뒤따라 나와야 에너지 전달이 자연스럽습니다.</div>'
        + stickPanelHint();
      return mixedBlock(key, open, innerP, true, 118);
    }
    if (key === 'hssFC') {
      return canvasBlock(key, open, 'KH→FC X-factor · FC 시점 분리각 맥락');
    }
    if (key === 'kneeTrunkLag') {
      return canvasBlock(key, open, '무릎 신전속도 vs 몸통 회전속도 peak 차이');
    }
    if (key === 'grfDelay') {
      return canvasBlock(key, open, '뒷발·앞발 수직 GRF peak 간격');
    }
    if (key === 'driveKneeFlexKF') {
      var dk = m && m.value != null ? m.value : null;
      var innerD = '<div class="note" style="margin-bottom:6px"><b>driveKneeFlexAtKFChart</b> · KH→FC · 뒷무릎 굴곡 변화</div>'
        + driveKneeFlexNote(dk) + miniBandStrip(key, m, bandFn)
        + stickPanelHint();
      return mixedBlock(key, open, innerD, true, 118);
    }
    if (key === 'strideTime') {
      var stv = m && m.value != null ? m.value : null;
      var innerS = strideRhythmHtml(stv, m)
        + stickPanelHint();
      return mixedBlock(key, open, innerS, true, 108);
    }
    if (key === 'leadFootAngleFC') {
      var fa = m && m.value != null ? m.value : null;
      var innerF = '<div class="note" style="margin-bottom:6px"><b>leadFootOrientationAtFC</b> · FC 착지 입력</div>'
        + leadFootOrientHtml(fa) + miniBandStrip(key, m, bandFn)
        + '<div class="sub2" style="margin-top:4px">leadKneeFlexFC·strideLen과 함께 해석</div>'
        + stickPanelHint();
      return mixedBlock(key, open, innerF, true, 108);
    }
    if (key === 'trunkLeanChange') {
      var tl = m && m.value != null ? m.value : null;
      var innerTl = '<div class="note" style="margin-bottom:6px"><b>trunkLeanDeltaChart</b> · KH→FC · 몸통 전경(Trunk_X)</div>'
        + trunkLeanNote(tl) + miniBandStrip(key, m, bandFn)
        + '<div class="sub2" style="margin-top:4px">postureMaint·comVDrop·driveKneeFlexKF 연결</div>'
        + stickPanelHint();
      return mixedBlock(key, open, innerTl, true, 118);
    }
    if (key === 'trunkResistRatio') {
      var tr = m && m.value != null ? m.value : null;
      var innerTr = '<div class="note" style="margin-bottom:6px"><b>trunkResistPhaseChart</b> · KH→FC · 골반 vs 몸통 열림</div>'
        + '<div style="font-size:16px;font-weight:800;margin:6px 0">' + (tr != null ? tr + (m.unit || '') : '—') + '</div>'
        + trunkResistNote(tr)
        + '<div class="sub2" style="margin-top:4px">pelOpenKF·trkOpenKF·hssBuildKF와 함께 해석</div>'
        + stickPanelHint();
      return mixedBlock(key, open, innerTr, true, 118);
    }
    if (FC_SER_B[key]) {
      var fcNote = 'fc-ser-focus-chart · _FC_SER 미니 시계열';
      if (key === 'xfAtFC' || key === 'humMEt') fcNote += ' · ed-trunk·ed-xfactor 맥락';
      else if (key.indexOf('lead') === 0 || key.indexOf('knee') >= 0) fcNote += ' · ed-knee·blocking 맥락';
      else if (key.indexOf('back') === 0 || key === 'pelObliq') fcNote += ' · ed-stride·드라이브 맥락';
      return canvasBlock(key, open, fcNote, 128);
    }
    if (key === 'linRotRatio' || key === 'rotKEgain') {
      return canvasBlock(key, open, '착지 후 선형 KE 손실 vs 회전 KE 증가 (참고)');
    }
    if (WU_SER[key]) {
      return canvasBlock(key, open, '다리 들기(PI)→무릎 최고점(KH) 구간');
    }
    return '';
  }

  function dvel(arr, dt, sign) {
    if (!arr || !dt) return null;
    var o = [], n = arr.length;
    for (var i = 0; i < n; i++) {
      o[i] = (i === 0 || !isFinite(arr[i]) || !isFinite(arr[i - 1])) ? NaN : (arr[i] - arr[i - 1]) / dt * (sign || 1);
    }
    return o;
  }

  function peakIdx(arr, i0, i1, useAbs) {
    if (!arr) return null;
    i0 = Math.max(0, i0 | 0);
    i1 = Math.min(arr.length - 1, i1 | 0);
    var bi = null, bv = useAbs ? -Infinity : -Infinity;
    for (var i = i0; i <= i1; i++) {
      var v = arr[i];
      if (!isFinite(v)) continue;
      var sc = useAbs ? Math.abs(v) : v;
      if (sc > bv) { bv = sc; bi = i; }
    }
    return bi;
  }

  function paintEarlyArmKh(canvasId, ft) {
    var cv = document.getElementById(canvasId);
    if (!cv || !ft || !ft.frames) return;
    var ikl = ft.events && ft.events.i_kl_peak;
    if (ikl == null || !ft.frames[ikl]) return;
    var fr = ft.frames[ikl];
    var W = cv.width = cv.clientWidth || 300;
    var H = cv.height = cv.clientHeight || 100;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    var side = (typeof _bmRHP === 'function') ? (_bmRHP() ? 'r_' : 'l_') : 'r_';
    function pt(j) {
      var a = fr[j];
      return (a && a.length >= 3 && isFinite(a[0])) ? { x: a[0], z: a[2] } : null;
    }
    var sh = pt(side + 'shoulder'), el = pt(side + 'elbow'), wr = pt(side + 'wrist'), hd = pt(side + 'hand_tip') || wr;
    if (!sh || !el) return;
    var xs = [], zs = [];
    [sh, el, wr, hd].forEach(function (p) { if (p) { xs.push(p.x); zs.push(p.z); } });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var zmin = Math.min.apply(null, zs), zmax = Math.max.apply(null, zs);
    var pad = 0.14;
    function sx(x) { return pad * W + ((x - xmin) / (xmax - xmin || 0.001)) * (1 - 2 * pad) * W; }
    function sy(z) { return (1 - pad) * H - ((z - zmin) / (zmax - zmin || 0.001)) * (1 - 2 * pad) * H; }
    ctx.strokeStyle = '#5bd3ff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sx(sh.x), sy(sh.z));
    ctx.lineTo(sx(el.x), sy(el.z));
    if (wr) ctx.lineTo(sx(wr.x), sy(wr.z));
    if (hd) ctx.lineTo(sx(hd.x), sy(hd.z));
    ctx.stroke();
    [[sh, '#8ea9cf'], [el, '#5bd3ff'], [hd || wr, '#e8954e']].forEach(function (pair) {
      var p = pair[0];
      ctx.fillStyle = pair[1];
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.z), 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#8ea9cf';
    ctx.font = '10px sans-serif';
    ctx.fillText('KH 스틱 스냅샷 · 시상(Y-Z)', 8, 14);
  }

  function paintPpTrunkLollipop(canvasId, ft, lagMs) {
    var cv = document.getElementById(canvasId);
    if (!cv || !ft) return;
    var W = cv.width = cv.clientWidth || 300;
    var H = cv.height = cv.clientHeight || 118;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    var e = ft.events || {};
    var i0 = e.i_fc, i1 = e.i_br;
    if (i0 == null || i1 == null) return;
    var dt = (ft.meta && ft.meta.dt) ? ft.meta.dt : 0.00333;
    var trunk = ft.series && ft.series.Trunk_ME_X;
    var hum = ft.series && ft.series.Pitching_Humerus_ME_X;
    var tPk = peakIdx(trunk, i0, i1, true);
    var hPk = peakIdx(hum, i0, i1, true);
    if (tPk == null || hPk == null) return;
    var tMs = Math.round((tPk - i0) * dt * 1000);
    var hMs = Math.round((hPk - i0) * dt * 1000);
    var lag = lagMs != null && isFinite(lagMs) ? lagMs : (hMs - tMs);
    var maxMs = Math.max(hMs, tMs, lag, 80) + 20;
    var y0 = H * 0.55;
    var x0 = 36;
    var scale = (W - x0 - 24) / maxMs;
    function xMs(ms) { return x0 + ms * scale; }
    ctx.strokeStyle = '#3a4558';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(W - 12, y0);
    ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(xMs(tMs), y0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5bd3ff';
    ctx.beginPath();
    ctx.arc(xMs(hMs), y0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8ea9cf';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xMs(tMs), y0 - 18);
    ctx.lineTo(xMs(hMs), y0 - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8ea9cf';
    ctx.font = '10px sans-serif';
    ctx.fillText('몸통 ' + tMs + 'ms', xMs(tMs) - 14, y0 - 22);
    ctx.fillText('상완 ' + hMs + 'ms', xMs(hMs) - 14, y0 + 22);
    ctx.fillText('Δ ' + lag + 'ms (FC 기준)', xMs((tMs + hMs) / 2) - 20, y0 - 34);
    ctx.fillText('타이밍 로리팝 · FC→BR', 8, 14);
  }

  function paint(key, canvasId) {
    var cv = document.getElementById(canvasId);
    if (!cv) return;
    var ft = (typeof _fastTrial === 'function') ? _fastTrial() : null;
    if (!ft) return;

    if (key === 'earlyArmRisk') {
      paintEarlyArmKh(canvasId, ft);
      return;
    }

    if (key === 'ppTrunkHum') {
      var hitLag = null;
      try {
        if (typeof _phaseMetricByKey === 'function') {
          var h = _phaseMetricByKey('ppTrunkHum');
          if (h && h.metric && h.metric.value != null) hitLag = h.metric.value;
        }
      } catch (e) { }
      paintPpTrunkLollipop(canvasId, ft, hitLag);
      return;
    }

    if (typeof plotWin !== 'function') return;

    if (key === 'driveKneeFlexKF') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_kl_peak', startOff: -0.06, endEv: 'i_fc', endOff: 0.06, noGauge: true,
          left: {
            label: '뒷무릎 굴곡 (°)', lines: [
              { compute: function (t) { return t.series.Back_Knee_Angle_X; }, color: '#c084fc', label: '뒷무릎', width: 2.4 }
            ]
          },
          extraEvents: [
            { label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' },
            { label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }
          ]
        });
      } catch (e) { }
      return;
    }

    if (key === 'strideTime') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_kl_peak', startOff: -0.04, endEv: 'i_fc', endOff: 0.1, noGauge: true, markPeaks: true,
          left: {
            label: 'COM 전진 (m/s)', lines: [
              { compute: function (t) { return t.series.COM_Velocity_Y; }, color: '#5bd3ff', label: 'COM 전진', width: 2.4 }
            ]
          },
          extraEvents: [
            { label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' },
            { label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }
          ]
        });
      } catch (e) { }
      return;
    }

    if (key === 'leadFootAngleFC') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_kl_peak', startOff: -0.04, endEv: 'i_fc', endOff: 0.06, noGauge: true,
          left: {
            label: '착지 맥락 (°)', lines: [
              { compute: function (t) { return t.series.Lead_Knee_Angle_X; }, color: '#c084fc', label: '앞무릎 굴곡', width: 2.2 },
              { compute: function (t) { return t.series.Pelvis_Angle_Z; }, color: '#5bd3ff', label: '골반 회전', width: 2.0 }
            ]
          },
          extraEvents: [{ label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }]
        });
      } catch (e) { }
      return;
    }

    if (key === 'trunkLeanChange') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_kl_peak', startOff: -0.06, endEv: 'i_fc', endOff: 0.06, noGauge: true,
          left: {
            label: '몸통 전경 Trunk_X (°)', lines: [
              { compute: function (t) { return t.series.Trunk_Angle_X; }, color: '#5bd3ff', label: '몸통 전경', width: 2.4 }
            ]
          },
          extraEvents: [
            { label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' },
            { label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }
          ]
        });
      } catch (e) { }
      return;
    }

    if (key === 'trunkResistRatio') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_kl_peak', startOff: -0.04, endEv: 'i_fc', endOff: 0.08, noGauge: true,
          left: {
            label: 'KH 기준 열림 (°)', lines: [
              {
                compute: function (t) {
                  var a = t.series.Pelvis_Angle_Z, kh = t.events.i_kl_peak;
                  if (!a || kh == null || !isFinite(a[kh])) return null;
                  var b = a[kh];
                  return a.map(function (v) { return isFinite(v) ? Math.abs(v - b) : NaN; });
                }, color: '#5bd3ff', label: '골반 열림', width: 2.4
              },
              {
                compute: function (t) {
                  var a = t.series.Trunk_Angle_Z, kh = t.events.i_kl_peak;
                  if (!a || kh == null || !isFinite(a[kh])) return null;
                  var b = a[kh];
                  return a.map(function (v) { return isFinite(v) ? Math.abs(v - b) : NaN; });
                }, color: '#c084fc', label: '몸통 열림', width: 2.2
              }
            ]
          },
          extraEvents: [
            { label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' },
            { label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }
          ]
        });
      } catch (e) { }
      return;
    }

    if (FC_SER_B[key] && typeof _FC_SER !== 'undefined' && _FC_SER[key]) {
      try {
        var cfg = _FC_SER[key];
        var win = cfg.win || {};
        var lines = cfg.lines
          ? cfg.lines.map(function (ln) { return { compute: ln.fn, color: ln.c, label: ln.label, width: 2.2 }; })
          : [{ compute: cfg.fn, color: cfg.c || '#5bd3ff', label: key, width: 2.2 }];
        plotWin(canvasId, {
          fast: ft,
          startEv: win.startEv || 'i_kl_peak',
          startOff: win.startOff != null ? win.startOff : -0.05,
          endEv: win.endEv || 'i_fc',
          endOff: win.endOff != null ? win.endOff : 0.1,
          noGauge: true,
          markPeaks: true,
          left: { label: key, lines: lines },
          extraEvents: [
            { label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' },
            { label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }
          ]
        });
      } catch (e) { }
      return;
    }

    if (key === 'hssFC') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_kl_peak', startOff: -0.08, endEv: 'i_fc', endOff: 0.1, noGauge: true,
          left: {
            label: 'X-factor (°)', lines: [
              { compute: function (t) { return t.x_factor; }, color: '#46c98c', label: '골반·몸통 분리', width: 2.6 }
            ]
          },
          extraEvents: [{ label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' }, { label: 'FC', frame: ft.events.i_fc, color: '#3b82f6' }]
        });
      } catch (e) { }
      return;
    }

    if (key === 'kneeTrunkLag') {
      try {
        var dt = ft.meta.dt;
        plotWin(canvasId, {
          fast: ft, startEv: 'i_fc', startOff: -0.05, endEv: 'i_br', endOff: 0.05, noGauge: true, markPeaks: true,
          left: {
            label: '무릎 신전속도', lines: [{
              compute: function (t) {
                var a = t.series.Lead_Knee_Angle_X, d = dvel(a, t.meta.dt, -1);
                return d ? d.map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }) : null;
              }, color: '#c084fc', label: '무릎 신전', width: 2.2
            }]
          },
          right: {
            label: '몸통 회전속도 (°/s)', lines: [{
              compute: function (t) {
                var a = t.series.Thorax_Ang_Vel_Z;
                return a ? a.map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }) : null;
              }, color: '#5bd3ff', label: '몸통 회전', width: 2.2
            }]
          }
        });
      } catch (e) { }
      return;
    }

    if (key === 'grfDelay' && typeof _FC_SER !== 'undefined' && _FC_SER.grfDelay && _FC_SER.grfDelay.lines) {
      try {
        var lines = _FC_SER.grfDelay.lines.map(function (ln) {
          return { compute: ln.fn, color: ln.c, label: ln.label, width: 2.2 };
        });
        plotWin(canvasId, {
          fast: ft, startEv: 'i_start', startOff: -0.05, endEv: 'i_fc', endOff: 0.12, noGauge: true, markPeaks: true,
          left: { label: '수직 GRF', lines: lines }
        });
      } catch (e) { }
      return;
    }

    if (key === 'linRotRatio' || key === 'rotKEgain') {
      try {
        plotWin(canvasId, {
          fast: ft, startEv: 'i_fc', startOff: 0, endEv: 'i_br', endOff: 0.05, noGauge: true,
          left: {
            label: '전진 KE (J)', lines: [{
              compute: function (t) { return (typeof _blkFwdKE === 'function') ? _blkFwdKE(t) : t.series.COM_Velocity_Y; },
              color: '#5bd3ff', label: 'COM 전진 KE', width: 2.2
            }]
          },
          right: {
            label: '회전 KE (J)', lines: [{
              compute: function (t) { return (typeof _trunkKEser === 'function') ? _trunkKEser(t, 'rot') : null; },
              color: '#c084fc', label: '몸통 회전 KE', width: 2.4
            }]
          }
        });
      } catch (e) { }
      return;
    }

    var wu = WU_SER[key];
    if (wu) {
      try {
        var RHP = (typeof _bmRHP === 'function') ? _bmRHP() : true;
        var compute = function (t) {
          if (wu.x) return t.x_factor;
          var a = t.series[wu.s];
          if (!a) return null;
          if (wu.coil) {
            return a.map(function (x) { return isFinite(x) ? (RHP ? -x : x) : NaN; });
          }
          if (wu.abs) {
            return a.map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
          }
          return a;
        };
        plotWin(canvasId, {
          fast: ft, startEv: 'i_start', startOff: -0.05, endEv: 'i_kl_peak', endOff: 0.05, noGauge: true,
          left: { label: wu.label, lines: [{ compute: compute, color: '#8ea9cf', label: wu.label, width: 2.4 }] },
          extraEvents: [
            { label: 'PI', frame: ft.events.i_start, color: '#86a8d0' },
            { label: 'KH', frame: ft.events.i_kl_peak, color: '#a8b3c2' }
          ]
        });
      } catch (e) { }
    }
  }

  function initPage(pageKey) {
    var root = document.getElementById('page-' + pageKey);
    if (!root) return;
    root.querySelectorAll('canvas.var-detail-p1-cv[data-var-p1-key]').forEach(function (cv) {
      var k = cv.getAttribute('data-var-p1-key');
      if (k && cv.id) paint(k, cv.id);
    });
  }

  root.VAR_DETAIL_P1 = {
    tier: tier, suppOpen: suppOpen, supplementHtml: supplementHtml, paint: paint, initPage: initPage,
    keysB: Object.keys(B), keysC: Object.keys(C)
  };
})(typeof window !== 'undefined' ? window : globalThis);
