# -*- coding: utf-8 -*-
"""KU Theia 다중투구 베이크 v2 (2026-07-05 교수 요청)
매핑 근거: 원본 랩소도 CSV 타임스탬프로 시간순 정렬 → Theia trial(_001~, 촬영 시간순)과 1:1.
교차검증: 랩소도 Release Height ↔ Theia 릴리스 손끝 높이 순위상관(ρ≥0.6=채택). 구속과 달리
Theia가 직접 재는 값이라 독립 검증. 검증 통과 선수만 구종 라벨·디셉션 부여(정직).
per-pitch = rapsodo.js(검증된 hb/vb/eff)와 CSV(시간·회전축 SpinDir·자이로)를 velo로 조인.
출력: ① 디폴트 스틱=포심 최속(검증 선수) ② 구종 변형 trial(뷰어 비교) ③ pitchdesign.js
(랩소도 포심vs변화구 특성·코호트 순위·동작 디셉션 변인).
"""
import sys, os, json, hashlib, re, math, glob, csv, datetime
HERE="/Users/biomotion/Projects/biomotion-platform/_motion_viewer_build"
sys.path.insert(0, HERE); import extract_viewer_data as evd
ROSTER=json.load(open("/private/tmp/ku_theia/viewer_roster.json",encoding="utf-8"))
order=ROSTER["order"]; byName=ROSTER["byName"]
DATAROOT="/private/tmp/ku_viewer"
KOREA="/Users/biomotion/Projects/biomotion-platform-pitching/netlify_통합배포/pitching/theia/korea"
OUT_FRAMES=os.path.join(KOREA,"데이터/frames"); OUT_VIEWER=os.path.join(KOREA,"motion_viewer.html")
OUT_PD=os.path.join(KOREA,"데이터/pitchdesign.js")
TMPL="/Users/biomotion/Projects/biomotion-platform-pitching/_motion_viewer_build/motion_viewer_template.html"
CSVDIR="/Users/biomotion/Projects/biomotion-platform-uplift-pitching/pitching/biomotion-uplift-dashboard/_ku_data/rapsodo_0628"
_csvs={os.path.basename(f).replace('_rapsodo.csv',''):f for f in glob.glob(os.path.join(CSVDIR,'*_rapsodo.csv'))}
_alias={'kimbumgeun':'kimbeomkeun','kimjunyoung':'kimjunyeong'}
RAPS=json.loads(re.search(r'window\.RAPSODO\s*=\s*(\{.*\});?\s*$',open(os.path.join(KOREA,"데이터/rapsodo.js"),encoding="utf-8").read(),re.S).group(1))
KO={"Fastball":"포심","Slider":"슬라이더","CurveBall":"커브","ChangeUp":"체인지업","Splitter":"스플리터","TwoSeam":"투심","Sinker":"싱커"}
BREAKS=["Slider","CurveBall","ChangeUp","Splitter","Sinker"]
RHO_MIN=0.6
MANUAL_TRIAL_MAP={
    # 자동 검증은 릴리스 높이 순위상관이 낮아 제외됐지만, Theia trial 번호와 Rapsodo 시간순 구종 흐름이 명확한 선수만 고정 매핑.
    # pairs=(Theia trial index, Rapsodo time-sorted row index), 0-based.
    "홍주환":{
        "reason":"Theia 12구와 Rapsodo 12구 개수 일치. 시간순 구종 블록(1-6 포심, 7-8 커브, 9-10 체인지업, 11-12 Other)을 수동 확정.",
        "pairs":[(0,0),(1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9),(10,10),(11,11)]
    },
    "정원진":{
        "reason":"Rapsodo CSV 첫 유효 전 빈 row를 제외하고 Theia 2-12번을 시간순 Rapsodo 2-12번에 정렬.",
        "pairs":[(1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9),(10,10),(11,11)]
    }
}
def ff(s):
    try:return float(s)
    except:return None
