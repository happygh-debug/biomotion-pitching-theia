/*
 * INTEG-01 Phase 2 — 동작뷰어 frame 변환 (표시 전용)
 *
 * 신규 Theia 업로드 선수의 동작 frame(landmark 시계열·events·series)을
 * cho motion_viewer JSON 형식으로 변환하고, viewer가 정적 fetch 실패/매니페스트
 * 부재 시 세션(localStorage) frame으로 fallback 하도록 한다.
 *
 * 가드레일: 점수 산식(mech6/mech5/phases/pitch_norms) 미변경. 이 모듈은
 * 기하/시계열 데이터를 재구성(reshape)만 하며 어떤 점수도 재계산하지 않는다.
 *
 * 역할 분리(Phase 1과 동일):
 *   - 생산자(theia/index.html, dashboard.runner.js): 원본 trial(frames dict·series·events·meta)을
 *     세션키 SESSION_KEY_FRAMES 에 그대로 저장(인라인 _p2StoreFrames).
 *   - 소비자(motion_viewer.html, 이 모듈): 저장된 원본을 읽어 theiaToViewerTrial()로 변환해 반환,
 *     그리고 VIEWER_MANIFEST 에 세션 선수를 등록(registerSessionManifest).
 *
 * 저장 형식 (localStorage + sessionStorage, 키 SESSION_KEY_FRAMES):
 *   { version:1, savedAt:<ms>, players:[ { name, trial:{frames,series,events,meta}, meta:{...}, savedAt } ] }
 *   - 새 탭 핸드오프(window.open) 때문에 localStorage 필수.
 *   - 최근 MAX_SESSION_FRAMES(3) 명만 유지(선수당 ~220KB).
 */
