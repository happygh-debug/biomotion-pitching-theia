# 선수 리포트 HTML (export 스냅샷)

| 구분 | 설명 |
|------|------|
| `*_선수리포트.html` | 선수별 **보내기용** 정적 HTML (~800KB) |
| `archive/` | 실험·대용량 개선본 등 |

**최신 Theia 앱** = `../index.html` (`python3 build.py` 후).  
이 폴더 파일은 참고·비교용이며, 배포·강의 SSOT가 아님.

각 HTML **첫 줄**에 `BM-STATIC-EXPORT` 주석(정적 export · NOT build.py).  
재생성: `node _분석/scripts/build_player_reports_full.js` (또는 `build_all_theia_reports.js`).  
기존 파일만 주석 추가: `node _분석/scripts/html_static_export_stamp.js reports`.
