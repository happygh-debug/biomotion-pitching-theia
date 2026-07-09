#!/usr/bin/env python3
# korea 블록 채점에 추정 앞발 수직 임펄스(A등급) 주입. 기본 dry-run, --write 시 반영.
import json,re,math,numpy as np,sys
ROOT="/Users/biomotion/Projects/biomotion-pitching-theia/.claude/worktrees/nostalgic-dirac-5d6a75"
WRITE="--write" in sys.argv
KP=f"{ROOT}/netlify_통합배포/pitching/theia/korea/데이터/players.js"
M=json.load(open(f"{ROOT}/pitching/biomotion-theia-dashboard/_분석/grf_ml/grf_impulse_model.json",encoding="utf-8"))
FEATS=M['features']; mu=np.array(M['mu']); sd=np.array(M['sd']); med=np.array(M['median_impute'])
ns=open(f"{ROOT}/pitching/dashboard_core/pitch_norms.js",encoding="utf-8").read()
def jsobj(t): return json.loads(re.sub(r'([{,]\s*)([a-zA-Z_]\w*)\s*:',r'\1"\2":',t))
N=jsobj(re.search(r'var N = (\{.*?\});',ns,re.S).group(1))
for k,v in re.findall(r'N\.(\w+)\s*=\s*(\{[^}]*\});',ns): N[k]=jsobj(v)
def pctScore(v,key,hi=1):
    n=N.get(key); p25=n.get('q1',n.get('p25')); p75=n.get('q3',n.get('p75'))
    sig=abs(p75-p25)/1.349 or 1; z=(v-n['med'])/sig*(1 if hi else -1)
    t=1/(1+0.2316419*abs(z)); d=0.3989423*math.exp(-z*z/2)
    p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); cdf=1-p if z>0 else p
    return int(round(max(1,min(99,cdf*100))))
raw=open(KP,encoding="utf-8").read(); pre=raw[:raw.index("{")]; post=raw[raw.rindex("}")+1:]
J=json.loads(raw[raw.index("{"):raw.rindex("}")+1])
def gk(pd,key):
    for st in pd.values():
        for m in st:
            if m.get('key')==key and isinstance(m.get('val'),(int,float)): return float(m['val'])
    return np.nan
def est(pd,tgt):
    x=np.array([gk(pd,f) for f in FEATS]); bad=~np.isfinite(x); x[bad]=med[bad]
    z=(x-mu)/sd; return float(z@np.array(M['models'][tgt]['w'])+M['models'][tgt]['b'])
def stscore(pd,stage):
    ps=[m['pos'] for m in pd.get(stage,[]) if m.get('scored') and isinstance(m.get('pos'),(int,float))]
    return round(sum(ps)/len(ps)) if ps else None
def st_label(pos): return "우수" if pos>=75 else ("정상" if pos>=40 else "미흡")
CAT="전진 에너지 제동 · COM 제어 · 앞다리 지지 · 앞무릎 전략/위험 분리"
print(f"{'선수':>8} | {'블록 전':>6} | {'블록 후':>6} | 추정 앞발수직임펄스(pos)")
changed=0
for nm,p in J.items():
    pd=p.get('phaseData',{})
    if 'block' not in pd or not p.get('grf_absent'): continue
    # 이미 주입됐으면 스킵
    if any(m.get('key')=='leadVGRFImpulse' for m in pd['block']): continue
    b0=stscore(pd,'block')
    lv=round(est(pd,'leadVGRFImpulse'),1); pos=pctScore(lv,'leadVGRFImpulse')
    metric={"key":"leadVGRFImpulse","name":"앞발 수직 지지 임펄스 (추정)","val":lv,"unit":"%BW·s","cat":CAT,
            "scored":True,"st":st_label(pos),"pos":pos,"est":True,
            "flagDetail":"[추정] 힘판 미측정 세션 — 키네마틱 기반 ML 추정(자체 힘판 94선수 학습·LOSO r≈0.85, 출처 Driveline OBP 검증). 순위/백분위 참고용, 실측 아님."}
    # comVelReductionFCBR(제동) 뒤에 삽입(같은 제동/지지 맥락)
    idx=next((i for i,m in enumerate(pd['block']) if m.get('key')=='comVelReductionFCBR'),0)
    pd['block'].insert(idx+1, metric)
    b1=stscore(pd,'block'); changed+=1
    print(f"{nm[:8]:>8} | {str(b0):>6} | {str(b1):>6} | {lv}(pos{pos})")
print(f"\n주입 대상 {changed}명 · 블록에 '앞발 수직 지지 임펄스(추정)' 1개 추가(scored). 제동은 comVelReduction 유지(이중계산 회피).")
if WRITE:
    out=pre+json.dumps(J,ensure_ascii=False,separators=(",",":"))+post
    open(KP,"w",encoding="utf-8").write(out)
    import hashlib; print("WROTE players.js · sha1[:12]=",hashlib.sha1(out.encode()).hexdigest()[:12])
else:
    print("\n[dry-run] --write 로 실제 반영.")
