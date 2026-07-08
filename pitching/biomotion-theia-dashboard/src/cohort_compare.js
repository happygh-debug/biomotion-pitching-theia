/* 코호트(상동고 등) 선수 간 비교용 슬림 데이터.
 * 이 파일은 비어 있어도 됩니다(비교 대상이 없으면 리포트가 저장된/클라우드 선수로만 비교).
 * Normative_data 가 읽히는 PC에서 아래 명령으로 자동 생성하세요:
 *   node gen_cohort_compare.js
 * 그러면 window.__COHORT_COMPARE 에 21명(자기 제외)의 슬림 비교 데이터가 채워집니다.
 * 분석 리포트는 DATA._compare(저장 선수) → 없으면 window.__COHORT_COMPARE 순으로 비교 대상을 찾습니다. */
window.__COHORT_COMPARE = window.__COHORT_COMPARE || [];
