/* dashboard_intro.js — 에너지 흐름 인트로 v7 (render-only · display layer) */
/* BM_INTRO_* — build.py _intro_assets_js() 가 report.engine.js 앞에 주입 (blob URL 호환) */
var _dashboardIntroPending = false;
var _INTRO_SS_KEY = 'bm_intro_seen';
var _INTRO_SS_KEY_LEGACY = 'bm_dashboard_intro_dismissed';

/* [2026-06-13] 인트로 전용 CSS — 전체화면 오버레이 + 2단 hero 레이아웃(누락분 복구). 1회 주입. */
function _injectIntroCss() {
  if (document.getElementById('bm-intro-css')) return;
  var s = document.createElement('style');
  s.id = 'bm-intro-css';
  s.textContent = [
    'body.dashboard-intro-active{overflow:hidden}',
    '#dashboard-intro-root{position:fixed;inset:0;z-index:99999;background:#0b0e14;overflow-y:auto;color:#e8edf5;-webkit-font-smoothing:antialiased}',
    '#dashboard-intro-root[aria-hidden="true"]{display:none}',
    '.bm-intro-scroll{min-height:100%;display:flex;align-items:center;justify-content:center;padding:40px 32px;box-sizing:border-box}',
    '.bm-intro-hero{display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:48px;max-width:1380px;width:100%;align-items:center}',
    '@media(max-width:880px){.bm-intro-hero{grid-template-columns:1fr;gap:28px}}',
    '.bm-intro-left{display:flex;flex-direction:column;gap:18px;min-width:0}',
    '.bm-intro-kicker{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;color:#8190a6;font-weight:600}',
    '.bm-intro-kicker-dot{width:8px;height:8px;border-radius:50%;background:#56bdf0;box-shadow:0 0 8px #56bdf0}',
    '.bm-intro-htitle{font-size:38px;line-height:1.15;font-weight:800;margin:0;color:#fff}',
    '.bm-intro-leak{color:#ff7a45}',
    '.bm-intro-brief{display:flex;flex-direction:column;gap:9px}',
    '.bm-intro-bi{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:baseline;font-size:14px;line-height:1.5}',
    '.bm-intro-bi-k{color:#7f8da3;font-weight:700;font-size:12px}',
    '.bm-intro-bi-v{color:#cdd6e4}.bm-intro-bi-v b{color:#fff}',
    '.bm-intro-hl{color:#ff7a45;font-weight:700}.bm-intro-arr{margin:0 6px;color:#56bdf0}',
    '.bm-intro-readline{display:flex;gap:10px;flex-wrap:wrap}',
    '.bm-intro-rl{flex:1;min-width:110px;border:1px solid #1e2735;border-radius:10px;padding:9px 12px;background:#121722}',
    '.bm-intro-rl-h{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:#fff}',
    '.bm-intro-rl-h i{width:9px;height:9px;border-radius:50%;display:inline-block}',
    '.bm-intro-good .bm-intro-rl-h i,.bm-intro-lg.bm-intro-good i{background:#37d39a}',
    '.bm-intro-warn .bm-intro-rl-h i,.bm-intro-lg.bm-intro-warn i{background:#ffc24b}',
    '.bm-intro-leak .bm-intro-rl-h i,.bm-intro-lg.bm-intro-leak i{background:#ff5a50}',
    '.bm-intro-rl p{margin:4px 0 0;font-size:11.5px;color:#8b97a8}',
    '.intro-start{margin-top:6px;align-self:flex-start;display:inline-flex;align-items:center;gap:8px;background:#2f7fe0;color:#fff;border:0;border-radius:10px;padding:13px 24px;font-size:15px;font-weight:700;cursor:pointer}',
    '.intro-start:hover{background:#3a8df0}',
    '.intro-start svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
    '.bm-intro-mcard{background:#0d1119;border:1px solid #1a2230;border-radius:16px;padding:18px;min-width:0}',
    '.bm-intro-mcard-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:12px}',
    '.bm-intro-mt{font-size:16px;font-weight:800;color:#fff}',
    '.bm-intro-mt small{display:block;font-size:11.5px;font-weight:500;color:#7f8da3;margin-top:2px}',
    '.bm-intro-legend{display:flex;gap:12px;flex-shrink:0}',
    '.bm-intro-lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#9aa6b6}',
    '.bm-intro-lg i{width:8px;height:8px;border-radius:50%;display:inline-block}',
    '.bm-intro-ph-stage{position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:1908/775}',
    '.bm-intro-montage-img{display:block;width:100%;height:100%;object-fit:cover}',
    '.bm-intro-ph-sidefade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(13,17,25,0) 55%,rgba(13,17,25,.55))}',
    '.bm-intro-chain{position:absolute;inset:0;width:100%;height:100%}',
    '.bm-intro-pband{position:relative;height:104px;margin-top:16px}',
    '.bm-intro-rail{position:absolute;top:30px;left:3%;right:3%;height:2px;background:#26324a}',
    '.bm-intro-pb{position:absolute;top:0;transform:translateX(-50%);width:120px;text-align:center}',
    '.bm-intro-pb>i{display:block;width:14px;height:14px;border-radius:50%;margin:24px auto 8px;background:#56bdf0;box-shadow:0 0 8px rgba(86,189,240,.6)}',
    '.bm-intro-pb.bm-intro-c4>i{background:#ff5a50;box-shadow:0 0 8px rgba(255,90,80,.7)}',
    '.bm-intro-pb-nm{display:flex;align-items:center;justify-content:center;gap:5px;font-size:13px;color:#fff;font-weight:700}',
    '.bm-intro-pb-n{color:#7f8da3;font-weight:600;font-size:11px}',
    '.bm-intro-pb p{margin:3px 0 0;font-size:10.5px;color:#8b97a8;line-height:1.3}',
    '.bm-intro-flag{font-style:normal;font-size:9.5px;color:#fff;background:#ff5a50;border-radius:4px;padding:1px 5px;margin-left:3px}',
    '.bm-intro-pband-spacer{display:none}',
    '.bm-intro-cnode .bm-intro-ring{fill:none;stroke:#56bdf0;stroke-width:2}',
    '.bm-intro-cnode.bm-intro-orange .bm-intro-ring{stroke:#ffbf5e}',
    '.bm-intro-cnode .bm-intro-core{fill:#fff}',
    '.bm-intro-ripple{fill:none}'
  ].join('');
  document.head.appendChild(s);
}

