# -*- coding: utf-8 -*-
"""KU 확장 체력 베이크 (2026-07-07) — 고려대 202606 VALD 8종 전량 반영.
입력: _ku_theia_bake/fitness_202606_csv/*.csv (SSOT·repo 커밋. ephemeral 입력 의존 금지).
산출: korea/데이터/fitness.js (window.__FITNESS_ASSESS) — Theia 10명.
기준: 팀 상대 백분위(측정 코호트 n≈22~28, 절대규준 아님) — 기존 hp_assessment 관례 계승·확장.
검증: 8종 집계 병렬 적대검증 PASS(값 바이트 일치). 방향(시간=낮을수록 좋음) 반영."""
import csv, re, os, json, collections, statistics
HERE=os.path.dirname(os.path.abspath(__file__))
CSVDIR=os.path.join(HERE,"fitness_202606_csv")
OUT=os.path.join(HERE,"..","..","..","netlify_통합배포","pitching","theia","korea","데이터","fitness.js")

def norm(s): return re.sub(r'\s+','',(s or '')).strip()
def fnum(s):
    if s is None: return None
    m=re.match(r'^-?\d+(\.\d+)?', str(s).strip().replace('%',''))
    return float(m.group(0)) if m else None
def side_of(s):
    m=re.search(r'([LR])\s*$', str(s or ''))
    return m.group(1) if m else None
def rd(fn):
    with open(os.path.join(CSVDIR,fn),encoding='utf-8-sig') as fh:
        return list(csv.DictReader(fh))

# ---------- per-test 집계 (검증된 로직) ----------
def best(rows, namekey, valkey, metrics, mode='max'):
    g=collections.defaultdict(list)
    for r in rows:
        nm=norm(r.get(namekey,''))
        if nm: g[nm].append(r)
    out={}
    for nm,rs in g.items():
        cand=[r for r in rs if fnum(r.get(valkey)) is not None]
        if not cand: continue
        pick=(max if mode=='max' else min)(cand, key=lambda r: fnum(r.get(valkey)))
        out[nm]={m: fnum(pick.get(col)) for m,col in metrics.items()}
        out[nm]['_pick']=pick
    return out

imtp=best(rd('IMTP.csv'),'Name','Peak Vertical Force / BM [N/kg] ',
  {'imtp_pf':'Peak Vertical Force [N] ','imtp_pfbm':'Peak Vertical Force / BM [N/kg] ',
   'imtp_rfd100':'RFD - 100ms [N/s] ','imtp_rfd200':'RFD - 200ms [N/s] ','imtp_asym':'Peak Vertical Force % (Asym) (%)'})
sj=best(rd('SJ.csv'),'Name','Jump Height (Flight Time) [cm] ',
  {'sj_h':'Jump Height (Flight Time) [cm] ','sj_ppbm':'Peak Power / BM [W/kg] ','sj_rsimod':'RSI-modified [m/s] ',
   'sj_asym':'Concentric Mean Force % (Asym) (%)'})
cmj=best(rd('CMJ.csv'),'Name','Jump Height (Flight Time) [cm] ',
  {'cmj_h':'Jump Height (Flight Time) [cm] ','cmj_ppbm':'Peak Power / BM [W/kg] ',
   'cmj_pfbm':'Concentric Peak Force / BM [N/kg] ','cmj_rsimod':'RSI-modified [m/s] ',
   'cmj_asym':'Concentric Peak Force % (Asym) (%)'})
ppu=best(rd('PPU.csv'),'Name','Push Up Height (Flight Time) [cm] ',
  {'ppu_h':'Push Up Height (Flight Time) [cm] ','ppu_tof':'Takeoff Peak Force [N] ',
   'ppu_ct':'Contraction Time [ms] ','ppu_land':'Peak Landing Force [N] '})
# asym 방향(어느 쪽이 큰지) 캡처
def asym_side(src, nm, col):
    d=src.get(nm);
    if not d or '_pick' not in d: return None
    return side_of(d['_pick'].get(col))

grip={}
for r in rd('Grip.csv'):
    nm=norm(r.get('Name',''))
    if not nm: continue
    L=fnum(r.get('L Max Force (N)')); R=fnum(r.get('R Max Force (N)'))
    vals=[x for x in (L,R) if x is not None]
    if not vals: continue
    grip[nm]={'grip_max':max(vals),'grip_l':L,'grip_r':R,'grip_asym':fnum(r.get('Force Asymmetry (%)')),
              'grip_asym_side':side_of(r.get('Force Asymmetry (%)'))}

def sprint_grp(fn):
    g=collections.defaultdict(list)
    for r in rd(fn):
        nm=norm((r.get('GivenName','') or '')+(r.get('FamilyName','') or ''))
        if nm: g[nm].append(r)
    return g
spr={}
for nm,rs in sprint_grp('30m.csv').items():
    cand=[r for r in rs if fnum(r.get('Total')) is not None]
    if not cand: continue
    pick=min(cand,key=lambda r:fnum(r.get('Total')))
    spr[nm]={'sprint30_t':fnum(pick.get('Total')),'sprint_v2':fnum(pick.get('Velocity2'))}