def load_timed(nm, folder):
    """CSV 시간순 + rapsodo.js join → 시간 오름차순 per-pitch(velo·spin·eff·hb·vb·spinDir·gyro·strike)."""
    ck=folder if folder in _csvs else _alias.get(folder)
    rows=list(csv.reader(open(_csvs[ck],encoding='utf-8-sig')))
    hi=[i for i,r in enumerate(rows) if 'Pitch Type' in r][0]; col={c.strip():j for j,c in enumerate(rows[hi])}
    cpitch=[]
    for r in rows[hi+1:]:
        if not any(c.strip() for c in r): continue
        def g(k):
            j=col.get(k); return r[j].strip() if j is not None and j<len(r) else ''
        try:t=datetime.datetime.strptime(g('Date'),'%a %b %d %Y %I:%M:%S %p')
        except:t=None
        cpitch.append({'type':g('Pitch Type'),'t':t,'velo':ff(g('Velocity')),'relH':ff(g('Release Height')),
                       'spinDir':g('Spin Direction'),'gyro':ff(g('Gyro Degree (deg)'))})
    cpitch.sort(key=lambda x:(x['t'] or datetime.datetime.min))
    # join rapsodo.js(검증 hb/vb/eff) by velo
    js=(RAPS.get(nm) or {}).get('pitches') or []
    used=set()
    for cp in cpitch:
        best=None;bd=9
        for i,p in enumerate(js):
            if i in used or p['type']!=cp['type']: continue
            d=abs((p['velo'] or 0)-(cp['velo'] or 0))
            if d<bd: bd=d;best=i
        if best is not None and bd<0.6:
            used.add(best); p=js[best]
            cp.update({'spin':p.get('spin'),'eff':p.get('eff'),'hb':p.get('hb'),'vb':p.get('vb'),'strike':p.get('strike')})
    return cpitch
def relY(rec):
    idx={n:i for i,n in enumerate(rec['LM'])}; br=rec['events'].get('i_br'); F=rec['frames']
    thr='l' if rec['hand'].upper()=='L' else 'r'
    tip=F[br][idx.get(thr+'_hand_tip')] if br and br<len(F) else None
    return tip[1] if tip else None
def spearman(x,y):
    p=[(a,b) for a,b in zip(x,y) if a is not None and b is not None]; n=len(p)
    if n<4: return None
    def rk(v):
        s=sorted(range(n),key=lambda i:v[i]); r=[0]*n
        for j,i in enumerate(s):r[i]=j
        return r
    xs=[a for a,_ in p];ys=[b for _,b in p];rx,ry=rk(xs),rk(ys);mx=sum(rx)/n;my=sum(ry)/n
    num=sum((rx[i]-mx)*(ry[i]-my) for i in range(n));den=math.sqrt(sum((rx[i]-mx)**2 for i in range(n))*sum((ry[i]-my)**2 for i in range(n)))
    return round(num/den,2) if den else None
def dec_vars(rec):
    idx={n:i for i,n in enumerate(rec["LM"])}; ev=rec["events"]; F=rec["frames"]; dt=rec["dt"]; ser=rec.get("series",{})
    thr='l' if rec["hand"].upper()=='L' else 'r'; lead='r' if thr=='l' else 'l'
    br,fc,kh=ev.get("i_br"),ev.get("i_fc"),ev.get("i_kl_peak"); o={}
    def P(nm2,fr):
        if fr is None or fr>=len(F): return None
        return F[fr][idx[nm2]] if idx.get(nm2) is not None else None
    tip=P(thr+'_hand_tip',br) or P(thr+'_wrist',br); sho=P(thr+'_shoulder',br)
    if tip:
        sgn=-1 if thr=='l' else 1
        o["relH"]=tip[1]; o["relS"]=sgn*tip[0]; o["relF"]=tip[2]
    if tip and sho:
        o["armSlot"]=math.degrees(math.atan2(tip[1]-sho[1],math.hypot(tip[0]-sho[0],tip[2]-sho[2])))
    if br is not None and fc is not None: o["tFCBR"]=(br-fc)*dt
    if fc is not None and kh is not None: o["tKHFC"]=(fc-kh)*dt
    if fc is not None:
        ky=[F[i][idx[lead+'_knee']][1] for i in range(0,fc+1) if F[i][idx[lead+'_knee']]]
        if ky:o["kneeY"]=max(ky)
        ls,rs=P('l_shoulder',fc),P('r_shoulder',fc)
        if ls and rs:
            o["openFC"]=math.degrees(math.atan2(abs(rs[0]-ls[0]),abs(rs[2]-ls[2]) or 1e-9))
    for sk,k in [("Trunk_Angle_X","trunkFwd"),("Trunk_Angle_Y","trunkLat")]:
        c2=ser.get(sk)
        if c2 and br is not None and br<len(c2) and isinstance(c2[br],(int,float)):o[k]=c2[br]
    return o