function _shouldShowDashboardIntro() {
  try {
    if (sessionStorage.getItem(_INTRO_SS_KEY) === '1') return false;
    if (sessionStorage.getItem(_INTRO_SS_KEY_LEGACY) === '1') return false;
  } catch (e) {}
  return true;
}

function _syncDashboardIntroUi(active) {
  document.body.classList.toggle('dashboard-intro-active', !!active);
  var root = document.getElementById('dashboard-intro-root');
  if (root) root.setAttribute('aria-hidden', active ? 'false' : 'true');
}

function _enterDashboardFromIntro() {
  try {
    sessionStorage.setItem(_INTRO_SS_KEY, '1');
    sessionStorage.setItem(_INTRO_SS_KEY_LEGACY, '1');
  } catch (e) {}
  _dashboardIntroPending = false;
  _syncDashboardIntroUi(false);
  try { if (typeof setPage === 'function') setPage('feedback-view'); } catch (e) {}
  try { if (typeof _fitWidthZoom === 'function') _fitWidthZoom(); } catch (e) {}
}

function _introMontageUri() {
  return (typeof BM_INTRO_MONTAGE_URI !== 'undefined' && BM_INTRO_MONTAGE_URI) ? BM_INTRO_MONTAGE_URI : '';
}

function _introChainSvgHtml() {
  return '<svg class="bm-intro-chain" viewBox="0 0 1908 775" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
    + '<defs>'
    + '<linearGradient id="bmIntroCgblue" x1="0" y1="1" x2="1" y2="0">'
    + '<stop offset="0" stop-color="#1d83cf"/><stop offset="1" stop-color="#56bdf0"/>'
    + '</linearGradient>'
    + '<linearGradient id="bmIntroCgorange" x1="0" y1="1" x2="0" y2="0">'
    + '<stop offset="0" stop-color="#ef8f2e"/><stop offset="1" stop-color="#ffce7a"/>'
    + '</linearGradient>'
    + '<filter id="bmIntroCglow" x="-60%" y="-60%" width="220%" height="220%">'
    + '<feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'
    + '</filter>'
    + '<filter id="bmIntroCglow2" x="-120%" y="-120%" width="340%" height="340%">'
    + '<feGaussianBlur stdDeviation="8"/>'
    + '</filter>'
    + '<path id="bmIntroKBack" d="M1105,735 C1170,712 1250,685 1315,662 C1400,630 1448,540 1480,480"/>'
    + '<path id="bmIntroKFront" d="M1637,742 C1628,715 1618,668 1588,618 C1560,565 1510,510 1480,480 C1492,420 1520,350 1548,292 C1568,287 1592,288 1612,289 C1650,288 1695,282 1728,277"/>'
    + '</defs>'
    + '<g class="bm-intro-rg" style="transform:translate(1105px,750px)"><circle class="bm-intro-ripple bm-intro-blue" r="30"/></g>'
    + '<g class="bm-intro-rg" style="transform:translate(1637px,755px)"><circle class="bm-intro-ripple bm-intro-orange" r="32"/></g>'
    + '<g filter="url(#bmIntroCglow)">'
    + '<line x1="1078" y1="752" x2="1178" y2="662" stroke="#ff5a50" stroke-width="10" stroke-linecap="round"/>'
    + '<path d="M1178,662 l-26,2 m26,-2 l-7,25" stroke="#ff5a50" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    + '</g>'
    + '<g filter="url(#bmIntroCglow)">'
    + '<line x1="1670" y1="748" x2="1638" y2="620" stroke="#ff5a50" stroke-width="11" stroke-linecap="round"/>'
    + '<path d="M1638,620 l-6,25 m6,-25 l17,19" stroke="#ff5a50" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    + '</g>'
    + '<path d="M1105,735 C1170,712 1250,685 1315,662 C1400,630 1448,540 1480,480" fill="none" stroke="url(#bmIntroCgblue)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" filter="url(#bmIntroCglow)"></path>'
    + '<path d="M1105,735 C1170,712 1250,685 1315,662 C1400,630 1448,540 1480,480" fill="none" stroke="#fff" stroke-width="2.6" opacity=".95" stroke-linecap="round" stroke-linejoin="round"></path>'
    + '<path d="M1637,742 C1628,715 1618,668 1588,618 C1560,565 1510,510 1480,480 C1492,420 1520,350 1548,292 C1568,287 1592,288 1612,289 C1650,288 1695,282 1728,277" fill="none" stroke="url(#bmIntroCgorange)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" filter="url(#bmIntroCglow)"></path>'
    + '<path d="M1637,742 C1628,715 1618,668 1588,618 C1560,565 1510,510 1480,480 C1492,420 1520,350 1548,292 C1568,287 1592,288 1612,289 C1650,288 1695,282 1728,277" fill="none" stroke="#fff" stroke-width="2.6" opacity=".95" stroke-linecap="round" stroke-linejoin="round"></path>'
    + '<circle class="bm-intro-spark" r="8" fill="#dff2ff" filter="url(#bmIntroCglow2)"><animateMotion dur="2.2s" repeatCount="indefinite"><mpath href="#bmIntroKBack"/></animateMotion></circle>'
    + '<circle class="bm-intro-spark" r="10" fill="#fff0d8" filter="url(#bmIntroCglow2)"><animateMotion dur="2.6s" begin="0.4s" repeatCount="indefinite"><mpath href="#bmIntroKFront"/></animateMotion></circle>'
    + '<g class="bm-intro-cnode bm-intro-blue"><circle class="bm-intro-halo" cx="1105" cy="735" r="18" fill="#56bdf0" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1105" cy="735" r="12"/><circle class="bm-intro-core" cx="1105" cy="735" r="5"/></g>'
    + '<g class="bm-intro-cnode bm-intro-blue"><circle class="bm-intro-halo" cx="1315" cy="662" r="16" fill="#56bdf0" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1315" cy="662" r="11"/><circle class="bm-intro-core" cx="1315" cy="662" r="5"/></g>'
    + '<g class="bm-intro-cnode bm-intro-blue"><circle class="bm-intro-halo" cx="1480" cy="480" r="22" fill="#bcd9f0" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1480" cy="480" r="14" stroke="#cfe6f7"/><circle class="bm-intro-core" cx="1480" cy="480" r="6"/></g>'
    + '<g class="bm-intro-cnode bm-intro-orange"><circle class="bm-intro-halo" cx="1637" cy="742" r="18" fill="#ffbf5e" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1637" cy="742" r="12"/><circle class="bm-intro-core" cx="1637" cy="742" r="5"/></g>'
    + '<g class="bm-intro-cnode bm-intro-orange"><circle class="bm-intro-halo" cx="1588" cy="618" r="16" fill="#ffbf5e" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1588" cy="618" r="11"/><circle class="bm-intro-core" cx="1588" cy="618" r="5"/></g>'
    + '<g class="bm-intro-cnode bm-intro-orange"><circle class="bm-intro-halo" cx="1548" cy="292" r="18" fill="#ffbf5e" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1548" cy="292" r="12"/><circle class="bm-intro-core" cx="1548" cy="292" r="5"/></g>'
    + '<g class="bm-intro-cnode bm-intro-orange"><circle class="bm-intro-halo" cx="1612" cy="289" r="16" fill="#ffbf5e" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1612" cy="289" r="11"/><circle class="bm-intro-core" cx="1612" cy="289" r="5"/></g>'
    + '<g class="bm-intro-cnode bm-intro-orange"><circle class="bm-intro-halo" cx="1728" cy="277" r="17" fill="#ffbf5e" filter="url(#bmIntroCglow2)"/><circle class="bm-intro-ring" cx="1728" cy="277" r="11"/><circle class="bm-intro-core" cx="1728" cy="277" r="5"/></g>'
    + '</svg>';
}