agi={}
for nm,rs in sprint_grp('Agility.csv').items():
    cand=[r for r in rs if fnum(r.get('Total')) is not None]
    if not cand: continue
    pick=min(cand,key=lambda r:fnum(r.get('Total')))
    agi[nm]={'agility_t':fnum(pick.get('Total'))}

# ROM: movement별 L/R + 비대칭(방향 포함)
ROM_MOVES=['Hip External Rotation','Hip Internal Rotation','Shoulder External Rotation','Shoulder Internal Rotation']
rom=collections.defaultdict(dict)
for r in rd('ROM.csv'):
    nm=norm(r.get('Name',''))
    if not nm: continue
    region=(r.get('Body Region','') or '').strip(); mv=(r.get('Movement','') or '').strip()
    key=(region+' '+mv).strip()
    if key not in ROM_MOVES: continue
    rom[nm][key]={'L':fnum(r.get('L Max ROM (°)')),'R':fnum(r.get('R Max ROM (°)')),
                  'asym':fnum(r.get('ROM Asymmetry (%)')),'asym_side':side_of(r.get('ROM Asymmetry (°)') or r.get('ROM Asymmetry (%)'))}

# ---------- merge + 코호트 백분위 ----------
P=collections.defaultdict(dict)
for src in (imtp,sj,cmj,ppu,grip,spr,agi):
    for nm,dd in src.items():
        P[nm].update({k:v for k,v in dd.items() if k!='_pick'})
LOWER_BETTER={'sprint30_t','agility_t','ppu_ct','imtp_asym','grip_asym','sj_asym','cmj_asym'}
metrics=set(k for d in P.values() for k in d)
cohort={m:[P[n][m] for n in P if P[n].get(m) is not None] for m in metrics}
def pct(m,v):
    vals=cohort.get(m,[])
    if v is None or len(vals)<3: return None
    rank=sum(1 for x in vals if (x>=v if m in LOWER_BETTER else x<=v))
    return round(rank/len(vals)*100)