VARDEF=[("relH","릴리스 높이","mm",40),("relS","릴리스 좌우","mm",40),("relF","릴리스 익스텐션","mm",40),
        ("armSlot","암슬롯","°",4),("tKHFC","템포 다리들기→착지","s",0.024),("tFCBR","템포 착지→릴리스","s",0.016),
        ("kneeY","무릎 최고 높이","mm",30),("openFC","착지 어깨 개방","°",4),
        ("trunkFwd","릴리스 몸통 전경","°",4),("trunkLat","릴리스 몸통 측굴","°",4)]

manifest_meta={}; pd_out={}; file_no=0; digests=[]; os.makedirs(OUT_FRAMES,exist_ok=True)
def write_rec(key,rec):
    global file_no
    file_no+=1; fn="p%04d.json"%file_no; payload=json.dumps(rec,ensure_ascii=False,separators=(",",":"))
    dg=hashlib.sha1(payload.encode()).hexdigest()[:12]; digests.append(dg)
    open(os.path.join(OUT_FRAMES,fn),"w",encoding="utf-8").write(payload)
    keep=["label","name","velo","hand","group","fps","dt","height_m","mass_kg","ground_y_m","canon","n"]
    m={k:rec.get(k) for k in keep if rec.get(k) is not None}; m["file"]="데이터/frames/"+fn+"?v="+dg
    if rec.get("pitch"): m["pitchType"]=rec["pitch"].get("typeKo")
    manifest_meta[key]=m; return m

