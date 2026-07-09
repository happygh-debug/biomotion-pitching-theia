#!/usr/bin/env python3
# OBP-ML 착수 최종 — A/B등급 임펄스 변인 모델 최종학습 + korea 적용 시연 + 계수 저장(JS 이식용)
# 출처표기: Driveline OpenBiomechanics Project (CC BY-NC-SA 4.0). 주 학습셋=자체 힘판(코호트·상동고).
import json,numpy as np,os
np.seterr(all='ignore')
ROOT="/Users/biomotion/Projects/biomotion-pitching-theia/.claude/worktrees/nostalgic-dirac-5d6a75"
OUT=os.path.dirname(os.path.abspath(__file__))
FEATS=['armRotV','elbowExtV','torsoRotV','xfPeak','xfPeakFromFC','xfUnwindV','merPk','pelvisRotV','comVel','comVelFC','comDecel','comKEdrop','comVDrop','comVelReductionFCBR','leadKneeVelPk','strideLen','strideTime','hssFC','hssBuildKF','kneeExtROM','leanBack','trunkLeanChange','openAng','pelClose','pelOpenKF','trkOpenKF','postureMaint','hipHinge','wuPelVel','wuTrkVel','wuHSS','wuPelCoil','wuTrunkCoil','leadFootAngleFC','leadKneeFlexFC','leadKneeFlexionBR','driveKneeFlexKF','trunkFlexV','trunkLatV','whipRatio','chainTiming','kneeTrunkLag','seqPct','propPeakTiming']
TARGS={'leadVGRFImpulse':'앞발 수직 임펄스','apBrakeImpulse':'앞발 제동 임펄스','propImpPct':'추진 임펄스비','rearProp':'뒷발 추진'}  # A/B등급만
def load(path):
    s=open(path,encoding="utf-8").read(); return json.loads(s[s.index("{"):s.rindex("}")+1])
def gk(pd,key):
    for st in pd.values():
        for m in st:
            if m.get('key')==key and isinstance(m.get('val'),(int,float)): return float(m['val'])
    return np.nan
def matrix(J,keys):
    X=[];names=[]
    for nm,p in J.items():
        pd=p.get('phaseData',{})
        if not pd: continue
        X.append([gk(pd,k) for k in keys]); names.append(nm)
    return np.array(X),names
JT=load(f"{ROOT}/netlify_통합배포/pitching/theia/dashboard/데이터/players.js")   # 힘판 있음(학습)
JK=load(f"{ROOT}/netlify_통합배포/pitching/theia/korea/데이터/players.js")       # 힘판 없음(적용)
Xtr,ntr=matrix(JT,FEATS); Ytr={t:matrix(JT,[t])[0].ravel() for t in TARGS}
Xko,nko=matrix(JK,FEATS)
# 결측 대치(학습셋 중앙값 기준 — korea도 동일 통계로)
med=np.nanmedian(np.where(np.isfinite(Xtr),Xtr,np.nan),axis=0); med[~np.isfinite(med)]=0
def fill(X):
    X=X.copy()
    for j in range(X.shape[1]): X[~np.isfinite(X[:,j]),j]=med[j]
    return X
Xtr=fill(Xtr); Xko=fill(Xko)
mu=Xtr.mean(0); sd=Xtr.std(0); sd[sd<1e-9]=1
def ridge(A,y,a=12.): return np.linalg.solve(A.T@A+a*np.eye(A.shape[1]),A.T@(y-y.mean())),y.mean()
Az=(Xtr-mu)/sd; Bk=(Xko-mu)/sd
model={}
print("=== 최종 모델 학습 + korea 적용 ===")
for t,lab in TARGS.items():
    y=Ytr[t]; ok=np.isfinite(y)
    w,b=ridge(Az[ok],y[ok])
    model[t]={'w':w.tolist(),'b':float(b)}
    predK=Bk@w+b
    # 학습셋 실측 분포(백분위 산출용)
    lo,hi=np.percentile(y[ok],[10,90])
    print(f"\n[{lab}] 학습 실측 중앙 {np.median(y[ok]):.1f} (10~90%: {lo:.1f}~{hi:.1f})")
    print(f"   korea 추정 예시:", {nko[i]:round(float(predK[i]),1) for i in range(min(4,len(nko)))})
# 계수 저장(JS 이식용)
art={'source':'Driveline OBP (CC BY-NC-SA) + 자체 힘판 코호트','features':FEATS,'mu':mu.tolist(),'sd':sd.tolist(),'median_impute':med.tolist(),'models':model,
     'note':'Ridge 선형·선수별 LOSO 검증(임펄스 A r~0.85, 추진 B r~0.6-0.7). peak는 미포함(D). 표시/순위용·추정 라벨 필수.'}
json.dump(art,open(f"{OUT}/grf_impulse_model.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(f"\n계수 저장: {OUT}/grf_impulse_model.json ({len(FEATS)}피처×{len(TARGS)}타깃, JS 이식 자명)")
