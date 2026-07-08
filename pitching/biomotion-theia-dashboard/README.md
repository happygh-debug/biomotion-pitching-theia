# 피칭 Theia 대시보드 — HTML 경로 (정식)

> 구버전·미리보기·강의 HTML과 섞이지 않도록 이 README를 기준으로 한다.  
> 전체 인벤토리: [`docs/html_output_inventory.md`](../../docs/html_output_inventory.md)

## 정식 경로 (최신 앱)

| 역할 | 경로 |
|------|------|
| **소스 (SSOT)** | `src/` — `report.engine.js`, `report.styles.css`, `report.template.html`, `shell.html`, `modules/*` |
| **빌드** | `python3 build.py` (또는 `Theia_일괄빌드.command`) |
| **로컬 산출물** | `index.html` |
| **한글 산출물** | `바이오모션_Theia_대시보드.html` (`index.html`과 동일 복사) |
| **배포 복사본** | `../../netlify_통합배포/pitching/theia/index.html` (`build.py`가 `--sync` 또는 기본 동기화) |
| **프로덕션 URL** | https://biomotion-sports.netlify.app/pitching/theia/ |

## 최신 빌드 확인 (4가지)

헤더 배지 또는 파일 내 문자열:

1. `v2.5 · 빌드 YYYY-MM-DD HH:MM`
2. `feedback-view`
3. `variable_visual_registry`
4. `renderFeedbackView`

```bash
python3 build.py --sync
rg -o 'v2\.5 · 빌드 [0-9-: ]+' index.html
```

## 이 폴더에서 열지 말 것

| 경로 | 이유 |
|------|------|
| ~~`netlify_배포/`~~ | **폐기** → `_archive/html-legacy/pitching-theia/netlify_배포_20260602/` |
| `previews/archive/*.html` | 선수별 **정적 스냅샷** (v0.3, 탭 구버전) |
| `reports/*.html` | export 스냅샷 (`build.py` 산출물 아님) |
| `src/report.template.html` | 빌드 **입력** — 브라우저로 직접 열지 않음 |

## 강의·데모 (별 트랙)

- 슬라이드: `teaching_slides/biomotion_ai_collaboration/강의_v4.html`
- 임베드 리포트 데모: `teaching_slides/.../demo_reports/MLB_vs_KBO_분석.html`  
  → 운영 Theia와 바이트가 다를 수 있음. 라이브 검증은 위 **프로덕션 URL** 또는 로컬 `index.html`.

## 배포

루트 `3종목_클라우드분리_배포.command` — 피칭은 `netlify_통합배포/pitching/theia/`만 사용.
