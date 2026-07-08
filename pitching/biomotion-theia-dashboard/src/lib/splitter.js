/* 스틱 viewer 플로팅 분리 — 리사이즈는 report.engine.js _initStickResize 가 담당 */
   스틱 분리(플로팅) 기능 — 메인 3D 스틱 패널을 떠다니는 창으로 분리
   · 드래그 헤더바로 자유 이동 · 탭을 넘겨도 화면에 고정되어 따라다님
   · 도킹(원위치) / 닫기 버튼 · 재생 컨트롤(playback-card) 포함된 채 분리
   · 상태(분리 여부·위치·닫힘)는 localStorage 에 저장
─────────────────────────────────────────────────────────────── */
(function(){
  const lp=document.querySelector('.left-panel');
  const layout=document.querySelector('.layout');
  if(!lp || !layout) return;
  const fire=()=>{ try{ window.dispatchEvent(new Event('resize')); }catch(e){} };

  // ── 스타일 주입 (단일 파일로 3엔진 이식 용이) ──
  const css=
   '.layout.has-floating-stick{grid-template-columns:1fr}'
  +'.left-panel.floating{position:fixed;z-index:9000;width:var(--left-w,380px);max-height:calc(100vh - 20px);overflow-y:auto;background:var(--bg0,#0f1218);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 50px rgba(0,0,0,.6);padding:0 8px 8px}'
  +'.left-panel.closed{display:none !important}'
  +'.stick-dragbar{display:none}'
  +'.left-panel.floating .stick-dragbar{display:flex;align-items:center;gap:6px;cursor:move;padding:8px 6px 8px 11px;margin:0 -8px 8px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:12px 12px 0 0;user-select:none;position:sticky;top:0;z-index:2}'
  +'.stick-dragbar .sdb-title{font-size:12.5px;font-weight:700;color:var(--fg1);flex:1;pointer-events:none}'
  +'.stick-dragbar button{background:var(--bg2,#222834);color:var(--fg1);border:1px solid var(--line);border-radius:6px;padding:3px 9px;font-size:12px;font-weight:600;cursor:pointer}'
  +'.stick-dragbar button:hover{background:var(--bg1);color:var(--fg0)}'
  +'.sfloat-btn{background:transparent;color:var(--fg2);border:1px solid var(--line);border-radius:6px;padding:2px 8px;font-size:11.5px;font-weight:600;cursor:pointer}'
  +'.sfloat-btn:hover{color:var(--fg0);border-color:var(--fg2)}'
  +'.left-panel.floating .sfloat-btn{display:none}'
  +'.stick-reopen{position:fixed;left:14px;bottom:14px;z-index:9001;display:none;background:var(--amber,#e8954e);color:#0b0d12;border:none;border-radius:999px;padding:9px 15px;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.45)}'
  +'.stick-reopen:hover{filter:brightness(1.07)}';
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  // ── 드래그 헤더바 (플로팅 시에만 표시) ──
  const bar=document.createElement('div'); bar.className='stick-dragbar';
  bar.innerHTML='<span class="sdb-title">🦴 3D 스틱</span>'
    +'<button type="button" data-act="dock" title="원래 위치로 되돌리기">⊟ 도킹</button>'
    +'<button type="button" data-act="close" title="닫기">✕</button>';
  lp.insertBefore(bar, lp.firstChild);

  // ── 분리 버튼 — 뷰 버튼들(viewer-jumps) 옆에 추가 ──
  const jumps=document.querySelector('.viewer-jumps');
  const btn=document.createElement('button');
  btn.type='button'; btn.className='sfloat-btn'; btn.id='btn-stick-float';
  btn.textContent='⤢ 분리'; btn.title='3D 스틱을 떠다니는 창으로 분리';
  if(jumps) jumps.appendChild(btn); else bar.appendChild(btn);

  // ── 닫았을 때 다시 여는 알약 버튼 ──
  const pill=document.createElement('button');
  pill.type='button'; pill.className='stick-reopen'; pill.textContent='🦴 스틱 열기';
  document.body.appendChild(pill);

  const KEY_FLOAT='bpr.stick_float', KEY_POS='bpr.stick_float_pos', KEY_CLOSED='bpr.stick_closed';

  function clampPos(x,y){
    const w=lp.offsetWidth||380;
    x=Math.max(4, Math.min(window.innerWidth - w - 4, x));
    y=Math.max(4, Math.min(window.innerHeight - 44, y));   // 헤더바는 항상 잡히도록
    return {x:x, y:y};
  }
  function applyPos(x,y){ lp.style.left=x+'px'; lp.style.top=y+'px'; }
  function savePos(){ try{ localStorage.setItem(KEY_POS, parseFloat(lp.style.left)+'|'+parseFloat(lp.style.top)); }catch(e){} }

  function enterFloat(restore){
    layout.classList.add('has-floating-stick');
    lp.classList.add('floating');
    let x=NaN, y=NaN;
    if(restore){
      try{ const s=(localStorage.getItem(KEY_POS)||'').split('|'); x=parseFloat(s[0]); y=parseFloat(s[1]); }catch(e){}
    }
    if(!isFinite(x)||!isFinite(y)){ x=window.innerWidth - (lp.offsetWidth||380) - 24; y=88; }
    const p=clampPos(x,y); applyPos(p.x,p.y);
    try{ localStorage.setItem(KEY_FLOAT,'1'); }catch(e){}
    fire();
  }
  function exitFloat(){
    lp.classList.remove('floating'); layout.classList.remove('has-floating-stick');
    lp.style.left=''; lp.style.top='';
    try{ localStorage.setItem(KEY_FLOAT,'0'); }catch(e){}
    fire();
  }
  function closePanel(){
    lp.classList.add('closed'); pill.style.display='block';
    try{ localStorage.setItem(KEY_CLOSED,'1'); }catch(e){}
  }
  function openPanel(){
    lp.classList.remove('closed'); pill.style.display='none';
    try{ localStorage.setItem(KEY_CLOSED,'0'); }catch(e){}
    fire();
  }

  btn.addEventListener('click', ()=> enterFloat(true));
  bar.addEventListener('click', e=>{
    const t=e.target;
    const act=t && t.getAttribute ? t.getAttribute('data-act') : null;
    if(act==='dock') exitFloat();
    else if(act==='close') closePanel();
  });
  pill.addEventListener('click', openPanel);

  // ── 헤더바 드래그 이동 ──
  let mdrag=false, ox=0, oy=0;
  bar.addEventListener('mousedown', e=>{
    if(e.target && e.target.tagName==='BUTTON') return;       // 버튼은 드래그 제외
    if(!lp.classList.contains('floating')) return;
    mdrag=true;
    const r=lp.getBoundingClientRect();
    ox=e.clientX-r.left; oy=e.clientY-r.top;
    document.body.style.userSelect='none'; e.preventDefault();
  });
  window.addEventListener('mousemove', e=>{
    if(!mdrag) return;
    const p=clampPos(e.clientX-ox, e.clientY-oy); applyPos(p.x,p.y);
  });
  window.addEventListener('mouseup', ()=>{
    if(mdrag){ mdrag=false; document.body.style.userSelect=''; savePos(); }
  });

  // 창 크기 변경 시 화면 밖으로 나가지 않게 보정
  window.addEventListener('resize', ()=>{
    if(!lp.classList.contains('floating')) return;
    const x=parseFloat(lp.style.left), y=parseFloat(lp.style.top);
    if(isFinite(x)&&isFinite(y)){ const p=clampPos(x,y); applyPos(p.x,p.y); }
  });

  // ── 저장된 상태 복원 ──
  try{
    if(localStorage.getItem(KEY_FLOAT)==='1') enterFloat(true);
    if(localStorage.getItem(KEY_CLOSED)==='1') closePanel();
  }catch(e){}
})();
