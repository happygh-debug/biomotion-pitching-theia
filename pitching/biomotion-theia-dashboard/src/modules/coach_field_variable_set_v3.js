/**
 * coach_field_variable_set_v3.js — 현장 피드백용 변인 노출·역할 SSOT (display-only)
 * 역할 우선: independent / descriptor / cross_link / auxiliary / research_only / visual_aid_only / deferred
 * Core35·Top20·Tier2 **숫자 맞춤 아님** · 슬롯·MAP·점수 변경 없음.
 * (향후 운영명 예: Field Feedback Set · Mechanism Support Set · Coach Priority Set)
 */
(function (root) {
  'use strict';

  var ROLES = {
    independent: 'independent',
    descriptor: 'descriptor',
    cross_link: 'cross_link',
    auxiliary_layer: 'auxiliary_layer',
    research_only: 'research_only',
    deferred: 'deferred',
    visual_aid_only: 'visual_aid_only'
  };

  var VISUAL_AIDS = [
    { covKey: 'comPath', labelKr: 'COM 경로', stickOverlay: 'comPath' },
    { covKey: 'handPath', labelKr: '손 경로', stickOverlay: 'handPath' },
    { covKey: 'pelvisSho', labelKr: '골반·어깨선', stickOverlay: 'pelvisSho' },
    { covKey: 'trunkLean', labelKr: '몸통축', stickOverlay: 'trunkLean' },
    { covKey: 'blocking', labelKr: '블로킹 보조', stickOverlay: 'blocking' },
    { covKey: 'kneeAngle', labelKr: '무릎각', stickOverlay: 'kneeAngle' }
  ];

  var ROWS = [
    { phase_or_layer: 'summary', variable_key: 'energy_map', display_name_kr: '에너지 흐름 지도', current_visibility: 'coach_main', new_visibility: 'coach_main', role_new: 'independent', coach_label: '에너지 흐름과 누수 지점', coach_message: '오늘의 핵심 문제·누수 흐름 요약', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'high', reason_for_change: '유지 · 오늘의 요약 앵커' },
    { phase_or_layer: 'summary', variable_key: 'top_issues', display_name_kr: '오늘의 핵심 문제 1~2개', current_visibility: 'coach_main', new_visibility: 'coach_main', role_new: 'independent', coach_label: '오늘 볼 문제', coach_message: 'v1 카드·누수 진단에서 도출', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'high', reason_for_change: '유지' },
    { phase_or_layer: 'summary', variable_key: 'leak_flow', display_name_kr: '오늘의 누수 흐름', current_visibility: 'coach_main', new_visibility: 'coach_main', role_new: 'descriptor', coach_label: '누수 흐름', coach_message: '저장→생성→전달→방출 축', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'high', reason_for_change: '유지' },
    { phase_or_layer: 'windup', variable_key: 'wuPelVel', display_name_kr: '조기풀림', current_visibility: 'core35_fold', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '조기풀림', coach_message: 'KH 전 골반·몸통 조기개방', helper_graph_preset: 'rotation-onset-time-series', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'high', reason_for_change: 'v1 독립 카드·메인 선택' },
    { phase_or_layer: 'windup', variable_key: 'wuPelCoil', display_name_kr: '골반 코일', current_visibility: 'candidate_review', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '와인드업 코일', coach_message: '골반 코일 · 회전 로딩', helper_graph_preset: 'hip-coil-time-series', stick_overlay_preset: 'hipCoil', measurement_confidence: 'medium', reason_for_change: '교수님 승격 · wuDriveHipER 대체 · CV중앙값 10.5%(medium)' },
    { phase_or_layer: 'windup', variable_key: 'wuTrunkCloseKH', display_name_kr: '몸통 닫힘각', current_visibility: 'candidate_review', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '상하체 닫힘 유지', coach_message: 'KH 시점 몸통 닫힘각 · 선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김)', helper_graph_preset: 'closed-angle-band', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'high', reason_for_change: '교수님 승격 · wuPelCloseKH 대체 · CV중앙값 1.8%(high)' },
    { phase_or_layer: 'windup', variable_key: 'wuPelCloseKH', display_name_kr: '상하체 닫힘 유지', current_visibility: 'hidden', new_visibility: 'coach_auxiliary', role_new: 'auxiliary_layer', coach_label: '상하체 닫힘 유지', coach_message: 'wuTrunkCloseKH 보조 · descriptor · 선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김)', helper_graph_preset: 'closed-angle-band', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'high', reason_for_change: 'wuTrunkCloseKH로 대체 · 보조 강등' },
    { phase_or_layer: 'windup', variable_key: 'wuDriveHipER', display_name_kr: '뒷고관절 코일', current_visibility: 'hidden', new_visibility: 'coach_auxiliary', role_new: 'auxiliary_layer', coach_label: '와인드업 코일', coach_message: 'wuPelCoil 보조 · descriptor', helper_graph_preset: 'hip-coil-time-series', stick_overlay_preset: 'hipCoil', measurement_confidence: 'high', reason_for_change: 'wuPelCoil로 대체 · 보조 descriptor 강등' },
    { phase_or_layer: 'windup', variable_key: 'hipHinge', display_name_kr: '고관절 접힘 / 위치에너지 준비', current_visibility: 'core35_menu', new_visibility: 'coach_auxiliary', role_new: 'auxiliary_layer', coach_label: '위치에너지 준비', coach_message: 'descriptor · 드라이브 연결', helper_graph_preset: 'COM-height-and-transition', stick_overlay_preset: 'comPath', measurement_confidence: 'medium', reason_for_change: '독립 결함→보조 descriptor' },
    { phase_or_layer: 'windup', variable_key: 'earlyArmRisk', display_name_kr: '팔 조기 준비', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'deferred', coach_label: '—', coach_message: '선수·코치 독립 카드 금지', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: 'deferred · research_only' },
    { phase_or_layer: 'drive', variable_key: 'backHipNet', display_name_kr: '뒷다리 → 골반 순 에너지 전달', current_visibility: 'core35_menu', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '뒷다리 밀어 보내기', coach_message: '로딩 때 골반에서 빠져나간 에너지를 푸시오프로 되돌리는지 · − = 되돌리지 못함', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: '방향 판정 신규(2026-10-11 교수 「C」) · 과제 문구 열림(10-11 교수 「만들어줘」)' },
    { phase_or_layer: 'drive', variable_key: 'backHipPushWork', display_name_kr: '뒷고관절 일 — 푸시오프', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '—', coach_message: '코치 큐 보류 — 크기 판정 신규(기준값 0.96 J/kg · 공개 투수 자료 하위 25% 선) · 큐가 순 에너지 전달 칸(뒷다리 밀어 보내기)과 겹침', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: '크기 판정 신규(2026-10-11 교수 「진행」) · deferred(과제 문구 보류)' },
    { phase_or_layer: 'drive', variable_key: 'backHipTransfer', display_name_kr: '뒷고관절 관절력으로 전달된 일', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '—', coach_message: '코치 큐 보류 — 계산은 몸통 쪽→다리 쪽 유입인데 옛 큐는 위로 전달(에너지 흐름 감사 E1 · 2026-09-29)', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'deferred · 감사 E1(방향 교정 · 계산 무변경)' },
    { phase_or_layer: 'drive', variable_key: 'backKneeTransfer', display_name_kr: '뒷무릎 관절력으로 전달된 일', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '—', coach_message: '코치 큐 보류 — 계산은 몸통 쪽→다리 쪽 유입인데 옛 큐는 위로 전달(에너지 흐름 감사 E1 · 2026-09-29)', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'deferred · 감사 E1(방향 교정 · 계산 무변경)' },
    { phase_or_layer: 'block', variable_key: 'leadHipTransfer', display_name_kr: '앞고관절 관절력으로 전달된 일', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '—', coach_message: '코치 큐 보류 — 계산은 몸통 쪽→다리 쪽 유입인데 옛 큐는 위로 전달(에너지 흐름 감사 E1 · 2026-09-29)', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'deferred · 감사 E1(방향 교정 · 계산 무변경) · 판정 제외(2026-10-11 교수 「진행」 · 브레이크 흡수와 같은 묶음)' },
    { phase_or_layer: 'block', variable_key: 'leadKneeTransfer', display_name_kr: '앞무릎 관절력으로 전달된 일', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '—', coach_message: '코치 큐 보류 — 계산은 몸통 쪽→다리 쪽 유입인데 옛 큐는 위로 전달(에너지 흐름 감사 E1 · 2026-09-29)', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'deferred · 감사 E1(방향 교정 · 계산 무변경) · 판정 제외(2026-10-11 교수 「진행」 · 브레이크 흡수와 같은 묶음)' },
    { phase_or_layer: 'windup', variable_key: 'hssBuildKF', display_name_kr: '골반-몸통 분리 쌓임', current_visibility: 'core35_windup', new_visibility: 'research_only', role_new: 'research_only', coach_label: '—', coach_message: 'x-factor는 드라이브 소유', helper_graph_preset: 'xfactor-time-series', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'medium', reason_for_change: '와인드업 메뉴→드라이브 독립으로 이동' },
    { phase_or_layer: 'drive', variable_key: 'comVelFC', display_name_kr: '전방-하강 드라이브', current_visibility: 'partial', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '전방-하강 드라이브', coach_message: '전진·낙하·FC전방속도 묶음', helper_graph_preset: 'COM-displacement-velocity', stick_overlay_preset: 'comPath', measurement_confidence: 'high', reason_for_change: 'T1 묶음 카드 · 개별 결함 나열 금지' },
    { phase_or_layer: 'drive', variable_key: 'comVDrop', display_name_kr: '수직 낙하', current_visibility: 'hidden', new_visibility: 'coach_main', role_new: 'descriptor', coach_label: '—', coach_message: '전방-하강 하위 proxy', helper_graph_preset: 'COM-displacement-velocity', stick_overlay_preset: 'comPath', measurement_confidence: 'high', reason_for_change: 'comVelFC 카드에 흡수' },
    { phase_or_layer: 'drive', variable_key: 'strideLen', display_name_kr: '방향 이탈', current_visibility: 'core35_stride', new_visibility: 'coach_main', role_new: 'independent', coach_label: '드라이브 방향 이탈', coach_message: '목표선 대비 lateral path', helper_graph_preset: 'lateral-deviation-stride', stick_overlay_preset: 'comPath', measurement_confidence: 'medium', reason_for_change: '보폭 단독→방향 이탈 카드' },
    { phase_or_layer: 'drive', variable_key: 'trkOpenKF', display_name_kr: '몸통 조기개방', current_visibility: 'core35_trunkgen', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '몸통 조기개방', coach_message: 'FC 전 trunk opening', helper_graph_preset: 'trunk-rotation-kh-fc', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'high', reason_for_change: '드라이브 독립 · 몸통과 구분' },
    { phase_or_layer: 'drive', variable_key: 'hssBuildKF', display_name_kr: 'x-factor 형성', current_visibility: 'core35_windup', new_visibility: 'coach_main', role_new: 'independent', coach_label: 'x-factor 형성', coach_message: 'KH→FC 분리 형성', helper_graph_preset: 'xfactor-time-series', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'medium', reason_for_change: '와인드업→드라이브 후반 설명' },
    { phase_or_layer: 'drive', variable_key: 'rearProp', display_name_kr: '뒷발 추진', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'auxiliary_layer', coach_label: '뒷발 추진', coach_message: 'FP QC 통과 시 연구자 참고', helper_graph_preset: 'COM-displacement-velocity', stick_overlay_preset: 'comPath', measurement_confidence: 'medium', reason_for_change: '메인 선택→보조' },
    { phase_or_layer: 'drive', variable_key: 'postureMaint', display_name_kr: '상체 자세 유지', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'research_only', coach_label: '—', coach_message: '연구자 fold', helper_graph_preset: '', stick_overlay_preset: 'trunkLean', measurement_confidence: 'medium', reason_for_change: '메인 선택 제거' },
    { phase_or_layer: 'drive', variable_key: 'strideTime', display_name_kr: '스트라이드 리듬', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'research_only', coach_label: '—', coach_message: '연구자 fold', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: '메인 선택 제거' },
    { phase_or_layer: 'drive', variable_key: 'strideDirection', display_name_kr: '스트라이드 방향', current_visibility: 'core35_stride', new_visibility: 'coach_main', role_new: 'descriptor', coach_label: '—', coach_message: '방향 이탈 보조 · 연구자', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'strideLen(방향 이탈) 카드 보조' },
    { phase_or_layer: 'drive', variable_key: 'leadFootAngleFC', display_name_kr: '착지 발 방향', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'research_only', coach_label: '—', coach_message: '방향 이탈 보조', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: '메인 선택 제거' },
    { phase_or_layer: 'trunk', variable_key: 'xfReleasedPctByFC', display_name_kr: 'FC 전 분리 풀림', current_visibility: 'core35_trunkgen', new_visibility: 'research_fold', role_new: 'descriptor', coach_label: '—', coach_message: 'x-factor 풀림 descriptor 보조', helper_graph_preset: 'xfactor-time-series', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'medium', reason_for_change: 'xfUnwindV와 중복 · descriptor' },
    { phase_or_layer: 'blocking', variable_key: 'kneeCollapse', display_name_kr: '앞다리 버팀 / 무릎 붕괴', current_visibility: 'core35_leadleg', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '앞다리 버팀', coach_message: 'FC→BR 무릎 arc', helper_graph_preset: 'knee-angle-fc-br', stick_overlay_preset: 'kneeAngle', measurement_confidence: 'high', reason_for_change: 'v1 독립 · leadleg 독립 단계 흡수' },
    { phase_or_layer: 'blocking', variable_key: 'lateral_deviation_fc_br', display_name_kr: '방향 누수', current_visibility: 'partial', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '블로킹 방향 누수', coach_message: 'FC→BR COM lateral', helper_graph_preset: 'lateral-deviation-blocking', stick_overlay_preset: 'comPath', measurement_confidence: 'medium', reason_for_change: 'v1 독립 카드' },
    { phase_or_layer: 'blocking', variable_key: 'comVelReductionFCBR', display_name_kr: 'COM 감속', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'independent', coach_label: 'COM 감속', coach_message: 'FC→BR decel', helper_graph_preset: 'com-speed-fc-br', stick_overlay_preset: 'comDecelArrow', measurement_confidence: 'high', reason_for_change: 'v1 제동 입력 · coach copy 정리' },
    { phase_or_layer: 'blocking', variable_key: 'apBrakeImpulse', display_name_kr: '앞발 제동', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'auxiliary_layer', coach_label: '앞발 GRF', coach_message: 'FP2 QC 보조', helper_graph_preset: 'com-speed-fc-br', stick_overlay_preset: 'blocking', measurement_confidence: 'medium', reason_for_change: '독립→보조' },
    { phase_or_layer: 'blocking', variable_key: 'blockRiskPenalty', display_name_kr: '블로킹 위험 penalty', current_visibility: 'core35_menu', new_visibility: 'research_only', role_new: 'research_only', coach_label: '—', coach_message: 'penalty 문구 coach 금지', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '연구자 only' },
    { phase_or_layer: 'blocking', variable_key: 'blockingType', display_name_kr: '블로킹 유형', current_visibility: 'core35_menu', new_visibility: 'research_only', role_new: 'descriptor', coach_label: '—', coach_message: 'type_context coach 금지', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'descriptor only' },
    { phase_or_layer: 'blocking', variable_key: 'vgrfRetain', display_name_kr: '앞다리 지지 유지', current_visibility: 'core35_menu', new_visibility: 'coach_auxiliary', role_new: 'auxiliary_layer', coach_label: '수직 GRF 유지', coach_message: 'fallback coach 금지', helper_graph_preset: '', stick_overlay_preset: 'blocking', measurement_confidence: 'medium', reason_for_change: 'fallback 라벨 제거·보조' },
    { phase_or_layer: 'blocking', variable_key: 'leadVGRFImpulse', display_name_kr: '앞발 수직 지지', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'auxiliary_layer', coach_label: '앞발 GRF', coach_message: '블로킹 하위 상세', helper_graph_preset: '', stick_overlay_preset: 'blocking', measurement_confidence: 'medium', reason_for_change: 'leadleg fold' },
    { phase_or_layer: 'blocking', variable_key: 'leadKneeFlexFC', display_name_kr: '착지 무릎 굴곡', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'auxiliary_layer', coach_label: '앞무릎 상세', coach_message: '블로킹 하위 · 독립 단계 금지', helper_graph_preset: 'knee-angle-fc-br', stick_overlay_preset: 'kneeAngle', measurement_confidence: 'high', reason_for_change: 'leadKnee 독립→하위' },
    { phase_or_layer: 'blocking', variable_key: 'leadKneeFlexionBR', display_name_kr: '릴리스 무릎 굴곡', current_visibility: 'core35_menu', new_visibility: 'coach_auxiliary', role_new: 'auxiliary_layer', coach_label: '앞무릎 상세', coach_message: '블로킹 하위', helper_graph_preset: 'knee-angle-fc-br', stick_overlay_preset: 'kneeAngle', measurement_confidence: 'high', reason_for_change: 'leadKnee 독립→하위' },
    { phase_or_layer: 'blocking', variable_key: 'leadKneeExtROM', display_name_kr: '무릎 전략', current_visibility: 'core35_menu', new_visibility: 'coach_main', role_new: 'descriptor', coach_label: '앞다리 전략', coach_message: 'descriptor', helper_graph_preset: 'knee-angle-fc-br', stick_overlay_preset: 'kneeAngle', measurement_confidence: 'medium', reason_for_change: 'descriptor' },
    { phase_or_layer: 'trunk', variable_key: 'torsoRotV', display_name_kr: '몸통 회전 생성', current_visibility: 'core35_menu', new_visibility: 'coach_independent', role_new: 'independent', coach_label: '몸통 회전 생성', coach_message: '유일 독립 판정 · 선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김)', helper_graph_preset: 'trunk-rotation-velocity-time-series', stick_overlay_preset: 'thoraxRot', measurement_confidence: 'high', reason_for_change: 'v1 단일 독립 축' },
    { phase_or_layer: 'trunk', variable_key: 'xfUnwindV', display_name_kr: 'x-factor 풀림', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: 'x-factor 풀림', coach_message: 'descriptor chart only', helper_graph_preset: 'xfactor-time-series', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'medium', reason_for_change: '독립→descriptor' },
    { phase_or_layer: 'trunk', variable_key: 'trunkLatV', display_name_kr: '몸통 좌우 기울기 속도', current_visibility: 'core35_menu', new_visibility: 'coach_load_warning', role_new: 'auxiliary_layer', coach_label: '몸통 측굴·기울기', coach_message: '부하 경고 · trunkLat(signed) coach 금지', helper_graph_preset: 'trunk-lean-delta', stick_overlay_preset: 'trunkLat', measurement_confidence: 'medium', reason_for_change: '핵심 진단→부하 경고' },
    { phase_or_layer: 'trunk', variable_key: 'ppTrunkHum', display_name_kr: '몸통-팔 타이밍', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '몸통→팔 타이밍', coach_message: '코치 큐 보류 — 분절 에너지 변화율 정점 시간차는 어깨를 건너는 전달 시점이 아님(에너지 흐름 감사 E4 · 2026-09-29)', helper_graph_preset: 'trunk-arm-timing-lollipop', stick_overlay_preset: 'timing', measurement_confidence: 'medium', reason_for_change: 'deferred · 감사 E4(이름·큐 교정 · 계산 무변경)' },
    { phase_or_layer: 'trunk', variable_key: 'armTransferRatio', display_name_kr: '몸통→팔 전달', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'research_only', coach_label: '—', coach_message: '연구자 후보', helper_graph_preset: 'trunk-arm-timing-lollipop', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'low', reason_for_change: '연구자 fold' },
    { phase_or_layer: 'trunk', variable_key: 'trunkME', display_name_kr: '몸통 에너지', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'research_only', coach_label: '—', coach_message: '연구자', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: '메인 제거' },
    { phase_or_layer: 'trunk', variable_key: 'hssFC', display_name_kr: 'FC 분리각', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'descriptor', coach_label: '—', coach_message: 'x-factor 보조', helper_graph_preset: 'xfactor-time-series', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'medium', reason_for_change: 'descriptor' },
    { phase_or_layer: 'trunk', variable_key: 'openAng', display_name_kr: '몸통 조기 열림', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'research_only', coach_label: '—', coach_message: '드라이브 trkOpenKF와 구분', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'medium', reason_for_change: 'research' },
    { phase_or_layer: 'trunk', variable_key: 'trkOpenKF', display_name_kr: 'KH~FC 몸통 열림', current_visibility: 'core35_trunkgen', new_visibility: 'research_only', role_new: 'cross_link', coach_label: '—', coach_message: '드라이브 소유', helper_graph_preset: 'trunk-rotation-kh-fc', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'high', reason_for_change: '몸통 메뉴→드라이브' },
    { phase_or_layer: 'arm', variable_key: 'merPk', display_name_kr: 'MER 저장·방출 준비', current_visibility: 'partial', new_visibility: 'coach_independent', role_new: 'independent', coach_label: 'MER 저장·방출', coach_message: '유일 독립 판정', helper_graph_preset: 'mer-angle-band', stick_overlay_preset: 'armSlot', measurement_confidence: 'high', reason_for_change: 'v1 단일 독립' },
    { phase_or_layer: 'arm', variable_key: 'ppTrunkHum', display_name_kr: '몸통→팔 타이밍', current_visibility: 'core35_menu', new_visibility: 'coach_cross_link', role_new: 'deferred', coach_label: '몸통→팔 타이밍', coach_message: '코치 큐 보류 — 분절 에너지 변화율 정점 시간차는 어깨를 건너는 전달 시점이 아님(에너지 흐름 감사 E4 · 2026-09-29)', helper_graph_preset: 'trunk-arm-timing-lollipop', stick_overlay_preset: 'timing', measurement_confidence: 'medium', reason_for_change: 'deferred · 감사 E4(이름·큐 교정 · 계산 무변경)' },
    { phase_or_layer: 'arm', variable_key: 'armRotV', display_name_kr: '팔 회전속도', current_visibility: 'core35_menu', new_visibility: 'research_only', role_new: 'research_only', coach_label: '출력 참고', coach_message: 'IR 속도 · 교정 cue 금지', helper_graph_preset: '', stick_overlay_preset: 'armLoad', measurement_confidence: 'medium', reason_for_change: '독립 결함 카드 제거' },
    { phase_or_layer: 'arm', variable_key: 'handSpeed', display_name_kr: '손 속도', current_visibility: 'partial', new_visibility: 'research_only', role_new: 'research_only', coach_label: '—', coach_message: 'low confidence', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: 'coach 독립 금지' },
    { phase_or_layer: 'arm', variable_key: 'forearmRot', display_name_kr: '전완 회전', current_visibility: 'hidden', new_visibility: 'research_only', role_new: 'research_only', coach_label: '—', coach_message: 'low confidence', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: 'coach 독립 금지' },
    { phase_or_layer: 'arm', variable_key: 'humME', display_name_kr: '팔 에너지', current_visibility: 'core35_menu', new_visibility: 'load_layer', role_new: 'auxiliary_layer', coach_label: '부하 모니터링', coach_message: 'load cost · 결함 아님', helper_graph_preset: 'load-time-series', stick_overlay_preset: 'armLoad', measurement_confidence: 'medium', reason_for_change: '부하 레이어' },
    { phase_or_layer: 'arm', variable_key: 'shGen', display_name_kr: '어깨 부하', current_visibility: 'partial', new_visibility: 'coach_main', role_new: 'auxiliary_layer', coach_label: '어깨 부하', coach_message: 'load layer', helper_graph_preset: 'arm-load-context', stick_overlay_preset: 'armLoad', measurement_confidence: 'low', reason_for_change: '부하 레이어' },
    { phase_or_layer: 'arm', variable_key: 'elbAbs', display_name_kr: '팔꿈치 부하', current_visibility: 'partial', new_visibility: 'coach_main', role_new: 'research_only', coach_label: '—', coach_message: 'elbow load coach 금지', helper_graph_preset: 'arm-load-context', stick_overlay_preset: 'armLoad', measurement_confidence: 'low', reason_for_change: '연구/부하 only' },
    { phase_or_layer: 'arm', variable_key: 'scapLoad', display_name_kr: '견갑 부하', current_visibility: 'partial', new_visibility: 'coach_main', role_new: 'research_only', coach_label: '—', coach_message: '연구 only', helper_graph_preset: 'arm-load-context', stick_overlay_preset: 'armLoad', measurement_confidence: 'low', reason_for_change: '연구 only' },
    { phase_or_layer: 'arm', variable_key: 'armSlot', display_name_kr: '암슬롯', current_visibility: 'core35_menu', new_visibility: 'research_fold', role_new: 'research_only', coach_label: '—', coach_message: '연구자', helper_graph_preset: '', stick_overlay_preset: 'armSlot', measurement_confidence: 'high', reason_for_change: 'MER 외 메인 제거' },
    { phase_or_layer: 'consistency', variable_key: 'relTimingCvPct', display_name_kr: '릴리스 타이밍 반복성', current_visibility: 'core35_menu', new_visibility: 'consistency_layer', role_new: 'auxiliary_layer', coach_label: '실행 신뢰성', coach_message: '일관성 보조 · 키네틱 결함 아님', helper_graph_preset: 'variability-band', stick_overlay_preset: 'consistency', measurement_confidence: 'high', reason_for_change: '일관성 auxiliary · mech6 본체 미합산' },
    { phase_or_layer: 'consistency', variable_key: 'releaseSdMm', display_name_kr: '릴리스 위치 흔들림', current_visibility: 'core35_menu', new_visibility: 'consistency_layer', role_new: 'descriptor', coach_label: '제구 안정성', coach_message: '일관성', helper_graph_preset: 'variability-band', stick_overlay_preset: 'handPath', measurement_confidence: 'medium', reason_for_change: '일관성 레이어' },
    { phase_or_layer: 'consistency', variable_key: 'armSlotSdDeg', display_name_kr: '암슬롯 반복성', current_visibility: 'core35_menu', new_visibility: 'consistency_layer', role_new: 'descriptor', coach_label: '반복성', coach_message: '일관성', helper_graph_preset: 'variability-band', stick_overlay_preset: 'consistency', measurement_confidence: 'medium', reason_for_change: '일관성 레이어' },
    { phase_or_layer: 'consistency', variable_key: 'strideLenCV', display_name_kr: '보폭 반복성', current_visibility: 'core35_menu', new_visibility: 'consistency_layer', role_new: 'descriptor', coach_label: '스트라이드 일관성', coach_message: '일관성', helper_graph_preset: 'variability-band', stick_overlay_preset: 'consistency', measurement_confidence: 'medium', reason_for_change: '일관성 레이어' },
    { phase_or_layer: 'load', variable_key: 'humME', display_name_kr: '부하 · 비용 모니터링', current_visibility: 'load_badge', new_visibility: 'load_layer', role_new: 'auxiliary_layer', coach_label: '비용 모니터링', coach_message: '정상범위/추가확인/부하신호상승/재검증필요', helper_graph_preset: 'load-time-series', stick_overlay_preset: 'armLoad', measurement_confidence: 'medium', reason_for_change: '우수/결함 금지' },
    { phase_or_layer: 'fitness', variable_key: 'capacity', display_name_kr: '체력 capacity', current_visibility: 'hpa_tab', new_visibility: 'fitness_reference', role_new: 'descriptor', coach_label: '체력 참고', coach_message: '상동고 16명 · 단정 금지', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'high', reason_for_change: 'capacity descriptor' },
    { phase_or_layer: 'visual_aid', variable_key: 'comPath', display_name_kr: 'COM 경로', current_visibility: 'overlay_menu', new_visibility: 'visual_aid_only', role_new: 'visual_aid_only', coach_label: 'COM 경로', coach_message: '진단 변인 아님', helper_graph_preset: '', stick_overlay_preset: 'comPath', measurement_confidence: 'n/a', reason_for_change: '보기 보조 분리' },
    { phase_or_layer: 'visual_aid', variable_key: 'handPath', display_name_kr: '손 경로', current_visibility: 'overlay_menu', new_visibility: 'visual_aid_only', role_new: 'visual_aid_only', coach_label: '손 경로', coach_message: '진단 변인 아님', helper_graph_preset: '', stick_overlay_preset: 'handPath', measurement_confidence: 'n/a', reason_for_change: '보기 보조 분리' },
    { phase_or_layer: 'visual_aid', variable_key: 'pelvisSho', display_name_kr: '골반·어깨선', current_visibility: 'overlay_menu', new_visibility: 'visual_aid_only', role_new: 'visual_aid_only', coach_label: '골반·어깨선', coach_message: '진단 변인 아님', helper_graph_preset: '', stick_overlay_preset: 'pelvisSho', measurement_confidence: 'n/a', reason_for_change: '보기 보조 분리' },
    { phase_or_layer: 'visual_aid', variable_key: 'trunkLean', display_name_kr: '몸통축', current_visibility: 'overlay_menu', new_visibility: 'visual_aid_only', role_new: 'visual_aid_only', coach_label: '몸통축', coach_message: '진단 변인 아님', helper_graph_preset: '', stick_overlay_preset: 'trunkLean', measurement_confidence: 'n/a', reason_for_change: '보기 보조 분리' },
    { phase_or_layer: 'visual_aid', variable_key: 'blocking', display_name_kr: '블로킹 보조', current_visibility: 'overlay_menu', new_visibility: 'visual_aid_only', role_new: 'visual_aid_only', coach_label: '블로킹 보조', coach_message: '진단 변인 아님', helper_graph_preset: '', stick_overlay_preset: 'blocking', measurement_confidence: 'n/a', reason_for_change: '보기 보조 분리' },
    { phase_or_layer: 'visual_aid', variable_key: 'kneeAngle', display_name_kr: '무릎각', current_visibility: 'overlay_menu', new_visibility: 'visual_aid_only', role_new: 'visual_aid_only', coach_label: '무릎각', coach_message: '진단 변인 아님', helper_graph_preset: '', stick_overlay_preset: 'kneeAngle', measurement_confidence: 'n/a', reason_for_change: '보기 보조 분리' },
    { phase_or_layer: 'windup', variable_key: 'freeMo', display_name_kr: '뒷발 지면반력 꼬임 토크', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '뒷발 지면반력 꼬임 토크', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 부호(좌투)·창 정의 의심 — 손잡이 부호 정규화 없음', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' },
    { phase_or_layer: 'windup', variable_key: 'wuCoilTq', display_name_kr: '축발 비트는 힘', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '축발 비트는 힘', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 와인드업 코일은 구속과 무관(대시보드 꼬리표) · 코일 방향 판정 확인 전', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' },
    { phase_or_layer: 'windup', variable_key: 'pelClose', display_name_kr: '골반 닫힘각(코일)', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '골반 닫힘각(코일)', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 같은 이름의 두 양(감긴 양 · 실험실 방향각) — 이름·정의 정리 전', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' },
    { phase_or_layer: 'windup', variable_key: 'wuHSSbuild', display_name_kr: '비틀림 쌓인 양', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '비틀림 쌓인 양', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 엘리트도 거의 0 · 차이가 마커리스 축회전 정밀도보다 작음', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' },
    { phase_or_layer: 'trunk', variable_key: 'whipRatio', display_name_kr: '팔 채찍 효과', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '팔 채찍 효과', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 손 분절 국소 X축 ÷ 몸통 축회전 · 릴리스 뒤 0.1초 포함 · 범위형인데 선수 문구 한 방향', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' },
    { phase_or_layer: 'trunk', variable_key: 'pelvisRotV', display_name_kr: '골반 회전 속도', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '골반 회전 속도', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 타고난 체격 성분 · 매 투구 레버 아님(08-14)', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' },
    { phase_or_layer: 'blocking', variable_key: 'kneeExtROM', display_name_kr: '앞무릎 펴짐 범위', current_visibility: 'core35_menu', new_visibility: 'coach_descriptor', role_new: 'descriptor', coach_label: '앞무릎 펴짐 범위', coach_message: '선수 과제 근거 금지(2026-10-02 KBO 검증 감사 · 정의·좌표 의심 — 값은 화면에 남김) · 유형을 같은 값으로 다시 판정하는 순환 · 관절각 채점 금지', helper_graph_preset: '', stick_overlay_preset: '', measurement_confidence: 'low', reason_for_change: '2026-10-02 교수 결정 · 선수 과제 근거에서 뺌(값 표시는 유지)' }
  ];

  var CANDIDATE_REVIEW = [
    { key: 'pelvisTrunkGapMs', note: 'cross-link 승격 조건 · GPT/교수', needs_review: true },
    { key: 'predVelGap', note: '체력 descriptor 분리 · GPT', needs_review: true },
    { key: 'direction_deviation', note: 'strideLen proxy SSOT · GPT', needs_review: true },
    { key: 'com_braking_fc_br', note: 'comVelReductionFCBR proxy · GPT', needs_review: true },
    { key: 'lead_knee_flexion_change_fc_br', note: 'kneeCollapse proxy · GPT', needs_review: true },
    { key: 'shoulder_mer_angle', note: 'merPk proxy · GPT', needs_review: true },
    { key: 'freeMo', note: 'FP QC · research fold · professor', needs_review: true },
    { key: 'propImpPct', note: 'FP QC · research fold · professor', needs_review: true }
  ];

  /** Q4–Q7 교수님 회신 반영 · Q2/Q3 승격·강등 완료 */
  var REVIEW_PENDING = [
    { variable_key: 'earlyArmRisk', issue: 'deferred vs research_only', needs_professor_review: true, needs_gpt_review: false },
    { variable_key: 'lateral_deviation_fc_br', issue: 'Core35 편입 여부(슬롯) — agenda only', needs_professor_review: true, needs_gpt_review: true }
  ];

  var KEY_INDEX = {};
  ROWS.forEach(function (r) {
    if (r.variable_key && !KEY_INDEX[r.variable_key]) KEY_INDEX[r.variable_key] = r;
  });

  var MENU_GROUPS = [
    { id: 'summary', label: '오늘의 요약', keys: [] },
    { id: 'windup', label: '와인드업', keys: ['wuPelVel', 'wuPelCoil', 'wuTrunkCloseKH'] },
    { id: 'windup_aux', label: '와인드업 · 보조', keys: ['hipHinge', 'wuPelCloseKH', 'wuDriveHipER'] },
    { id: 'drive', label: '드라이브', keys: ['comVelFC', 'trkOpenKF', 'hssBuildKF', 'strideLen'] },
    { id: 'drive_aux', label: '드라이브 · 보조', keys: ['rearProp'] },
    { id: 'blocking', label: '블로킹', keys: ['kneeCollapse', 'lateral_deviation_fc_br', 'comVelReductionFCBR'] },
    { id: 'blocking_aux', label: '블로킹 · 보조', keys: ['leadKneeFlexFC', 'leadKneeFlexionBR', 'leadVGRFImpulse', 'vgrfRetain', 'apBrakeImpulse'] },
    { id: 'trunk', label: '몸통', keys: ['torsoRotV'] },
    { id: 'trunk_aux', label: '몸통 · 보조', keys: ['xfUnwindV', 'trunkLatV', 'ppTrunkHum'] },
    { id: 'arm', label: '팔 전달·방출', keys: ['merPk'] },
    { id: 'arm_aux', label: '팔 · 연결/출력', keys: ['ppTrunkHum'] },
    { id: 'consistency', label: '제구/일관성', keys: ['relTimingCvPct', 'releaseSdMm', 'armSlotSdDeg', 'strideLenCV'] },
    { id: 'load', label: '부하', keys: ['humME', 'shGen'] },
    { id: 'research', label: '연구자 참고 (접기)', keys: ['blockRiskPenalty', 'blockingType', 'earlyArmRisk', 'armRotV', 'handSpeed', 'armTransferRatio', 'postureMaint', 'strideTime', 'leadFootAngleFC', 'armSlot', 'trunkME', 'openAng'] }
  ];

  var PHASE_INDEPENDENT = {
    windup: ['wuPelVel', 'wuPelCoil', 'wuTrunkCloseKH'],
    drive: ['comVelFC', 'trkOpenKF', 'hssBuildKF', 'strideLen'],
    stride: ['comVelFC', 'trkOpenKF', 'hssBuildKF', 'strideLen'],
    block: ['kneeCollapse', 'lateral_deviation_fc_br', 'comVelReductionFCBR'],
    blocking: ['kneeCollapse', 'lateral_deviation_fc_br', 'comVelReductionFCBR'],
    knee: ['kneeCollapse', 'lateral_deviation_fc_br', 'comVelReductionFCBR'],
    trunk: ['torsoRotV'],
    storage: ['torsoRotV'],
    release: ['torsoRotV'],
    arm: ['merPk']
  };

  function roleForKey(key) {
    var r = KEY_INDEX[key];
    return r ? r.role_new : null;
  }

  function isCoachMenuKey(key) {
    if (!key) return false;
    var role = roleForKey(key);
    if (role === 'visual_aid_only' || role === 'deferred' || role === 'research_only') return false;
    if (role === 'independent' || role === 'auxiliary_layer' || role === 'cross_link' || role === 'descriptor') return true;
    try {
      if (typeof CORE35_VAR_GROUPS !== 'undefined' && CORE35_VAR_GROUPS.isCore35) return CORE35_VAR_GROUPS.isCore35(key);
    } catch (e) {}
    return false;
  }

  function isCoachIndependentKey(key) {
    return roleForKey(key) === 'independent';
  }

  function isFieldFeedbackKey(key) {
    return isCoachIndependentKey(key);
  }

  function isMechanismSupportKey(key) {
    var role = roleForKey(key);
    return role === 'descriptor' || role === 'cross_link' || role === 'auxiliary_layer';
  }

  function isCoachHiddenFromPlayer(key) {
    var role = roleForKey(key);
    return role === 'research_only' || role === 'deferred';
  }

  function isVisualAidKey(key) {
    return roleForKey(key) === 'visual_aid_only';
  }

  function fieldFeedbackKeys() {
    return ROWS.filter(function (r) { return r.role_new === 'independent'; }).map(function (r) { return r.variable_key; });
  }

  function mechanismSupportKeysForPhase(phaseKey) {
    if (!phaseKey) return [];
    var pk = phaseKey === 'stride' ? 'drive' : (phaseKey === 'blocking' || phaseKey === 'block' || phaseKey === 'knee' ? 'blocking' : phaseKey);
    var layerMap = { windup: 'windup', drive: 'drive', stride: 'drive', block: 'blocking', blocking: 'blocking', knee: 'blocking', trunk: 'trunk', storage: 'trunk', release: 'trunk', arm: 'arm', consistency: 'consistency', load: 'load' };
    var layer = layerMap[pk] || pk;
    return ROWS.filter(function (r) {
      if (!isMechanismSupportKey(r.variable_key)) return false;
      if (r.phase_or_layer === layer) return true;
      if (r.variable_key === 'ppTrunkHum' && (layer === 'arm' || layer === 'trunk')) return true;
      return false;
    }).map(function (r) { return r.variable_key; });
  }

  function isCoachFoldKey(key) {
    return isMechanismSupportKey(key);
  }

  function isCoachBlockedFromMainNav(key) {
    var role = roleForKey(key);
    if (!role) return false;
    if (role === 'research_only' || role === 'deferred' || role === 'visual_aid_only') return true;
    if (role === 'auxiliary_layer' || role === 'cross_link' || role === 'descriptor') return false;
    if (role === 'independent') return false;
    return false;
  }

  function independentKeysForPhase(phaseKey) {
    if (!phaseKey) return [];
    var pk = phaseKey === 'stride' ? 'drive' : (phaseKey === 'blocking' ? 'block' : phaseKey);
    return (PHASE_INDEPENDENT[pk] || PHASE_INDEPENDENT[phaseKey] || []).slice();
  }

  function foldKeysForPhase(phaseKey) {
    var gids = {
      windup: ['windup_aux', 'research'],
      drive: ['drive_aux', 'research'],
      stride: ['drive_aux', 'research'],
      block: ['blocking_aux', 'research'],
      blocking: ['blocking_aux', 'research'],
      knee: ['blocking_aux', 'research'],
      trunk: ['trunk_aux', 'research'],
      arm: ['arm_aux', 'research']
    };
    var ids = gids[phaseKey] || gids.drive || [];
    var keys = [];
    MENU_GROUPS.forEach(function (g) {
      if (ids.indexOf(g.id) < 0) return;
      (g.keys || []).forEach(function (k) {
        if (keys.indexOf(k) < 0 && isCoachFoldKey(k)) keys.push(k);
      });
    });
    return keys;
  }

  function menuGroups() {
    return MENU_GROUPS.filter(function (g) { return g.keys && g.keys.length; });
  }

  function coachLabelForKey(key) {
    var r = KEY_INDEX[key];
    if (r && r.coach_label && r.coach_label !== '—') return r.coach_label;
    try {
      if (typeof CORE35_VAR_GROUPS !== 'undefined' && CORE35_VAR_GROUPS.coachLabel) {
        var lb = CORE35_VAR_GROUPS.coachLabel(key);
        if (lb) return lb;
      }
    } catch (e) {}
    return key;
  }

  function helperGraphForKey(key) {
    var r = KEY_INDEX[key];
    if (r && r.helper_graph_preset) return r.helper_graph_preset;
    if (typeof COACH_HELPER_EXPECTED !== 'undefined' && COACH_HELPER_EXPECTED[key]) return COACH_HELPER_EXPECTED[key];
    return null;
  }

  function exportRows() {
    return ROWS.slice();
  }

  function auditCoachSelection() {
    var missing = [];
    ROWS.forEach(function (r) {
      if (r.role_new !== 'independent') return;
      if (!r.helper_graph_preset && r.phase_or_layer !== 'summary' && r.phase_or_layer !== 'fitness') {
        if (r.variable_key !== 'lateral_deviation_fc_br') missing.push(r.variable_key);
      }
    });
    return {
      selectedCoachVariableCount: ROWS.filter(function (r) { return r.role_new === 'independent'; }).length,
      visualAidOnlyCount: VISUAL_AIDS.length,
      researchOnlyCount: ROWS.filter(function (r) { return r.role_new === 'research_only' || r.role_new === 'deferred'; }).length,
      independentCoachVariableCount: ROWS.filter(function (r) { return r.role_new === 'independent' && r.phase_or_layer !== 'summary'; }).length,
      helperGraphMissingCount: missing.length,
      helperGraphMissingKeys: missing,
      candidateReviewCount: CANDIDATE_REVIEW.length,
      core35Reselection: false,
      protectedLogicChanged: false
    };
  }

  root.COACH_FIELD_V3 = {
    ROLES: ROLES,
    ROWS: ROWS,
    VISUAL_AIDS: VISUAL_AIDS,
    MENU_GROUPS: MENU_GROUPS,
    CANDIDATE_REVIEW: CANDIDATE_REVIEW,
    REVIEW_PENDING: REVIEW_PENDING,
    roleForKey: roleForKey,
    isCoachMenuKey: isCoachMenuKey,
    isCoachIndependentKey: isCoachIndependentKey,
    isFieldFeedbackKey: isFieldFeedbackKey,
    isMechanismSupportKey: isMechanismSupportKey,
    isCoachHiddenFromPlayer: isCoachHiddenFromPlayer,
    isVisualAidKey: isVisualAidKey,
    fieldFeedbackKeys: fieldFeedbackKeys,
    mechanismSupportKeysForPhase: mechanismSupportKeysForPhase,
    isCoachFoldKey: isCoachFoldKey,
    isCoachBlockedFromMainNav: isCoachBlockedFromMainNav,
    independentKeysForPhase: independentKeysForPhase,
    foldKeysForPhase: foldKeysForPhase,
    menuGroups: menuGroups,
    coachLabelForKey: coachLabelForKey,
    helperGraphForKey: helperGraphForKey,
    exportRows: exportRows,
    auditCoachSelection: auditCoachSelection
  };
})(typeof window !== 'undefined' ? window : globalThis);
