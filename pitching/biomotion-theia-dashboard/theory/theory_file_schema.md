# theory_file_schema.md — 분석 이론 메뉴 파일 스키마

> 사용자 제공 Markdown/CSV 교체 시 대시보드 `분석 이론` 탭에 자동 반영.  
> 앱 소스: `pitching/biomotion-theia-dashboard/theory/` · 핸드오버 복사본: `_handover/theory/`

## Markdown — `biomotion_kinetic_chain_theory.md`

- UTF-8 텍스트
- 표준 Markdown (제목 `#`~`###`, 목록, 굵게, 코드)
- Cursor/에이전트가 이론 본문을 **임의 작성하지 않음** — 사용자 문서로 교체

## CSV — `variable_kinetic_chain_map.csv`

필수 헤더(순서 권장):

| 컬럼 | 설명 |
|------|------|
| phase | 와인드업 / 드라이브 / 블로킹 / 앞무릎 전달 / 몸통 / 팔 / 부하 / 일관성 / 체력 연결 |
| sub_phase | 예: 와인드업-꼬임, 블로킹-제동 |
| chain_intent | 단계 키네틱 체인상 의도 |
| diagnostic_question | 진단 질문 |
| mechanic_concept | 꼬임, COM 전환, 제동 등 |
| variable_key | 코드/DB 변수명 |
| display_name_kr | 화면 표시명 |
| variable_role | 현상 확인 / 원인 추정 / 결과 / 보상 / 반복성 / 체력 연결 |
| energy_role | 저장 / 생성 / 전달 / 방출 / 부하 / 품질 |
| interpretation_high | 값이 높을 때 |
| interpretation_low | 값이 낮을 때 |
| failure_pattern | 실패·누수 패턴 |
| coach_message_candidate | 선수·코치 메시지 초안 |
| researcher_interpretation | 연구자용 해석 |
| recommended_visualization | Stick 측면, COM path 등 |
| stick_overlay | overlay 키 |
| helper_graph | time-series 등 |
| coach_visible | TRUE/FALSE |
| researcher_visible | TRUE/FALSE |
| priority_status | 필수 / 후보 / 연구자용 / 보류 / 제외 |
| notes | 메모 |

## 빌드 반영

1. `theory/` 파일 수정
2. `python3 build.py` 실행 → `index.html` 및 리포트 번들에 임베드

## Fallback

파일 없음/비어 있음 → 탭 UI는 유지, 안내 문구만 표시 (앱 크래시 없음)