(function (root) {
  "use strict";

  var SESSION_KEY_FRAMES = "biomotion:dashboard:session:frames";
  var MAX_SESSION_FRAMES = 6;   // [fast/slow] 선수당 2개(빠른·느린) × ~3명

  // cho viewer 표준 landmark 순서(20). com 은 입력 frame 에 존재할 때만 추가한다.
  var BASE_LM = [
    "pelvis_o", "neck", "head", "l_shoulder", "r_shoulder", "l_elbow", "r_elbow",
    "l_wrist", "r_wrist", "l_hip", "r_hip", "l_knee", "r_knee", "l_heel", "r_heel",
    "l_toe", "r_toe", "l_hand_tip", "r_hand_tip"
  ];

  // viewer 가 소비하는 series 화이트리스트. theia series 키와 동일(항등 매핑) — 존재하는 키만 복사.
  var CHO_SERIES = [
    "FP1_X", "FP1_Y", "FP1_Z", "FP2_X", "FP2_Y", "FP2_Z",
    "Lead_Knee_Angle_X", "Pelvis_Ang_Vel_Z", "Pitching_Elbow_Angle_X",
    "Pitching_Forearm_Ang_Vel_Z", "Pitching_Hand_Ang_Vel_X", "Pitching_Humerus_Ang_Vel_Z",
    "Pitching_Shoulder_Angle_X", "Pitching_Shoulder_Angle_Z", "Thorax_Ang_Vel_Z",
    "Trunk_Angle_X", "Trunk_Angle_Y", "Trunk_wrt_Pelvis_Angle_Z"
  ];

  // viewer events 화이트리스트. i_mer 은 theia extractTrial 에서 이미 i_mer_erpeak 로 해소됨.
  var EVENT_KEYS = ["i_kl_peak", "i_fc", "i_mer", "i_br", "i_br100"];

  function nowMs() {
    try { return Date.now(); } catch (e) { return 0; }
  }

  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : undefined;
    if (v === "" || v == null) return undefined;
    var n = Number(v);
    return isFinite(n) ? n : undefined;
  }

  function firstNum() {
    for (var i = 0; i < arguments.length; i += 1) {
      var n = num(arguments[i]);
      if (n !== undefined) return n;
    }
    return undefined;
  }

  function firstDefined() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== "") return arguments[i];
    }
    return undefined;
  }

  function normHand(v) {
    var s = (v == null ? "" : String(v)).trim();
    if (!s) return "";
    var c = s.charAt(0).toUpperCase();
    if (c === "L" || s.indexOf("좌") >= 0) return "L";
    if (c === "R" || s.indexOf("우") >= 0) return "R";
    return c;
  }

  function readStore(store, key) {
    try { return store && store.getItem ? store.getItem(key) : null; } catch (e) { return null; }
  }

  function writeStore(store, key, value) {
    try { if (store && store.setItem) { store.setItem(key, value); return true; } } catch (e) {}
    return false;
  }

  function safeParse(value) {
    if (!value || typeof value !== "string") return null;
    try { return JSON.parse(value); } catch (e) { return null; }
  }

  /**
   * 원본 theia trial(frames=소문자키 dict 배열, mm) → cho viewer trial(frames=LM순 배열).
   * 순수함수. 점수 산술 없음.
   * @param {{frames:Array<Object>, series:Object, events:Object, meta?:Object, setup?:Object}} trial
   * @param {Object} [meta] label/name/velo/hand/group/height_m/mass_kg/fps/dt/ground_y_m 등
   */
  // [2026-06-18] 세션 프레임 _canon — 베이크 extract_viewer_data._canon 의 JS 포팅.
  //   up=머리−발→+Y, facing=stride→+Z 회전 R 을 landmark·GRF 에 동일 적용. 세션은 raw 저장이라
  //   GRF(포스플레이트 Z-up)가 미회전→화살표 방향 오류였음(서초율 검증: raw FP1_Z→canon FP1_Y 베이크 수치일치).
  function _p2Canon(srcFrames, srcSeries, LM, hand, iBrWin) {
    function v(p){ return (p && p.length>=3 && isFinite(+p[0]) && isFinite(+p[1]) && isFinite(+p[2])) ? [+p[0],+p[1],+p[2]] : null; }
    function sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
    function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
    function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
    function nz(a){ var m=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/m,a[1]/m,a[2]/m]; }
    function meanF(rows){ var s=[0,0,0],c=0; rows.forEach(function(r){ if(r){s[0]+=r[0];s[1]+=r[1];s[2]+=r[2];c++;} }); return c?[s[0]/c,s[1]/c,s[2]/c]:null; }
    var W = srcFrames.length, feetK=["l_heel","r_heel","l_toe","r_toe"];
    var headK = srcFrames.some(function(f){return f&&f.head;}) ? "head" : "neck";
    var comK  = srcFrames.some(function(f){return f&&f.com;})  ? "com"  : "pelvis_o";
    var footC = srcFrames.map(function(f){ return meanF(feetK.map(function(k){return v(f&&f[k]);})); });
    var up = nz(meanF(srcFrames.map(function(f,i){ var h=v(f&&f[headK]); return (h&&footC[i])?sub(h,footC[i]):null; })) || [0,1,0]);
    var com = srcFrames.map(function(f){ return v(f&&f[comK]); });
    var c0=null,i; for(i=0;i<W;i++){ if(com[i]){c0=com[i];break;} } if(!c0) c0=v(srcFrames[0]&&srcFrames[0].pelvis_o)||[0,0,0];
    var ib=Math.min((iBrWin!=null?iBrWin:W-1),W-1), cB=com[ib];
    if(!cB){ for(i=W-1;i>=0;i--){ if(com[i]){cB=com[i];break;} } } if(!cB)cB=c0;
    var stride=sub(cB,c0), sd=dot(stride,up), fwd=[stride[0]-up[0]*sd, stride[1]-up[1]*sd, stride[2]-up[2]*sd];
    if(Math.hypot(fwd[0],fwd[1],fwd[2])<1e-6) fwd=[-up[0]*up[2], -up[1]*up[2], 1-up[2]*up[2]];
    fwd=nz(fwd); var right=nz(cross(up,fwd)); fwd=cross(right,up);
    function rot(p){ return [dot(p,right), dot(p,up), dot(p,fwd)]; }
    var arr = srcFrames.map(function(f){ var o={}; LM.forEach(function(nm){ var p=v(f&&f[nm]); o[nm]=p?rot(p):null; }); return o; });
    var ground=Infinity; arr.forEach(function(o){ var fc=meanF(feetK.map(function(k){return o[k];})); if(fc&&fc[1]<ground)ground=fc[1]; }); if(!isFinite(ground))ground=0;
    var rear=(String(hand||"R").toUpperCase()!=="L"?"r":"l")+"_heel", rf=null;
    for(i=0;i<W;i++){ if(arr[i][rear]){rf=arr[i][rear];break;} } if(!rf)rf=[0,ground,0];
    var off=[rf[0],ground,rf[2]];
    var frames = arr.map(function(o){ return LM.map(function(nm){ var p=o[nm]; return p?[Math.round((p[0]-off[0])*10)/10, Math.round((p[1]-off[1])*10)/10, Math.round((p[2]-off[2])*10)/10]:null; }); });
    var forces={};
    ["FP1","FP2"].forEach(function(fp){   // 힘 stored-frame [X, Z(up), Y] → rot (au=Z·horiz=[X,Y])
      var sx=srcSeries[fp+"_X"]||[], sU=srcSeries[fp+"_Z"]||[], sz=srcSeries[fp+"_Y"]||[];
      var nn=Math.max(sx.length,sU.length,sz.length), X=[],Y=[],Z=[];
      for(var ii=0;ii<nn;ii++){ var fc=rot([+sx[ii]||0,+sU[ii]||0,+sz[ii]||0]); X.push(Math.round(fc[0]*10)/10);Y.push(Math.round(fc[1]*10)/10);Z.push(Math.round(fc[2]*10)/10); }
      forces[fp]={X:X,Y:Y,Z:Z};
    });
    return { frames: frames, forces: forces };
  }

  function theiaToViewerTrial(trial, meta) {
    trial = trial || {};
    meta = meta || {};
    var tmeta = trial.meta || trial.setup || {};
    var srcFrames = Array.isArray(trial.frames) ? trial.frames : [];

    var hasCom = srcFrames.some(function (f) { return f && f.com; });
    var LM = hasCom ? BASE_LM.concat(["com"]) : BASE_LM.slice();

    var _canonOut = _p2Canon(srcFrames, trial.series || {}, LM, firstDefined(meta.hand, meta.handedness, trial.hand, tmeta.handedness), num((trial.events || tmeta.events || {}).i_br));
    var frames = _canonOut.frames;
    var n = frames.length;

    var srcEv = trial.events || tmeta.events || {};
    var events = {};
    EVENT_KEYS.forEach(function (k) {
      var v = num(srcEv[k]);
      if (v !== undefined) events[k] = v;
    });

    var srcSeries = trial.series || {};
    var series = {};
    CHO_SERIES.forEach(function (k) {
      if (k.indexOf("FP1_") === 0 || k.indexOf("FP2_") === 0) return;   // 힘은 정규화본(_p2Canon)으로 대체
      var s = srcSeries[k];
      if (Array.isArray(s)) series[k] = (s.length > n ? s.slice(0, n) : s);
    });
    ["FP1", "FP2"].forEach(function (fp) { ["X", "Y", "Z"].forEach(function (ax) { series[fp + "_" + ax] = _canonOut.forces[fp][ax]; }); });

    var dt = firstNum(meta.dt, tmeta.dt, trial.dt);
    var fps = firstNum(meta.fps, tmeta.fps);
    if (fps === undefined && dt) fps = Math.round((1 / dt) * 10) / 10;

    return {
      label: firstDefined(meta.label, meta.name, trial.label, trial.name) || "",
      name: firstDefined(meta.name, trial.name) || "",
      velo: firstDefined(meta.velo, trial.velo),
      hand: normHand(firstDefined(meta.hand, meta.handedness, trial.hand)),
      fps: fps,
      dt: dt,
      height_m: firstNum(meta.height_m, tmeta.height_m),
      mass_kg: firstNum(meta.mass_kg, meta.weight_kg, tmeta.mass_kg),
      ground_y_m: firstNum(meta.ground_y_m, tmeta.ground_y_m) || 0,
      canon: true,
      n: n,
      group: firstDefined(meta.group, trial.group) || "세션",
      events: events,
      LM: LM,
      frames: frames,
      series: series
    };
  }

  function readSessionFrames() {
    var stores = [root.sessionStorage, root.localStorage];
    var byName = {};
    stores.forEach(function (store) {
      var parsed = safeParse(readStore(store, SESSION_KEY_FRAMES));
      var arr = parsed && Array.isArray(parsed.players) ? parsed.players : (Array.isArray(parsed) ? parsed : []);
      arr.forEach(function (item) {
        if (!item || !item.name) return;
        var _sys = item.meta && item.meta.system;   // [격리] 타트랙(업리프트) 세션 frame 제외 — base 이름충돌·드롭다운 누수 방지(라이브 저장은 러너 inline이라 무영향)
        if (_sys === "Uplift" || _sys === "IMU") return;
        byName[String(item.name).trim()] = item;
      });
    });
    return Object.keys(byName).map(function (k) { return byName[k]; });
  }

  /** 이름으로 세션 frame 을 찾아 viewer 형식으로 변환해 반환. 없으면 null. */
  function loadFrames(name) {
    var key = (name == null ? "" : String(name)).trim();
    if (!key) return null;
    var list = readSessionFrames();
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      if (item && String(item.name).trim() === key && item.trial) {
        try { return theiaToViewerTrial(item.trial, item.meta || { name: key }); } catch (e) { return null; }
      }
    }
    return null;
  }

  function manifestEntryFrom(item) {
    var m = item.meta || {};
    return {
      label: firstDefined(m.label, m.name, item.name),
      name: firstDefined(m.name, item.name),
      velo: m.velo,
      hand: normHand(m.hand),
      group: firstDefined(m.group, "세션"),
      fps: firstNum(m.fps),
      dt: firstNum(m.dt),
      height_m: firstNum(m.height_m),
      mass_kg: firstNum(m.mass_kg),
      ground_y_m: firstNum(m.ground_y_m) || 0,
      canon: true,
      n: firstNum(m.n) || 0,
      base: firstDefined(m.base, null),
      fastslow: firstDefined(m.fastslow, null),
      fsSrc: firstDefined(m.fsSrc, null),
      system: firstDefined(m.system, null),
      file: null,
      _session: true
    };
  }

  /**
   * 세션 frame 선수를 window.VIEWER_MANIFEST 에 등록(메타만; 실제 frame 은 loadFrames 가 on-demand 변환).
   * viewer 가 아닌 페이지(VIEWER_MANIFEST 없음)에서는 no-op → theia 페이지에서 안전.
   */
  function registerSessionManifest() {
    var M = root.VIEWER_MANIFEST;
    if (!M || typeof M !== "object") return 0;
    M.players = M.players || {};
    M.order = M.order || [];
    var added = 0;
    readSessionFrames().forEach(function (item) {
      if (!item || !item.name) return;
      var nm = String(item.name).trim();
      if (!M.players[nm]) added += 1;
      M.players[nm] = manifestEntryFrom(item);
      if (M.order.indexOf(nm) < 0) M.order.push(nm);
    });
    return added;
  }

  /**
   * 생산자 보조 — 원본 trial 을 세션에 저장(최근 MAX_SESSION_FRAMES 유지).
   * theia 페이지는 외부 스크립트를 로드하지 않으므로 실제 저장은 인라인 _p2StoreFrames 가 담당하며,
   * 이 함수는 모듈 환경(테스트·소비자 페이지)에서의 동일 계약 구현이다.
   */
  function storeTheiaFrames(trial, meta) {
    meta = meta || {};
    var name = firstDefined(meta.name, trial && trial.name);
    name = (name == null ? "" : String(name)).trim();
    if (!name || !trial) return null;
    var tmeta = trial.meta || trial.setup || {};
    var slim = {
      frames: Array.isArray(trial.frames) ? trial.frames : [],
      series: trial.series || {},
      events: trial.events || {},
      meta: { dt: tmeta.dt, fps: tmeta.fps, n: (trial.frames || []).length, ground_y_m: tmeta.ground_y_m }
    };
    var item = { name: name, trial: slim, meta: meta, savedAt: nowMs() };

    var list = readSessionFrames().filter(function (v) { return v && String(v.name).trim() !== name; });
    list.push(item);
    list.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    if (list.length > MAX_SESSION_FRAMES) list = list.slice(0, MAX_SESSION_FRAMES);

    var payload = JSON.stringify({ version: 1, savedAt: nowMs(), players: list });
    if (!writeStore(root.localStorage, SESSION_KEY_FRAMES, payload) && list.length > 1) {
      // QuotaExceeded 등: 가장 오래된 것 제거 후 1회 재시도
      list = list.slice(0, list.length - 1);
      payload = JSON.stringify({ version: 1, savedAt: nowMs(), players: list });
      writeStore(root.localStorage, SESSION_KEY_FRAMES, payload);
    }
    writeStore(root.sessionStorage, SESSION_KEY_FRAMES, payload);
    registerSessionManifest();
    return item;
  }

  var api = {
    SESSION_KEY_FRAMES: SESSION_KEY_FRAMES,
    MAX_SESSION_FRAMES: MAX_SESSION_FRAMES,
    BASE_LM: BASE_LM,
    CHO_SERIES: CHO_SERIES,
    theiaToViewerTrial: theiaToViewerTrial,
    readSessionFrames: readSessionFrames,
    loadFrames: loadFrames,
    registerSessionManifest: registerSessionManifest,
    storeTheiaFrames: storeTheiaFrames
  };

  root.BM_INTEG01_FRAMES = api;
  // 소비자 페이지(viewer)에서는 로드 즉시 세션 선수를 매니페스트에 등록한다(스냅샷 전에 실행).
  registerSessionManifest();

  if (typeof module !== "undefined" && module.exports) module.exports = api; // node 스모크 테스트용
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