function _introPbandItems() {
  return [
    { cls: 'bm-intro-c1', left: '11.5%', num: '01', name: '저장', desc: '지면반력 · 탄성 축적' },
    { cls: 'bm-intro-c2', left: '27.7%', num: '02', name: '생성', desc: '하지·골반 회전 토크' },
    { cls: 'bm-intro-c3', left: '40.9%', num: '03', name: '전환', desc: '골반–몸통 분리' },
    { cls: 'bm-intro-c4', left: '58.1%', num: '04', name: '증폭', desc: '상지 분절 가속', flag: true },
    { cls: 'bm-intro-c5', left: '72.3%', num: '05', name: '방출', desc: '릴리스 · 전환' },
    { cls: 'bm-intro-c6', left: '85.4%', num: '06', name: '부하', desc: '잔류 부하 · 리스크' }
  ];
}

function _appendIntroBriefRow(parent, key, html) {
  var row = document.createElement('div');
  row.className = 'bm-intro-bi';
  var k = document.createElement('span');
  k.className = 'bm-intro-bi-k';
  k.textContent = key;
  var v = document.createElement('span');
  v.className = 'bm-intro-bi-v';
  v.innerHTML = html;
  row.appendChild(k);
  row.appendChild(v);
  parent.appendChild(row);
}

