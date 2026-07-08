# -*- coding: utf-8 -*-
"""KU 시퀀스 시계열 베이크 (2026-07-07 연구원 요청: 골반-몸통-팔 각속도 시계열+피크 타이밍, 동작 요약 최상단)
대표 trial(frames manifest)에서 Pelvis/Thorax/Humerus 각속도 + Back_Hip_Angle_X 추출 →
이벤트 정규화·다운샘플·피크(값·BR기준 ms) → korea/데이터/sequence.js (window.KU_SEQUENCE)."""
import json, os, re
KOREA="/Users/biomotion/Projects/biomotion-platform-pitching/netlify_통합배포/pitching/theia/korea"
man=json.load(open(os.path.join(KOREA,"데이터/frames/manifest.json"),encoding="utf-8"))
NPTS=120
def absf(v): return abs(v) if isinstance(v,(int,float)) else None
def peak(arr,i0,i1):
    bi,bv=None,-1
    for i in range(max(0,i0),min(i1+1,len(arr))):
        a=absf(arr[i])
        if a is not None and a>bv: bv=a; bi=i
    return bi,(round(bv,0) if bi is not None else None)
def ds(arr,w0,w1,n=NPTS):
    seg=arr[w0:w1]; L=len(seg)
    if L<=n: return [round(absf(x) or 0,0) for x in seg]
    out=[]
    for k in range(n):
        i=int(k*(L-1)/(n-1)); v=absf(seg[i]); out.append(round(v or 0,0))
    return out
OUT={}
for nm in man["order"]:
    info=man["players"].get(nm)
    if not info: continue
    fp=os.path.join(KOREA, info["file"].split("?")[0])
    if not os.path.exists(fp): continue
    d=json.load(open(fp,encoding="utf-8")); S=d.get("series",{}); ev=d.get("events",{}); dt=d.get("dt",0.004)
    kh=ev.get("i_kl_peak",0) or 0; fc=ev.get("i_fc"); mer=ev.get("i_mer"); br=ev.get("i_br")
    if br is None: continue
    pel=S.get("Pelvis_Ang_Vel_Z"); trk=S.get("Thorax_Ang_Vel_Z"); arm=S.get("Pitching_Humerus_Ang_Vel_Z")
    if not(pel and trk and arm): continue
    w0=max(0,kh-10); w1=min(len(pel), br+25)
    def frac(i): return None if i is None else round((i-w0)/max(1,(w1-1-w0)),4)
    def pk(arr):
        bi,bv=peak(arr, kh, br)
        return {"v":bv, "ms":(round((bi-br)*dt*1000) if bi is not None else None), "x":frac(bi)}
    OUT[nm]={
        "pel":ds(pel,w0,w1), "trk":ds(trk,w0,w1), "arm":ds(arm,w0,w1),
        "ev":{"kh":frac(kh),"fc":frac(fc),"mer":frac(mer),"br":frac(br)},
        "pk":{"pel":pk(pel),"trk":pk(trk),"arm":pk(arm)},
    }
    p=OUT[nm]["pk"]
    # 근위→원위 순서 정상 여부(골반 피크 ≤ 몸통 ≤ 팔)
    order_ok=None
    try:
        xs=[p["pel"]["x"],p["trk"]["x"],p["arm"]["x"]]
        if all(x is not None for x in xs): order_ok = xs[0]<=xs[1]<=xs[2]
    except: pass
    OUT[nm]["seqOK"]=order_ok
open(os.path.join(KOREA,"데이터/sequence.js"),"w",encoding="utf-8").write("window.KU_SEQUENCE = "+json.dumps(OUT,ensure_ascii=False,separators=(",",":"))+";\n")
sz=os.path.getsize(os.path.join(KOREA,"데이터/sequence.js"))
print(f"완료 · {len(OUT)}명 · sequence.js {round(sz/1024)}KB")
for nm in man["order"]:
    if nm in OUT:
        p=OUT[nm]["pk"]; print(f"  {nm}: 골반 pk {p['pel']['v']}@{p['pel']['ms']}ms · 몸통 {p['trk']['v']}@{p['trk']['ms']} · 팔 {p['arm']['v']}@{p['arm']['ms']} · 순서{'OK' if OUT[nm]['seqOK'] else '역전' if OUT[nm]['seqOK'] is False else '?'}")
