#!/usr/bin/env python3
# korea 힘판 미측정 세션에 ML 추정 GRF 임펄스 변인을 "추정" 표기로 채점 주입(범용).
# 블록=앞발 수직 지지 임펄스(A), 드라이브=뒷발 추진 임펄스(B). 이중계산 회피(제동·peak 제외).
# pos = 엔진 _pctScore(z→정규CDF) 동일. 출처: Driveline OBP(CC BY-NC-SA·검증)·모델은 자체 힘판 학습.
# 사용: python3 inject_korea_grf.py [--write]   (기본 dry-run)
import json,re,math,numpy as np,sys,os
np.seterr(all='ignore')
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../../.."))
if not os.path.isdir(os.path.join(ROOT,"netlify_통합배포")):
    ROOT="/Users/biomotion/Projects/biomotion-pitching-theia/.claude/worktrees/nostalgic-dirac-5d6a75"
WRITE="--write" in sys.argv
KP=f"{ROOT}/netlify_통합배포/pitching/theia/korea/데이터/players.js"

# 주입 명세: {변인: (스테이지, 이름, 단위, cat, hi(dir), flagDetail)}
CAT_BLK="전진 에너지 제동 · COM 제어 · 앞다리 지지 · 앞무릎 전략/위험 분리"
CAT_DRV="KH→FC · Pre-FC 준비의 생성 단계 — 앞으로 미는 힘 생성 · 낮은 자세 유지 · 회전 준비 · 착지(FC) 블로킹 조건 형성"
NOTE="[추정] 힘판 미측정 세션 — 키네마틱 기반 ML 추정(자체 힘판 94선수 학습·선수별 LOSO, 출처 Driveline OBP 검증). 순위/백분위 참고용·실측 아님."
SPEC={
 "leadVGRFImpulse":("block","앞발 수직 지지 임펄스 (추정)","%BW·s",CAT_BLK,1,NOTE),
 "propImpPct":("drive","뒷발 추진 임펄스 (추정)","%BW·s",CAT_DRV,1,NOTE),
}
# 모델
M=json.load(open(f"{ROOT}/pitching/biomotion-theia-dashboard/_분석/grf_ml/grf_impulse_model.json",encoding="utf-8"))
FEATS=M['features']; mu=np.array(M['mu']); sd=np.array(M['sd']); med=np.array(M['median_impute'])
# 규준(메인 N + N.xxx= 별도할당)
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
def st_label(pos): return "우수" if pos>=75 else ("정상" if pos>=40 else "미흡")
raw=open(KP,encoding="utf-8").read(); pre=raw[:raw.index("{")]; post=raw[raw.rindex("}")+1:]
J=json.loads(raw[raw.index("{"):raw.rindex("}")+1])
def gk(pd,key):
    for st in pd.values():
        for m in st:
            if m.get('key')==key and isinstance(m.get('val'),(int,float)): return float(m['val'])
    return np.nan
def est(pd,tgt):
    x=np.array([gk(pd,f) for f in FEATS]); bad=~np.isfinite(x); x[bad]=med[bad]
    return float(((x-mu)/sd)@np.array(M['models'][tgt]['w'])+M['models'][tgt]['b'])
def stscore(pd,stg):
    ps=[m['pos'] for m in pd.get(stg,[]) if m.get('scored') and isinstance(m.get('pos'),(int,float))]
    return round(sum(ps)/len(ps)) if ps else None
changed=0
print(f"{'선수':>8} | {'블록전':>5}{'블록후':>5} | {'드라이브전':>7}{'드라이브후':>7} | 추정변인")
for nm,p in J.items():
    pd=p.get('phaseData',{})
    if not p.get('grf_absent'): continue
    b0=stscore(pd,'block'); d0=stscore(pd,'drive'); added=[]
    for key,(stage,name,unit,cat,hi,note) in SPEC.items():
        if key not in M['models'] or stage not in pd: continue
        if any(m.get('key')==key for m in pd[stage]): continue   # 이미 있으면 스킵(idempotent)
        val=round(est(pd,key),1); pos=pctScore(val,key,hi)
        metric={"key":key,"name":name,"val":val,"unit":unit,"cat":cat,"scored":True,"st":st_label(pos),"pos":pos,"est":True,"flagDetail":note}
        pd[stage].append(metric); added.append(f"{name.split(' (')[0]}={val}(pos{pos})")
    if added: changed+=1
    print(f"{nm[:8]:>8} | {str(b0):>5}{str(stscore(pd,'block')):>5} | {str(d0):>7}{str(stscore(pd,'drive')):>7} | {' · '.join(added)}")
print(f"\n주입 {changed}명. {'[WRITE]' if WRITE else '[dry-run]'}")
if WRITE:
    import hashlib
    out=pre+json.dumps(J,ensure_ascii=False,separators=(",",":"))+post
    open(KP,"w",encoding="utf-8").write(out); print("sha1[:12]=",hashlib.sha1(out.encode()).hexdigest()[:12])
