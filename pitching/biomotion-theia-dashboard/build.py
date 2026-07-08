#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""바이오모션 피칭 대시보드 — Theia 전용 빌드"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
NETLIFY_THEIA_DIR = os.path.join(ROOT, "netlify_통합배포", "pitching", "theia")
NETLIFY_THEIA = os.path.join(NETLIFY_THEIA_DIR, "index.html")
ASSETS_SRC = os.path.join(HERE, "assets")
INTRO_ASSETS_DIR = os.path.join(ASSETS_SRC, "intro")
GLTF_LOADER_SRC = os.path.join(SRC, "lib", "GLTFLoader.js")
DEPLOY = ["index.html", "upload.html", "바이오모션_Theia_대시보드.html"]
SKIP_INCLUDES = {"lib/xlsx.full.min.js"}
APP_VERSION = "2.5"
BUILD_VER = "v%s · 빌드 %s" % (APP_VERSION, datetime.now().strftime("%Y-%m-%d %H:%M"))

MARKERS = (
    "feedback-view",
    "dashboard-intro-active",
    "intro-start",
    "dashboard-intro-root",
    BUILD_VER.split(" · ")[0],  # v2.5
)


def encode_blob(text):
    return json.dumps(text, ensure_ascii=True).replace("</", "<\\/")


def verify_theia_html(path):
    text = open(path, encoding="utf-8").read()
    missing = [m for m in MARKERS if m not in text]
    if missing:
        sys.exit("[빌드 실패] 최신 마커 누락 %s: %s" % (path, ", ".join(missing)))
    m = re.search(r"v2\.5\s*·\s*빌드\s*[\d\-: ]+", text)
    if not m:
        sys.exit("[빌드 실패] build stamp 없음: %s" % path)


def _intro_assets_js():
    # [2026-06-18] 인트로 페이지 제거 — base64 히어로/몽타주 이미지 임베드 중단(셸 용량 ~9MB 절감).
    #   _initDashboardIntro()가 인트로를 렌더하지 않고 곧바로 대시보드(DB)로 진입하므로 이 URI들은 미사용.
    #   (report·dashboard-shell 두 경로 모두 빈 문자열 → 대용량 base64 라인 제거)
    return ('/* dashboard intro assets — 제거됨(인트로 비표시·용량절감 2026-06-18) */\n'
            'var BM_INTRO_HERO_URI="";\nvar BM_INTRO_MONTAGE_URI="";\n')


def _read_dashboard_intro_shell_js():
    """[ENG-04] 메인 대시보드 shell 에서 실제로 실행되는 인트로 번들.

    report-only __JS 문자열과 달리 shell.html 의 <script>@@DASHBOARD_INTRO_SHELL_JS@@</script> 로
    주입되어 최초 진입 1회 인트로를 띄운다(once 가드=_shouldShowDashboardIntro/sessionStorage).
    점수·기능 무관 — display only."""
    intro_path = os.path.join(SRC, "modules", "dashboard_intro.js")
    if not os.path.isfile(intro_path):
        sys.exit("[빌드 실패] intro module 없음: %s" % intro_path)
    boot = (
        "\n;(function(){function _bmBootDashboardIntro(){try{"
        "if(typeof _initDashboardIntro==='function')_initDashboardIntro();"
        "}catch(e){if(typeof console!=='undefined')console.error('[dashboard intro shell]',e);}}"
        "if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_bmBootDashboardIntro,{once:true});}"
        "else{_bmBootDashboardIntro();}})();\n"
    )
    return _intro_assets_js() + open(intro_path, encoding="utf-8").read() + boot


def _copy_tree(src_dir, dst_dir):
    if not os.path.isdir(src_dir):
        return
    src_dir = os.path.normpath(src_dir)
    dst_dir = os.path.normpath(dst_dir)
    if src_dir == dst_dir:
        return
    for root_dir, _dirs, files in os.walk(src_dir):
        rel = os.path.relpath(root_dir, src_dir)
        out_dir = dst_dir if rel == "." else os.path.join(dst_dir, rel)
        os.makedirs(out_dir, exist_ok=True)
        for name in files:
            src_f = os.path.join(root_dir, name)
            dst_f = os.path.join(out_dir, name)
            if os.path.normpath(src_f) != os.path.normpath(dst_f):
                shutil.copy2(src_f, dst_f)


def sync_netlify_deploy(primary_path, do_sync):
    if not do_sync:
        return
    os.makedirs(NETLIFY_THEIA_DIR, exist_ok=True)
    shutil.copyfile(primary_path, NETLIFY_THEIA)
    a = hashlib.sha256(open(primary_path, "rb").read()).hexdigest()
    b = hashlib.sha256(open(NETLIFY_THEIA, "rb").read()).hexdigest()
    if a != b:
        sys.exit("[동기화 실패] sha256 불일치: %s" % NETLIFY_THEIA)
    print("  - netlify_통합배포/pitching/theia/index.html (동기화 OK)")
    upload_local = os.path.join(HERE, "upload.html")
    if os.path.isfile(upload_local):
        upload_netlify = os.path.join(NETLIFY_THEIA_DIR, "upload.html")
        shutil.copyfile(upload_local, upload_netlify)
        print("  - netlify_통합배포/pitching/theia/upload.html (동기화 OK)")
    if os.path.isfile(GLTF_LOADER_SRC):
        lib_dst = os.path.join(NETLIFY_THEIA_DIR, "lib")
        os.makedirs(lib_dst, exist_ok=True)
        shutil.copy2(GLTF_LOADER_SRC, os.path.join(lib_dst, "GLTFLoader.js"))
        print("  - netlify_통합배포/pitching/theia/lib/GLTFLoader.js (동기화 OK)")
    _copy_tree(ASSETS_SRC, os.path.join(NETLIFY_THEIA_DIR, "assets"))
    if os.path.isdir(ASSETS_SRC):
        print("  - netlify_통합배포/pitching/theia/assets/ (동기화 OK)")