for nm in order:
    info=byName[nm]; folder=info["folder"]; hand=info["hand"]; pdir=os.path.join(DATAROOT,folder)
    trials=sorted(glob.glob(os.path.join(pdir,"theia","*.c3d.txt")))
    timed=load_timed(nm,folder)
    recs=[]
    for c in trials:
        try:recs.append(evd.grab(c,hand,nm,"",pdir))
        except Exception:recs.append(None)
    same=len(trials)==len(timed)
    rho=spearman([relY(r) if r else None for r in recs],[t['relH'] for t in timed]) if same else None
    manual=MANUAL_TRIAL_MAP.get(nm)
    map_pairs=[]
    map_source="auto"
    if manual:
        for ti,ri in manual["pairs"]:
            if ti<len(recs) and ri<len(timed) and recs[ti] and timed[ri].get("type"):
                map_pairs.append((ti,ri))
        map_source="manual"
        verified=bool(map_pairs and any(timed[ri]["type"]=="Fastball" for _,ri in map_pairs) and any(timed[ri]["type"] in BREAKS for _,ri in map_pairs))
    else:
        verified=bool(same and rho is not None and rho>=RHO_MIN)
        if verified:
            map_pairs=[(i,i) for i in range(min(len(recs),len(timed))) if recs[i] and timed[i].get("type")]
    trial_pitch={ti:timed[ri] for ti,ri in map_pairs}
    # per-trial 구종(검증된 경우만)
    idx_of_type={}
    if verified:
        for ti,ri in map_pairs:
            t=timed[ri]
            idx_of_type.setdefault(t['type'],[]).append(ti)
    # ── 디폴트 스틱 ──
    ff_i=idx_of_type.get('Fastball',[])
    if verified and ff_i:
        main_i=max(ff_i,key=lambda i:timed[i]['velo'] or 0)
    else:
        oks=[i for i,r in enumerate(recs) if r]; main_i=oks[0] if oks else None
    if main_i is None:
        print(f"{nm}: main 없음"); continue
    main=evd.build_sd_band(recs[main_i],trials,hand,pdir,exclude_basenames={os.path.basename(trials[main_i])})
    main["name"]=nm; main["group"]="고려대"; main["label"]=nm
    if verified:
        t=trial_pitch[main_i]
        main["velo"]=str(round(t['velo'],1))
        main["pitch"]={"type":t['type'],"typeKo":KO.get(t['type'],t['type']),"velo":round(t['velo'],1),
            "spin":round(t['spin'],0) if t.get('spin') else None,"eff":round(t['eff'],1) if t.get('eff') is not None else None,
            "hb":t.get('hb'),"vb":t.get('vb'),"spinDir":t.get('spinDir'),"gyro":round(t['gyro'],0) if t.get('gyro') is not None else None,
            "strike":t.get('strike')}
    else:
        main["velo"]=str(info["velo"])
    write_rec(nm,main)
    # ── 구종 변형(검증 선수만) ──
    variants=[]
    if verified:
        for bt in BREAKS:
            cand=idx_of_type.get(bt,[])
            if not cand: continue
            vi=max(cand,key=lambda i:trial_pitch[i]['velo'] or 0); t=trial_pitch[vi]
            key=nm+"·"+KO[bt]; r=dict(recs[vi]); r["name"]=nm; r["group"]="고려대"; r["label"]=key; r["velo"]=str(round(t['velo'],1))
            r["pitch"]={"type":bt,"typeKo":KO[bt],"velo":round(t['velo'],1),"spin":round(t['spin'],0) if t.get('spin') else None,
                "eff":round(t['eff'],1) if t.get('eff') is not None else None,"hb":t.get('hb'),"vb":t.get('vb'),
                "spinDir":t.get('spinDir'),"gyro":round(t['gyro'],0) if t.get('gyro') is not None else None,"strike":t.get('strike')}
            m=write_rec(key,r); m["variantOf"]=nm; variants.append(key)
    manifest_meta[nm]["variants"]=variants
    # ── 동작 디셉션(검증+포심3+ & 변화구有) ──
    dec=None
    brk_types=[bt for bt in BREAKS if idx_of_type.get(bt)]
    if verified and len(ff_i)>=3 and brk_types:
        ffv=[dec_vars(recs[i]) for i in ff_i]; dvars=[]
        for k,label,unit,jnd in VARDEF:
            vals=[v[k] for v in ffv if k in v]
            if len(vals)<3: continue
            mu=sum(vals)/len(vals); sd=math.sqrt(sum((x-mu)**2 for x in vals)/(len(vals)-1)) if len(vals)>1 else 0
            row={"k":k,"label":label,"unit":unit,"ffMean":round(mu,1),"ffSd":round(sd,1),"nFF":len(vals),"types":{}}
            for bt in brk_types:
                bvals=[dec_vars(recs[i]).get(k) for i in idx_of_type[bt]]; bvals=[x for x in bvals if x is not None]
                if not bvals: continue
                bm=sum(bvals)/len(bvals); delta=bm-mu
                row["types"][KO[bt]]={"mean":round(bm,1),"n":len(bvals),"delta":round(delta,1),"flag":abs(delta)>max(2*sd,jnd)}
            if row["types"]: dvars.append(row)
        flags=[f"{tko}: {row['label']} {('+' if d['delta']>0 else '')}{d['delta']}{row['unit']} (포심 {row['ffMean']}±{row['ffSd']})"
               for row in dvars for tko,d in row['types'].items() if d['flag']]
        dec={"nFF":len(ff_i),"vars":dvars,"flags":flags}
    # ── 랩소도 구종 특성(전원·요약 기반) ──
    summ=(RAPS.get(nm) or {}).get("summary") or []
    ffs=next((s for s in summ if s["type"]=="Fastball"),None)
    types=[]
    def _n(x): return x if isinstance(x,(int,float)) else None
    for s in summ:
        if s["type"]=="Fastball": continue
        t=dict(s); t["typeKo"]=KO.get(s["type"],s["type"])
        hb,vb=_n(s.get("hb")),_n(s.get("vb"))
        t["breakMag"]=round(math.hypot(hb,vb),1) if (hb is not None and vb is not None) else None
        if ffs and _n(ffs.get("veloAvg")) is not None:
            if _n(s.get("veloAvg")) is not None: t["dVelo"]=round(ffs["veloAvg"]-s["veloAvg"],1)
            if _n(s.get("eff")) is not None and _n(ffs.get("eff")) is not None: t["dEff"]=round(s["eff"]-ffs["eff"],1)
            if vb is not None and _n(ffs.get("vb")) is not None: t["dVB"]=round(ffs["vb"]-vb,1)
        # 실측 회전축·자이로(해당 구종 시간순 첫 매칭)
        tt=[x for x in timed if x['type']==s['type']]
        if tt: t["spinDir"]=tt[0].get('spinDir'); t["gyro"]=round(sum(x['gyro'] for x in tt if x.get('gyro') is not None)/max(1,len([x for x in tt if x.get('gyro') is not None])),0) if any(x.get('gyro') is not None for x in tt) else None
        types.append(t)
    note=None
    if manual:
        note=("수동 매핑 적용: "+manual["reason"]) if verified else ("수동 매핑 실패: "+manual["reason"])
    elif not same: note=("Theia %d구·랩소도 %d구 개수 불일치 → 구종 매핑 불가"%(len(trials),len(timed)))
    elif not verified: note=("릴리스 높이 교차검증 미달(ρ=%s) → 구종 매핑 신뢰 낮아 제외"%rho)
    pd_out[nm]={"verified":verified,"manual":bool(manual and verified),"rho":rho,"nTrials":len(trials),"ff":ffs,"types":types,"deception":dec,"variants":variants,"note":note}
    main_desc=('포심'+str(round(trial_pitch[main_i]['velo'],1)) if verified and ff_i else '대표')
    print(f"{nm}: verified={verified} source={map_source} rho={rho} main={main_desc} variants={len(variants)} dec={'O' if dec else 'X'} types={len(types)}")

