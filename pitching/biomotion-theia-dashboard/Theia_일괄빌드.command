#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "[작업폴더] $(pwd)"
echo ""
node --version >/dev/null 2>&1 || { echo "[중단] Node.js 가 필요합니다."; read -p "Enter 종료"; exit 1; }
BPR_ROOT="$(pwd)" node _분석/scripts/build_all_theia_reports.js data reports
echo ""
echo "[완료] reports/ 폴더에 HTML 들이 생성됐습니다."
read -p "Enter 키로 창 닫기..."
