# hipHinge 정의 변경 실행 지침 (2026-07-07 · 교수 확정)

## 결정
- **새 정의**: hipHinge = 축발 고관절 시상면 각(`Back_Hip_Angle_X`)의 **니하이(KH)~앞발착지(FC) 직전 = 드라이브 구간 최댓값**.
  - 현행: `phases.js:88` `peak(S.Back_Hip_Angle_X, 0, ikl, false).v` (시작~KH).
  - 변경: `peak(S.Back_Hip_Angle_X, ikl, ifc, false).v` (KH~FC).  ※ifc는 line40에서 이미 정의됨.
- **방침**: 밴드 재산출 + 채점 유지(교수).

## 재산출된 엘리트 밴드 (검증 완료)
- 원본: `~/Desktop/2026/2026 연구/Normative_data.zip` (elite20 raw c3d.txt, n=20).
- 방법: Theia 엔진(`src/modules/extract_theia.js`+`parse_c3dtxt.js`) 헤드리스, 20명×trial mean 집계 → 코호트 IQR.
- **검증**: 옛 구간[0,KH] 재현 = p25 19.4 / med 25.8 / p75 34.7 ≈ 라이브 n=28(16.8/25.25/35.58) 중앙값 일치 → 방법론·소스 검증됨.
- **★새 구간[KH,FC) 밴드 = p25 67.0 / med 69.5 / p75 74.2° (n=20, dir:1)**.
- KU 10명(~65~78°·평균 70.4°) 밴드 내 정합.
- 재현 스크립트: 세션 scratchpad `norm/` (하네스 로직은 memory `ku-theia-vardoc-def-calc-ssot` 참조).

## 실행 편집 (베이크 머신)
1. **계산 구간**: `pitching/dashboard_core/phases.js:88` → `ikl, ifc`.  ⚠공유 엔진 = 일반 Theia에도 적용(전역 변경). KU만 원하면 대신 `2_bake_finalize.js`에서 hipHinge val 오버라이드(strideLen 패턴, line57 모방)로 격리.
2. **밴드**: `pitch_norms.js`의 `hipHinge:{p25:16.8,med:25.25,p75:35.575,n:28}` → `{p25:67.0,med:69.5,p75:74.2,n:20}`. 동일하게 `netlify_통합배포/pitching/theia/dashboard/데이터/integ01_dynamic_players.js` `_NB_BAKED.hipHinge` (+ korea 페이지가 읽는 소스) 갱신.  ※렌더 밴드=`NORM_BANDS[key]+val` 런타임 계산이므로 baked pos 불필요.
3. **점수 앵커**: `phases.js:444` `sc(B.hipHinge, 26.9, 15.7, 1)` → 새 중앙/스프레드로 recenter (예 `sc(B.hipHinge, 69.5, 7.2, 1)`), 또는 range형이므로 `_scRk(B.hipHinge,'hipHinge')`(scR IQR)로 전환 검토.
4. **재베이크**: KU players.js (원본 `/private/tmp/ku_theia/data`) + 전역 변경 시 일반 Theia dashboard players.js도.
5. **vardoc**: `korea/데이터/vardoc.js` hipHinge def/calc = 이미 새 정의로 갱신 완료(이 머신).
6. **검증**: 재베이크 후 hipHinge 값(~70°)이 새 밴드 안에서 '적정' 판정되는지, KU 10명 슬라이더 마커 정합 확인. 배포=`deploy_ku_korea_only.py`.

## 스코프 미결
- 밴드(`NORM_BANDS`)가 공유라 KU만 격리 불가 → 이 변경이 **일반 Theia 대시보드에도 적용되는 전역 결정인지** 교수 확인 필요. KU 전용 유지 시 KU 전용 밴드 오버라이드 경로(korea 페이지 로컬 NORM_BANDS 패치) 설계 필요.