def main():
    parser = argparse.ArgumentParser(description="Theia 대시보드 빌드")
    parser.add_argument(
        "--no-sync",
        action="store_true",
        help="netlify_통합배포/pitching/theia/ 로 복사하지 않음",
    )
    args = parser.parse_args()
    do_sync = not args.no_sync

    shell = open(os.path.join(SRC, "shell.html"), encoding="utf-8").read()

    def inc(m):
        rel = m.group(1)
        # [2026-06-25] xlsx.full.min.js(882KB) 제외 — roster.xlsx/master_fitness.xlsx 파싱은
        #   이미 `typeof XLSX!=='undefined'` 가드로 감싸여 있어(dashboard.runner.js) 없어도 안전 no-op.
        #   같은 "무거운 선택 라이브러리를 항상 파싱·메모리 상주"시키는 OOM 버그 클래스라 함께 제거.
        if rel in SKIP_INCLUDES:
            return "/* %s 제외(경량 — xlsx 미포함 zip은 영향 없음) */" % rel
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            sys.exit("[빌드 실패] include 소스 없음: %s" % rel)
        return open(p, encoding="utf-8").read()

    shell = re.sub(r"@@INCLUDE:([^@]+)@@", inc, shell)

    # [ENG-04] 메인 shell 실행용 인트로 번들 주입 — report-only __JS 와 분리한 raw executable <script>.
    #   @@INCLUDE 치환 직후·BLOB 치환 전에 1회 교체(주입 JS엔 @@…@@ 토큰 없음). display only·점수 무관.
    _intro_token = "@@DASHBOARD_INTRO_SHELL_JS@@"
    if shell.count(_intro_token) != 1:
        sys.exit("[빌드 실패] %s 플레이스홀더 개수=%d" % (_intro_token, shell.count(_intro_token)))
    _intro_js = (
        _read_dashboard_intro_shell_js()
        .replace("__BUILD_VER__", BUILD_VER)
        .replace("</script", "<\\/script")
    )
    shell = shell.replace(_intro_token, _intro_js)

    manifest = json.load(open(os.path.join(SRC, "_manifest.json"), encoding="utf-8"))

    # [2026-06-25] 인라인 리포트 팝업(report.engine.js·THREE 3D)이 도달불가 죽은 코드로 확인돼 제거됨
    #   (실제 리포트는 openReport()가 React dashboard/ 로 핸드오프). __TPL/__JS/__THREE/__ORBIT 매니페스트
    #   항목·report.template.html·_report_blob_manifest.json·@@RBM@@ 처리도 함께 제거 —
    #   index.html이 항상 파싱하던 ~2.3MB 죽은 페이로드(OOM 재발 원인)를 구조적으로 제거.
    for var, rel in manifest:
        p = os.path.normpath(os.path.join(SRC, rel))
        if not os.path.exists(p):
            sys.exit("[빌드 실패] blob 소스 없음: %s" % rel)
        token = "@@BLOB:%s@@" % var
        if shell.count(token) != 1:
            sys.exit("[빌드 실패] 플레이스홀더 %s 개수=%d" % (token, shell.count(token)))
        content = open(p, encoding="utf-8").read().replace("__BUILD_VER__", BUILD_VER)
        shell = shell.replace(token, encode_blob(content))
    shell = shell.replace("__BUILD_VER__", BUILD_VER)
    if "@@INCLUDE:" in shell or "@@BLOB:" in shell:
        sys.exit("[빌드 실패] 미치환 플레이스홀더 잔존")

    primary = os.path.join(HERE, DEPLOY[0])
    open(primary, "w", encoding="utf-8").write(shell)
    for name in DEPLOY[1:]:
        shutil.copyfile(primary, os.path.join(HERE, name))

    if os.path.isfile(GLTF_LOADER_SRC):
        lib_local = os.path.join(HERE, "lib")
        os.makedirs(lib_local, exist_ok=True)
        shutil.copy2(GLTF_LOADER_SRC, os.path.join(lib_local, "GLTFLoader.js"))
    if os.path.isdir(ASSETS_SRC):
        _copy_tree(ASSETS_SRC, os.path.join(HERE, "assets"))

    verify_theia_html(primary)
    print("[Theia 대시보드 빌드 성공] %d bytes · %s" % (len(shell.encode("utf-8")), BUILD_VER))
    for name in DEPLOY:
        print("  - " + name)
    sync_netlify_deploy(primary, do_sync)


if __name__ == "__main__":
    main()