def cn(m): return len(cohort.get(m,[]))
# ROM 코호트 분포(참고 밴드)
rom_band={}
for mv in ROM_MOVES:
    vals=[]
    for n,rr in rom.items():
        v=rr.get(mv)
        if v:
            for s in ('L','R'):
                if v.get(s) is not None: vals.append(v[s])
    if vals:
        vals.sort()
        rom_band[mv]={'p25':vals[len(vals)//4],'med':round(statistics.median(vals)),'p75':vals[min(len(vals)-1,3*len(vals)//4)],
                      'max':int(max(vals)*1.15),'n':len(vals)}

# ---------- Theia 10명 구조화 ----------
THEIA=[('홍은성','R'),('홍주환','L'),('정휘진','L'),('정원진','L'),('김범근','L'),
       ('김동환','R'),('김준영','R'),('오훈택','R'),('박경도','R'),('유재동','R')]
def r1(v): return None if v is None else round(v,1)
# 축 정의: key,label,metric,unit,weight,detail_fn
def num(v,nd=1):
    if v is None: return '—'
    return str(int(round(v))) if nd==0 else str(round(v,nd))
def build_axes(nm):
    d=P[nm]
    def ax(key,label,metric,unit,weight,detail):
        v=d.get(metric); p=pct(metric,v)
        return {'key':key,'label_kr':label,'value':r1(v),'unit':unit,'score':p,'norm_pct':p,
                'elite_target':'','velo_group':'','cohort_n':cn(metric),'weight':weight,
                'detail':detail,'not_measured':(v is None)}
    ssc = (r1(d['cmj_h']-d['sj_h']) if d.get('cmj_h') is not None and d.get('sj_h') is not None else None)
    axes=[
        ax('imtp','최대 근력(체중당)','imtp_pfbm','N/kg',1.2,
           ('최대 힘 '+num(d.get('imtp_pf'),0)+'N · RFD100 '+num(d.get('imtp_rfd100'),0)) if d.get('imtp_pf') else '측정 없음'),
        ax('cmj_h','하체 폭발력(CMJ 높이)','cmj_h','cm',1.3,
           ('스쿼트점프 '+num(d.get('sj_h'))+'cm'+((' · 반동 활용 +'+num(ssc)+'cm') if (ssc is not None and ssc>=0) else ((' · 반동 활용 '+num(ssc)+'cm') if ssc is not None else ''))) if d.get('sj_h') is not None else ''),
        ax('cmj_pp','하체 파워(체중당)','cmj_ppbm','W/kg',1.3,
           ('스쿼트점프 파워 '+num(d.get('sj_ppbm'))+'W/kg · 착지 직전 힘 '+num(d.get('cmj_pfbm'))+'N/kg') if d.get('sj_ppbm') is not None else ''),
        ax('rsi','반응 강도(RSI-mod)','cmj_rsimod','',1.0,'접지 시간 대비 체공(신장-단축 반응성)'),
        ax('ppu','상체 파워(PPU)','ppu_h','cm',0.6,
           ('이륙 힘 '+num(d.get('ppu_tof'),0)+'N · 수축시간 '+num(d.get('ppu_ct'),0)+'ms') if d.get('ppu_h') is not None else '측정 없음'),
        ax('grip','악력','grip_max','N',0.5,
           ('좌 '+num(d.get('grip_l'),0)+' / 우 '+num(d.get('grip_r'),0)+'N') if d.get('grip_max') is not None else ''),
        ax('sprint','스피드(30m)','sprint30_t','s',1.0,
           ('구간2 속도 '+num(d.get('sprint_v2'))+'m/s · 낮을수록 빠름') if d.get('sprint30_t') is not None else ''),
        ax('agility','민첩성(5-10-5)','agility_t','s',0.8,'방향전환(프로 어질리티) · 낮을수록 빠름'),
    ]
    return axes
def build_rom(nm,hand):
    rr=rom.get(nm) or {}
    out=[]
    for mv,label,jkey,bilat in [
        ('Hip External Rotation','고관절 바깥 돌리기(외회전)','hip_er',True),
        ('Hip Internal Rotation','고관절 안쪽 돌리기(내회전)','hip_ir',True),
        ('Shoulder External Rotation','어깨 바깥 돌리기(외회전·투구팔)','sh_er',False),
        ('Shoulder Internal Rotation','어깨 안쪽 돌리기(내회전·투구팔)','sh_ir',False)]:
        v=rr.get(mv)
        if not v: continue
        b=rom_band.get(mv,{})
        L,R=v.get('L'),v.get('R')
        row={'key':jkey,'joint':label,'L':r1(L),'R':r1(R),'bilat':bilat,
             'lo':b.get('p25'),'hi':b.get('p75'),'med':b.get('med'),'max':b.get('max'),'n':b.get('n'),
             'asym':r1(v.get('asym')),'asym_side':v.get('asym_side')}
        if bilat:
            mag=max([x for x in (L,R) if x is not None] or [None]) if (L is not None or R is not None) else None
            row['val']=r1(mag); row['pct']=pct_rom(mv,mag)
        else:
            side='R' if hand=='R' else 'L'; sv=R if hand=='R' else L
            if sv is None: sv=next((x for x in (R,L) if x is not None),None)
            row['val']=r1(sv); row['side']=side; row['pct']=pct_rom(mv,sv)
        out.append(row)
    return out
def pct_rom(mv,v):
    if v is None: return None
    vals=[]
    for n,rr in rom.items():
        vv=rr.get(mv)
        if vv:
            for s in ('L','R'):
                if vv.get(s) is not None: vals.append(vv[s])
    if len(vals)<3: return None
    return round(sum(1 for x in vals if x<=v)/len(vals)*100)
def build_asym(nm,hand):
    d=P[nm]; flags=[]
    def add(label,val,side):
        if val is not None and val>=10: flags.append({'label':label,'value':round(val,1),'side':(side or '')})
    add('악력', d.get('grip_asym'), d.get('grip_asym_side'))
    add('최대근력(IMTP)', d.get('imtp_asym'), None)
    add('점프 힘(CMJ)', d.get('cmj_asym'), None)
    rr=rom.get(nm) or {}
    for mv,lab in [('Hip External Rotation','고관절 외회전'),('Hip Internal Rotation','고관절 내회전')]:
        v=rr.get(mv)
        if v and v.get('asym') is not None: add(lab, v.get('asym'), v.get('asym_side'))
    return flags

FIT={}
for nm,hand in THEIA:
    axes=build_axes(nm)
    scored=[a for a in axes if a['score'] is not None]
    wsum=sum(a['weight'] for a in scored); overall=round(sum(a['score']*a['weight'] for a in scored)/wsum) if wsum else None
    FIT[nm]={
        'overall_score':overall,'overall_norm_pct':overall,
        'axes':[{k:v for k,v in a.items() if k!='weight'} for a in axes],
        'rom':build_rom(nm,hand),
        'asymmetry_flags':build_asym(nm,hand),
        'source':'고려대 VALD ForceDecks·DynaMo (2026-06-28)',
        'caveat':'단일 세션·팀 측정 코호트(n≈22~28) 상대 백분위 — 절대 규준 아님. 체력은 구속의 기여요인이며 인과 단정 아님.',
        'session':'20260628','cohort_note':'팀 내 백분위(측정 선수 기준)'
    }

# ---------- 출력 ----------
os.makedirs(os.path.dirname(OUT),exist_ok=True)
with open(OUT,'w',encoding='utf-8') as fh:
    fh.write("window.__FITNESS_ASSESS = "+json.dumps(FIT,ensure_ascii=False)+";\n")
    fh.write("window.__FIT_ROM_BAND = "+json.dumps(rom_band,ensure_ascii=False)+";\n")
print("완료 · fitness.js",round(os.path.getsize(OUT)/1024),"KB · Theia",len(FIT),"명")
for nm,hand in THEIA:
    f=FIT[nm]; axs=' '.join((a['key']+':'+(str(a['score']) if a['score'] is not None else '—')) for a in f['axes'])
    print(f"  {nm:10s} 종합{f['overall_score']} | {axs} | ROM {len(f['rom'])} | 비대칭 {len(f['asymmetry_flags'])}")