function _appendIntroReadlineChip(parent, kind, title, desc) {
  var chip = document.createElement('div');
  chip.className = 'bm-intro-rl bm-intro-' + kind;
  var h = document.createElement('span');
  h.className = 'bm-intro-rl-h';
  var dot = document.createElement('i');
  h.appendChild(dot);
  h.appendChild(document.createTextNode(title));
  var p = document.createElement('p');
  p.textContent = desc;
  chip.appendChild(h);
  chip.appendChild(p);
  parent.appendChild(chip);
}

function _appendIntroStartBtn(parent) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'intro-start';
  btn.id = 'bm-intro-start-btn';
  btn.appendChild(document.createTextNode('분석 시작 '));
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M5 12h14M13 6l6 6-6 6');
  svg.appendChild(path);
  btn.appendChild(svg);
  btn.addEventListener('click', function (e) { e.preventDefault(); _enterDashboardFromIntro(); });
  parent.appendChild(btn);
}

function _appendIntroLeftPanel(hero) {
  var left = document.createElement('div');
  left.className = 'bm-intro-left';
  var kicker = document.createElement('span');
  kicker.className = 'bm-intro-kicker';
  var dot = document.createElement('span');
  dot.className = 'bm-intro-kicker-dot';
  kicker.appendChild(dot);
  kicker.appendChild(document.createTextNode('BIOMOTION · PITCHING BIOMECHANICS'));
  var title = document.createElement('h1');
  title.className = 'bm-intro-htitle';
  var leak = document.createElement('span');
  leak.className = 'bm-intro-leak';
  leak.textContent = '에너지 손실';
  title.appendChild(leak);
  title.appendChild(document.createTextNode('은'));
  title.appendChild(document.createElement('br'));
  title.appendChild(document.createTextNode('어디서 발생하는가'));
  var brief = document.createElement('div');
  brief.className = 'bm-intro-brief';
  _appendIntroBriefRow(brief, '원리', '투구 = <b>지면 → 하지·골반 → 몸통 → 상지 → 공</b>, 단일 운동 사슬');
  _appendIntroBriefRow(brief, '측정', '6개 구간별 <b>에너지 전달 효율</b> 정량화');
  _appendIntroBriefRow(brief, '진단', '<span class="bm-intro-hl">손실 구간 특정</span><span class="bm-intro-arr">→</span>구속 손실 · 부상 리스크 원인 규명');
  var readline = document.createElement('div');
  readline.className = 'bm-intro-readline';
  _appendIntroReadlineChip(readline, 'good', '양호', '기준 범위 내 · 유지');
  _appendIntroReadlineChip(readline, 'warn', '주의', '효율 저하 · 모니터링');
  _appendIntroReadlineChip(readline, 'leak', '손실', '우선 교정 대상');
  left.appendChild(kicker);
  left.appendChild(title);
  left.appendChild(brief);
  left.appendChild(readline);
  _appendIntroStartBtn(left);
  hero.appendChild(left);
}

