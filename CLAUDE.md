# CLAUDE.md — 테이아 투수 대시보드 (단독 트랙 repo)

## 이 repo의 정체 (가장 먼저 읽을 것)

- 이 repo는 **테이아(정밀 마커리스 광학·Qualisys) 투수** 대시보드 **전용**이다. 4트랙 완전 분리 체계(테이아투수·업리프트투수·업리프트타격·테이아타격 = 각각 별도 repo)의 하나.
- 라이브 경로: `sports.biomotion.kr/pitching/theia/dashboard/`(전체 선수) · `/pitching/theia/korea/`(고려대 전용).
- 구성: `pitching/biomotion-theia-dashboard/`(대시보드+`_ku_theia_bake/` 베이크) + **`pitching/dashboard_core/`(산식 SSOT — mech5·phases·pitch_norms·etdiag, shell.html이 `../../dashboard_core/` INCLUDE)** + `netlify_통합배포/pitching/theia/`(스테이징=배포 소스·추적됨).
- 소스 기준: 구 모노레포 `feat/pitching-track-isolation-oom-fix` 팁(6fcf422·2026-07-08). 구 모노레포는 **읽기 전용 아카이브**(과거 apply_* 패치 이력 포함).

## ★시스템 오염 금지 — Uplift 로직 반입 금지 (교수 강한 교정 2026-06-20)

이 트랙은 **Theia(정밀)** 시스템이다. **에너지 흐름 분석이 이 시스템의 핵심이며, Uplift 논리·문서를 참조·이식하지 말 것**(교수 지시). 같은 변인 이름이라도 정의·좌표계·신뢰도가 다르다:

1. **카이랄리티(좌우)**: 이 시스템의 베이크는 canonical **왼손계**라 렌더에서 `mirrorX(x)=-x`가 정답(CHIRALITY-ROOT-FIX·KU 10/10 검증). **반대로 이 수정을 Uplift 뷰어에 이식하면 거울상이 생긴다** — 시스템 간 전파 금지. 새 뷰어·좌우 수정은 렌더공간 해부학(F×U) 수학검증 필수(거울불변량 검증은 거울상을 못 잡는다).
2. **규준**: `dashboard_core/pitch_norms.js`=수동 발행 전용·런타임 자동갱신 OFF(점수 폭등 회귀 이력). 발행 후 전수비교. Uplift 네이티브 규준(KBO 41명 등) 반입 금지.
3. `check_track_isolation.py`(repo 루트)가 격리를 검사한다. 우회 금지.

## 빌드·베이크·배포

- **라이브 헤드라인 = React 대시보드**(빌드본 패치가 SSOT — report.engine의 `_efPhases`는 dead path). 산식 변경은 React 쪽에.
- **베이크**: `_ku_theia_bake/`(KU 10명 파이프라인·번호 스크립트 순서 실행). ⚠일부 스크립트에 **절대경로 하드코딩 잔존**(구 모노레포·워크트리 경로) — 첫 사용 전 경로 확인. 재빌드=수동 패치 되돌림 위험(viewer 베이크 3단계 규약).
- **배포(정본)**: `python3 deploy_track.py pitching/theia --scope korea`(수술적·격리검사 의무). `_ku_theia_bake/deploy_ku_korea_only.py`는 호환용(경로는 이 repo 기준으로 재지정됨). **전체 트리 재배포 절대 금지**(반대편 트랙 삭제 사고 이력). 토큰=repo 루트 `.netlify_deploy.conf`(커밋 금지).
- 사이트 비번보호 → 배포 검증은 Netlify API sha 대조. 한글경로 NFC/NFD 404 함정 주의.

## 점수·산식 거버넌스 (교수 2026-06-14)

산식(mech5·phases·pitch_norms)은 가설 — 개선 자유. 단: ①근거 한 줄 ②기존 선수 before/after ③커밋 분리 ④표시-점수 정합. 점수교정=메커니즘 교정이지 결과 맞추기 아님(코치-시스템 불일치=버그 증거).

## 알려진 함정

- **mech5/mech6 이중 MAP**: 라이브=mech5 인라인·mech6.js=verify 하니스용 — 동기화 주의.
- **KU 구종 매핑**: 랩소도 pitches=구종 정렬(시간순 아님) — CSV 타임스탬프+릴리스높이 교차검증 ρ≥0.6만 구종 라벨.
- **관절파워**: `_X` 단일축만 채점(naive 3D합=부호상쇄 요동 — 검증 없이 교체 금지).
- **렌더 검증**: `#root.innerText` 기준(워크트리 404 함정).
- **이모지 금지**(교수) · 용어는 현장어.
- 데이터 위치: iCloud `야구데이터/01_테이아_투수/`(참조규준=highschool·college·professional·adult·middleschool_수정·우수투수테이아 / 세션=고려대투수202606·상동고) · `05_보조/`(랩소도·체력).

## 작업 방식

- 방향이 명확하면 되묻지 말고 진행(분석·편집·빌드·로컬 커밋). **사전확인 필수**: ①배포·git push·공개 ②삭제 ③외부 전송.
- main 직접 push 금지 → 브랜치+PR. 커밋 규약 `feat(pitching-theia):`.
