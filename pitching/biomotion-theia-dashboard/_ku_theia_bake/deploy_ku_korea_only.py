# -*- coding: utf-8 -*-
"""[⚠️ DEPRECATED 2026-07-07] 정본=deploy_track.py 로 통합됨:
      python3 deploy_track.py pitching/theia --scope korea            # 드라이런
      python3 deploy_track.py pitching/theia --scope korea --deploy   # 실배포
   deploy_track.py는 동일 3중 게이트 + 배포 전 격리검사(의무)까지 하므로 더 안전.
   이 스크립트는 호환용으로만 한동안 존치(로직 동일). 새 배포는 deploy_track.py 사용.

KU korea 수술적 배포(예전 방식) — 라이브 매니페스트 시작 + korea만 덮어쓰기.
3중 하드게이트: (1)매니페스트 변경=korea만 (2)업로드 요구=korea sha만 (3)배포후 비-korea sha 불변.
로컬 트리 분기와 무관하게 안전(비-korea 전부 유지·삭제 없음)."""
import os, re, json, time, hashlib, unicodedata, urllib.request, urllib.parse, sys
print("[⚠️ DEPRECATED] 정본=deploy_track.py pitching/theia --scope korea  (동일 로직+격리검사 의무). 이 스크립트는 호환용 존치.", file=sys.stderr)
CONF=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".netlify_deploy.conf")  # repo 루트(4트랙 분리 이전으로 경로 재지정)
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "netlify_통합배포", "pitching", "theia", "korea")  # repo 루트 스테이징(분리 이전으로 경로 재지정)
PREFIX="/pitching/theia/korea/"
conf=open(CONF).read()
TK=re.search(r"NETLIFY_TOKEN=(\S+)",conf).group(1); SI=re.search(r"NETLIFY_SITE_ID=(\S+)",conf).group(1)
A="https://api.netlify.com/api/v1"
def rq(method,url,data=None,raw=None):
    h={"Authorization":"Bearer "+TK}; body=None
    if data is not None: body=json.dumps(data).encode(); h["Content-Type"]="application/json"
    elif raw is not None: body=raw; h["Content-Type"]="application/octet-stream"
    with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h,method=method),timeout=180) as r:
        t=r.read(); return json.loads(t) if (t and method!="PUT") else None
def sha1(p):
    h=hashlib.sha1()
    with open(p,'rb') as f:
        for ch in iter(lambda:f.read(1<<20),b''): h.update(ch)
    return h.hexdigest()
def nfc(s): return unicodedata.normalize('NFC',s)
# 1) 라이브 매니페스트(NFC 정규화 키)
live={nfc(f["path"]):f["sha"] for f in rq("GET",f"{A}/sites/{SI}/files")}
print("라이브 파일:",len(live))
# 2) 로컬 korea sha
korea={}
for dp,dns,fns in os.walk(SRC):
    dns[:]=[d for d in dns if not d.startswith('.')]
    for fn in fns:
        if fn.startswith('.'): continue
        fp=os.path.join(dp,fn)
        rel=PREFIX+nfc(os.path.relpath(fp,SRC)).replace(os.sep,'/')
        korea[rel]=(sha1(fp),fp)
korea_sha={p:s for p,(s,_) in korea.items()}
# 3) man = live + overlay korea
man=dict(live); man.update(korea_sha)
# ★게이트1: 변경 경로 전부 korea여야
changed=[p for p in man if man[p]!=live.get(p)]
leak=[p for p in changed if not p.startswith(PREFIX)]
if leak: raise SystemExit("[중단·게이트1] korea 외 경로 변경:\n  "+"\n  ".join(leak[:20]))
print("게이트1 통과 · 변경 korea 경로 %d개(비-korea %d개 핀):"%(len(changed),len(live)-len([p for p in live if p.startswith(PREFIX)])))
for p in sorted(changed): print("   ",("신규" if p not in live else "변경"),p)
# 4) POST deploy
dep=rq("POST",f"{A}/sites/{SI}/deploys",{"files":man,"draft":False})
did=dep["id"]; required=set(dep.get("required") or [])
print("deploy:",did,"| 업로드요구:",len(required))
# ★게이트2: 업로드 요구 sha = korea sha 뿐
ours=set(korea_sha.values()); nonours=[s for s in required if s not in ours]
if nonours: raise SystemExit("[중단·게이트2] korea 외 파일 업로드 요구: "+str(nonours[:10]))
print("게이트2 통과 · 업로드 요구는 korea sha만")
# 5) PUT (변경 korea만)
for p,(s,fp) in korea.items():
    if s in required:
        enc=urllib.parse.quote(p.lstrip('/'))
        rq("PUT",f"{A}/deploys/{did}/files/{enc}",raw=open(fp,'rb').read())
        print("  업로드:",p,os.path.getsize(fp),"bytes")
# 6) 상태 대기
state=None
for _ in range(90):
    d=rq("GET",f"{A}/deploys/{did}"); state=d.get("state")
    if state in ("ready","error"): break
    time.sleep(2)
print("state:",state,"| url:",d.get("ssl_url") or d.get("url"))
# ★게이트3: 배포후 비-korea sha 불변 전수확인
after={nfc(f["path"]):f["sha"] for f in rq("GET",f"{A}/sites/{SI}/files")}
drift=[p for p in set(list(live)+list(after)) if not p.startswith(PREFIX) and live.get(p)!=after.get(p)]
if drift: raise SystemExit("[경보·게이트3] 비-korea 경로 sha 변동:\n  "+"\n  ".join(drift[:20]))
print("게이트3 통과 · 비-korea 경로 전부 불변. 배포 완료.")