function _appendIntroLegend(parent) {
  var legend = document.createElement('div');
  legend.className = 'bm-intro-legend';
  [
    { cls: 'good', label: '양호' },
    { cls: 'warn', label: '주의' },
    { cls: 'leak', label: '손실' }
  ].forEach(function (item) {
    var lg = document.createElement('span');
    lg.className = 'bm-intro-lg bm-intro-' + item.cls;
    var dot = document.createElement('i');
    lg.appendChild(dot);
    lg.appendChild(document.createTextNode(item.label));
    legend.appendChild(lg);
  });
  parent.appendChild(legend);
}

function _appendIntroPband(parent) {
  var pband = document.createElement('div');
  pband.className = 'bm-intro-pband';
  var rail = document.createElement('div');
  rail.className = 'bm-intro-rail';
  pband.appendChild(rail);
  _introPbandItems().forEach(function (item) {
    var pb = document.createElement('div');
    pb.className = 'bm-intro-pb ' + item.cls;
    pb.style.left = item.left;
    var dot = document.createElement('i');
    pb.appendChild(dot);
    var nm = document.createElement('span');
    nm.className = 'bm-intro-pb-nm';
    var n = document.createElement('span');
    n.className = 'bm-intro-pb-n';
    n.textContent = item.num;
    var b = document.createElement('b');
    b.textContent = item.name;
    nm.appendChild(n);
    nm.appendChild(b);
    if (item.flag) {
      var flag = document.createElement('em');
      flag.className = 'bm-intro-flag';
      flag.textContent = '손실';
      nm.appendChild(flag);
    }
    pb.appendChild(nm);
    var p = document.createElement('p');
    p.textContent = item.desc;
    pb.appendChild(p);
    pband.appendChild(pb);
  });
  var spacer = document.createElement('div');
  spacer.className = 'bm-intro-pband-spacer';
  pband.appendChild(spacer);
  parent.appendChild(pband);
}

