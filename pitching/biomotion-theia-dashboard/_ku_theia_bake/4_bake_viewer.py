# -*- coding: utf-8 -*-
import sys, os, json, hashlib, io
HERE="/Users/biomotion/Projects/biomotion-platform/_motion_viewer_build"
sys.path.insert(0, HERE)
import extract_viewer_data as evd   # grab, grab_first_ok, build_sd_band (canonical frames + SD)

ROSTER=json.load(open("/private/tmp/ku_theia/viewer_roster.json",encoding="utf-8"))
order=ROSTER["order"]; byName=ROSTER["byName"]
DATAROOT="/private/tmp/ku_viewer"
OUT_FRAMES="/Users/biomotion/Projects/biomotion-platform-pitching/netlify_통합배포/pitching/theia/korea/데이터/frames"
OUT_VIEWER="/Users/biomotion/Projects/biomotion-platform-pitching/netlify_통합배포/pitching/theia/korea/motion_viewer.html"
# [SSOT 2026-07-05] 템플릿 정본 = 피칭 차선 내부(git 추적·커밋 가능). 메인 레포 사본은 비권위(배팅 브랜치 체크아웃=커밋 불가·드리프트 위험).
TMPL="/Users/biomotion/Projects/biomotion-platform-pitching/_motion_viewer_build/motion_viewer_template.html"
os.makedirs(OUT_FRAMES, exist_ok=True)

records={}; ok=[]
for nm in order:
    info=byName[nm]; pdir=os.path.join(DATAROOT, info["folder"])
    try:
        rec=evd.grab_first_ok(pdir, info["hand"], nm, str(info["velo"]))
        rec["name"]=nm; rec["label"]=nm; rec["group"]="고려대"; rec["velo"]=str(info["velo"])
        records[nm]=rec; ok.append(nm)
        print(f"  OK {nm} · {rec['n']}f · FC{rec['events'].get('i_fc')} BR{rec['events'].get('i_br')} · sd_n={rec.get('sd_n','-')} · fps{round(rec['fps'],1)}")
    except Exception as e:
        print(f"  FAIL {nm}: {str(e)[:60]}")

# write frame files + manifest (build_viewer.py 방식)
manifest={"version":"ku-theia-viewer","order":ok,"players":{}}
digests=[]
for i,nm in enumerate(ok,1):
    rec=records[nm]; payload=json.dumps(rec, ensure_ascii=False, separators=(",",":"))
    digest=hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]; digests.append(digest)
    fn="p%04d.json"%i
    open(os.path.join(OUT_FRAMES, fn),"w",encoding="utf-8").write(payload)
    keep=["label","name","velo","hand","group","fps","dt","height_m","mass_kg","ground_y_m","canon","n"]
    meta={k:rec.get(k) for k in keep if rec.get(k) is not None}
    meta["file"]="데이터/frames/"+fn+"?v="+digest
    manifest["players"][nm]=meta
manifest["version"]="ku-theia-"+hashlib.sha1("|".join(digests).encode()).hexdigest()[:12]
open(os.path.join(OUT_FRAMES,"manifest.json"),"w",encoding="utf-8").write(json.dumps(manifest,ensure_ascii=False,separators=(",",":")))

# inject into template → korea/motion_viewer.html
tmpl=open(TMPL,encoding="utf-8").read()
data="window.VIEWER_MANIFEST = "+json.dumps(manifest,ensure_ascii=False,separators=(",",":"))+";"
html=tmpl.replace("/*__DATA__*/", data)
open(OUT_VIEWER,"w",encoding="utf-8").write(html)
print(f"\n베이크 {len(ok)}/10 · frames {OUT_FRAMES} · viewer {round(len(html)/1024)}KB")