# 코호트 구종 순위(밋밋 판정)
coh={}
for nm,d in pd_out.items():
    for t in d["types"]:
        if t.get("breakMag") is None: continue
        coh.setdefault(t["typeKo"],[]).append({"name":nm,"breakMag":t["breakMag"],"eff":t.get("eff"),"gyro":t.get("gyro")})
for nm,d in pd_out.items():
    for t in d["types"]:
        if t.get("breakMag") is None: t["flat"]=False; continue
        arr=sorted(x["breakMag"] for x in coh[t["typeKo"]]); t["cohortN"]=len(arr); t["cohortRank"]=arr.index(t["breakMag"])+1
        effv=[x["eff"] for x in coh[t["typeKo"]] if x.get("eff") is not None]
        if t.get("eff") is not None and effv: t["effRank"]=sorted(effv).index(t["eff"])+1 if t["eff"] in effv else None
        # 밋밋 = 무브 하위권(1~2위/n) or 효율 하위 + 자이로 큼
        t["flat"]=(t["cohortN"]>=4 and t["cohortRank"]<=max(2,round(t["cohortN"]*0.34))) or (t.get("gyro") is not None and t["gyro"]>=55 and t["type"] in ("Slider","CurveBall"))
pd_payload={"players":pd_out,"cohort":coh,"session":"2026-06-28","rhoMin":RHO_MIN,
            "varDefs":[{"k":k,"label":l,"unit":u,"jnd":j} for k,l,u,j in VARDEF]}
manifest={"version":"","order":order,"players":manifest_meta}
manifest["version"]="ku-theia-"+hashlib.sha1("|".join(digests).encode()).hexdigest()[:12]
open(os.path.join(OUT_FRAMES,"manifest.json"),"w",encoding="utf-8").write(json.dumps(manifest,ensure_ascii=False,separators=(",",":")))
html=open(TMPL,encoding="utf-8").read().replace("/*__DATA__*/","window.VIEWER_MANIFEST = "+json.dumps(manifest,ensure_ascii=False,separators=(",",":"))+";")
open(OUT_VIEWER,"w",encoding="utf-8").write(html)
open(OUT_PD,"w",encoding="utf-8").write("window.KU_PITCH_DESIGN = "+json.dumps(pd_payload,ensure_ascii=False,separators=(",",":"))+";")
print(f"\n완료: 엔트리 {len(manifest_meta)}(파일 {file_no}) · 검증 {sum(1 for d in pd_out.values() if d['verified'])}/10 · pd {round(os.path.getsize(OUT_PD)/1024)}KB")