function _appendIntroMcard(hero) {
  var montage = _introMontageUri();
  if (!montage) {
    console.error('[dashboard_intro] BM_INTRO_MONTAGE_URI missing — montage not shown');
    return;
  }
  var mcard = document.createElement('div');
  mcard.className = 'bm-intro-mcard';
  var head = document.createElement('div');
  head.className = 'bm-intro-mcard-head';
  var mt = document.createElement('div');
  mt.className = 'bm-intro-mt';
  mt.appendChild(document.createTextNode('에너지 흐름'));
  var small = document.createElement('small');
  small.textContent = '투구 시퀀스 · 키네틱 체인';
  mt.appendChild(small);
  head.appendChild(mt);
  _appendIntroLegend(head);
  mcard.appendChild(head);
  var phStage = document.createElement('div');
  phStage.className = 'bm-intro-ph-stage';
  var img = document.createElement('img');
  img.className = 'bm-intro-montage-img';
  img.alt = '투구 연속 동작 — 마지막 국면 선수에 키네틱 체인 오버레이';
  img.decoding = 'async';
  img.src = montage;
  phStage.appendChild(img);
  var sidefade = document.createElement('div');
  sidefade.className = 'bm-intro-ph-sidefade';
  phStage.appendChild(sidefade);
  var chainHost = document.createElement('div');
  chainHost.innerHTML = _introChainSvgHtml();
  phStage.appendChild(chainHost.firstChild);
  mcard.appendChild(phStage);
  _appendIntroPband(mcard);
  hero.appendChild(mcard);
}

function _renderDashboardIntro(root) {
  _injectIntroCss();
  while (root.firstChild) root.removeChild(root.firstChild);
  var scroll = document.createElement('div');
  scroll.className = 'bm-intro-scroll';
  var hero = document.createElement('div');
  hero.className = 'bm-intro-hero';
  _appendIntroLeftPanel(hero);
  _appendIntroMcard(hero);
  scroll.appendChild(hero);
  root.appendChild(scroll);
}

function _initDashboardIntro() {
  // [2026-06-18] 인트로 페이지 제거 — 렌더하지 않고 곧바로 대시보드(DB/업로드)로 진입(= '시작' 자동 클릭).
  //   인트로 오버레이를 띄우지 않으므로 하단 업로드·저장선수(DB)·클라우드 화면이 즉시 표시됨.
  _dashboardIntroPending = false;
  try { _enterDashboardFromIntro(); } catch (e) { try { _syncDashboardIntroUi(false); } catch (e2) {} }
  return false;
}

/* 구 concat 순서(engine→hero) 잔존 번들: init 시 montage 미할당이면 여기서 재렌더 */
(function _bmIntroLateRefresh() {
  if (!_dashboardIntroPending) return;
  var root = document.getElementById('dashboard-intro-root');
  if (!root || root.querySelector('.bm-intro-montage-img')) return;
  if (!_introMontageUri()) return;
  _renderDashboardIntro(root);
  _syncDashboardIntroUi(true);
})();
