(function (root) {
  "use strict";

  var SESSION_KEY = "biomotion:dashboard:session:players";
  var LEGACY_KEYS = [];
  var PHASE_KEYS = ["windup", "drive", "block", "trunk", "arm", "physical"];
  /* [2026-06-19] 엘리트 n=20 규준 박제(슬림 p25/p75/dir) — NORM_BANDS 가 React IIFE 스코프라 못 보던 문제를
     캐시버스트되는 이 파일에 직접 박아 해결. 세션 선수 백분위 밴딩이 index.html 캐시·스코프와 무관하게 동작. */
  var _NB_BAKED = {"shoulderDistractionPk":{"p25":1137.32,"p75":1290.45,"dir":1},"shoulderEccLoad":{"p25":11.22,"p75":12.9,"dir":1},"elbowEccLoad":{"p25":3.49,"p75":4.54,"dir":1},"armDecelRate":{"p25":81.4,"p75":90.76,"dir":1},"decelDuration":{"p25":31.86,"p75":39.17,"dir":1},"hssFC":{"p25":19.325,"p75":30.15,"dir":1,"med":23.5},"driveKneeFlexKF":{"p25":18.85,"p75":34.25,"dir":1,"med":27.5},"leadHipMoment":{"p25":288.48,"p75":387.12,"dir":1},"shoulderForce":{"p25":1128.65,"p75":1273.675,"dir":1,"med":1193},"kneeCollapse":{"p25":2.2,"p75":7.85,"dir":-1,"med":4.5},"armTransferRatio":{"p25":95.175,"p75":99.85,"dir":1,"med":99.15},"efDeltaHumME":{"p25":35.263,"p75":54.241,"dir":1,"med":44.105},"leadHipWork":{"p25":10.25,"p75":29.2,"dir":1,"med":20.85},"kneeTransfer":{"p25":55.075,"p75":72.2,"dir":1,"med":65.25},"openAng":{"p25":6.225,"p75":15.85,"dir":-1,"med":11.35},"pelOpenKF":{"p25":49.95,"p75":74.15,"dir":-1,"med":62.45},"kneeAbs":{"p25":160.65,"p75":223.58,"dir":1},"leadKneeVelPk":{"p25":323.289,"p75":563.747,"dir":1,"med":394.23},"elbowMoment":{"p25":122.125,"p75":152.725,"dir":1,"med":135.65},"comDecel":{"p25":15.793,"p75":20.835,"dir":1,"med":17.81},"trkOpenKF":{"p25":23.25,"p75":49.175,"dir":-1,"med":30.5},"hipHinge":{"p25":16.8,"p75":35.575,"dir":1,"med":25.25},"leadKneeForce":{"p25":1650.475,"p75":2041.275,"dir":-1,"med":1882.1},"shGen":{"p25":6.325,"p75":24.025,"dir":1,"med":11.65},"shoulderMoment":{"p25":178.175,"p75":217.475,"dir":1,"med":196},"strideLenCV":{"p25":0.97,"p75":2.1,"dir":-1},"shTilt":{"p25":-0.43,"p75":5.95,"dir":1},"backHipMoment":{"p25":197.12,"p75":325.03,"dir":1},"blockConvEff":{"p25":29,"p75":81,"dir":1,"med":51},"comVelFC":{"p25":2.502,"p75":2.77,"dir":1,"med":2.655},"trunkLatKE":{"p25":24.725,"p75":34.25,"dir":1,"med":29.25},"releaseSdMm":{"p25":59.98,"p75":79.22,"dir":-1},"seqSpan":{"p25":4.1,"p75":27.6,"dir":-1},"wuDriveHipER":{"p25":5.875,"p75":9.775,"dir":1,"med":7.8},"linRotRatio":{"p25":8.45,"p75":25,"dir":1,"med":17},"xfPeakFromFC":{"p25":-17.563,"p75":22.45,"dir":-1,"med":-1.9},"postureMaint":{"p25":39.45,"p75":74.95,"dir":1,"med":61.4},"wuTrunkCloseKH":{"p25":118.5,"p75":130.65,"dir":1,"med":123.95},"comVelReductionFCBR":{"p25":1.242,"p75":1.548,"dir":1,"med":1.335},"rotKEgain":{"p25":21.8,"p75":51.925,"dir":1,"med":42.6},"kneeExtROM":{"p25":2.4,"p75":22.675,"dir":1,"med":12.2},"elbAbs":{"p25":30.75,"p75":57.55,"dir":1,"med":40.85},"ppTrunkHum":{"p25":56.625,"p75":79.2,"dir":1,"med":64.1},"gAbd":{"p25":72.35,"p75":86.08,"dir":1},"hipAbd":{"p25":208.775,"p75":332.85,"dir":1,"med":262.1},"trunkFlexV":{"p25":295.35,"p75":412.125,"dir":1,"med":363.45},"vgrfRetain":{"p25":59,"p75":91.925,"dir":1,"med":80.05},"chainTiming":{"p25":39.4,"p75":78.05,"dir":1,"med":60.7},"leadFootAngleFC":{"p25":-8.05,"p75":-1.375,"dir":-1,"med":-4.8},"xfUnwindV":{"p25":297.206,"p75":426.5,"dir":1,"med":334.95},"apBrake":{"p25":-1.1,"p75":5.05,"dir":1,"med":0.8},"propPeakTiming":{"p25":79.8,"p75":85.65,"dir":1,"med":80.9},"leadVGRFImpulse":{"p25":19.858,"p75":22.8,"dir":1,"med":20.965},"freeMo":{"p25":6.575,"p75":14.15,"dir":1,"med":9.45},"xfReleasedPctByFC":{"p25":0.071,"p75":5.127,"dir":-1,"med":1.576},"merPk":{"p25":177.575,"p75":187.775,"dir":1,"med":183.25},"strideTime":{"p25":0.68,"p75":0.792,"dir":1,"med":0.745},"elbowExtV":{"p25":1807.55,"p75":2144.25,"dir":1,"med":1977.55},"efDeltaTrunkME":{"p25":149.325,"p75":196.889,"dir":1,"med":177.853},"driveWork":{"p25":91.225,"p75":155.925,"dir":1,"med":121.55},"trunkRotKE":{"p25":51.175,"p75":71.875,"dir":1,"med":60.15},"torsoRotV":{"p25":804.775,"p75":952.05,"dir":1,"med":885.3},"leanBack":{"p25":1.025,"p75":7.5,"dir":1,"med":5.15},"trunkResistRatio":{"p25":1.565,"p75":2.343,"dir":1,"med":1.915},"kneeAbsE":{"p25":16.3,"p75":40.2,"dir":-1,"med":30.55},"rearProp":{"p25":67.75,"p75":91.225,"dir":1,"med":82.45},"relTimingCvPct":{"p25":3.68,"p75":7.78,"dir":-1},"leadKneeFlexFC":{"p25":47.4,"p75":54.875,"dir":1,"med":51.95},"armRotV":{"p25":3898.8,"p75":4288.775,"dir":1,"med":4128.15},"trunkLatV":{"p25":302.65,"p75":358.6,"dir":1,"med":323.4},"backHipWork":{"p25":45.3,"p75":124.675,"dir":1,"med":90.6},"efBalanceML":{"p25":1.782,"p75":8.682,"dir":-1,"med":4.733},"wuPelVel":{"p25":90.5,"p75":155.55,"dir":1,"med":107},"leadGrf":{"p25":189.975,"p75":224.775,"dir":1,"med":210.1},"hssBuildKF":{"p25":15.1,"p75":25.75,"dir":1,"med":20.8},"humME":{"p25":151.575,"p75":183.4,"dir":1,"med":163.6},"pelvisRotV":{"p25":599.75,"p75":672.85,"dir":1,"med":637.55},"kneeExtE":{"p25":13.05,"p75":21.875,"dir":1,"med":18.15},"wuShER":{"p25":30.4,"p75":48.575,"dir":1,"med":38.85},"kneeTrunkLag":{"p25":53.8,"p75":99.15,"dir":1,"med":71},"armSlotSdDeg":{"p25":1.27,"p75":2.6,"dir":-1},"efLeadHipHinge":{"p25":34.88,"p75":45.652,"dir":1,"med":37.599},"wuTrunkCoil":{"p25":15.9,"p75":27.825,"dir":1,"med":19.3},"xfPeak":{"p25":23.25,"p75":32.75,"dir":1,"med":26.95},"efEtaE":{"p25":0.085,"p75":0.25,"dir":1,"med":0.171},"blockRiskPenalty":{"p25":0,"p75":0,"dir":1,"med":0},"trunkFlexKE":{"p25":24.85,"p75":40.925,"dir":1,"med":30.6},"efStoredPE":{"p25":56.582,"p75":83.441,"dir":1,"med":64.398},"whipRatio":{"p25":3.065,"p75":3.855,"dir":1,"med":3.665},"ppKneeTrunk":{"p25":-53.625,"p75":-34.125,"dir":1,"med":-46.9},"gElbFlex":{"p25":61.8,"p75":79.28,"dir":1},"trunkME":{"p25":466.475,"p75":538.55,"dir":1,"med":508.2},"wuPelCoil":{"p25":16.475,"p75":35.05,"dir":1,"med":21.4},"comKEdrop":{"p25":211.325,"p75":284.525,"dir":1,"med":240.65},"elbowForce":{"p25":1025.65,"p75":1162.45,"dir":1,"med":1068.4},"seqPct":{"p25":66.75,"p75":100,"dir":1,"med":100},"wuPelCloseKH":{"p25":121.725,"p75":134,"dir":1,"med":126.45},"strideLen":{"p25":88.925,"p75":94.325,"dir":1,"med":90.85},"leadKneeFlexionBR":{"p25":31.7,"p75":51,"dir":1,"med":39.4},"wuHSSbuild":{"p25":-0.3,"p75":2.85,"dir":1,"med":1.25},"comVel":{"p25":2.575,"p75":2.802,"dir":1,"med":2.71},"scapLoad":{"p25":52.875,"p75":68.65,"dir":1,"med":62.7},"kneeContribPct":{"p25":27.75,"p75":51.075,"dir":1,"med":34.65},"ppShoElb":{"p25":-38.975,"p75":27.5,"dir":1,"med":-18},"wuTrkVel":{"p25":68.225,"p75":119,"dir":1,"med":87.4},"propImpPct":{"p25":22.953,"p75":26.11,"dir":1,"med":24.505},"comVDrop":{"p25":36.85,"p75":41.85,"dir":1,"med":38.6},"wuHSS":{"p25":1.5,"p75":5.125,"dir":1,"med":3},"grfDelay":{"p25":13.8,"p75":42.23,"dir":-1},"wuCoilTq":{"p25":0.032,"p75":0.129,"dir":1,"med":0.079},"pelClose":{"p25":29.55,"p75":64.825,"dir":1,"med":39.25},"apBrakeImpulse":{"p25":11.518,"p75":13.613,"dir":1,"med":12.735},"trunkLeanChange":{"p25":-6.35,"p75":2.725,"dir":-1,"med":-2.9},"leadKneeMoment":{"p25":178.48,"p75":248.1,"dir":1},"trunkME_kg":{"p25":5.647,"p75":6.082,"dir":1},"humME_kg":{"p25":1.795,"p75":2.063,"dir":1}};

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return "";
    }
  }

  function normalizeText(value) {
    var s = value == null ? "" : String(value);
    try {
      return s.normalize("NFC").trim();
    } catch (e) {
      return s.trim();
    }
  }

  function safeParse(value) {
    if (!value || typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }

  function clonePlain(value) {
    if (value == null || typeof value !== "object") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return value;
    }
  }

  function readStore(store, key) {
    try {
      return store && store.getItem ? store.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function writeStore(store, key, value) {
    try {
      if (store && store.setItem) store.setItem(key, value);
    } catch (e) {}
  }

  function asArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.players)) return payload.players;
    if (Array.isArray(payload.items)) return payload.items;
    if (payload.analysis || payload.phases || payload.phaseData || payload.stages || payload.player) return [payload];
    if (typeof payload === "object") {
      return Object.keys(payload).map(function (key) {
        var item = payload[key];
        if (item && typeof item === "object" && !item.name) item.name = key;
        return item;
      });
    }
    return [];
  }

  function storagePayloads() {
    var stores = [root.sessionStorage, root.localStorage];
    var keys = [SESSION_KEY].concat(LEGACY_KEYS);
    var out = [];
    stores.forEach(function (store) {
      keys.forEach(function (key) {
        var parsed = safeParse(readStore(store, key));
        if (parsed) out.push(parsed);
      });
    });
    return out;
  }

  function normalizeHand(value) {
    var s = normalizeText(value).toLowerCase();
    if (!s) return "";
    if (s.charAt(0) === "l" || s.indexOf("좌") >= 0) return "L";
    if (s.charAt(0) === "r" || s.indexOf("우") >= 0) return "R";
    return normalizeText(value).charAt(0).toUpperCase();
  }

  function firstDefined() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== "") return arguments[i];
    }
    return undefined;
  }

  function toNum(value) {
    if (value === "" || value == null) return undefined;
    if (typeof value === "number" && isFinite(value)) return value;
    var n = Number(String(value).replace(/[^\d.+-]/g, ""));
    return isFinite(n) ? n : undefined;
  }

  function stageList(analysis) {
    if (!analysis) return [];
    if (analysis.analysis) return stageList(analysis.analysis);
    if (analysis.phases && Array.isArray(analysis.phases.stages)) return analysis.phases.stages;
    if (Array.isArray(analysis.stages)) return analysis.stages;
    if (analysis.stages && typeof analysis.stages === "object") {
      return Object.keys(analysis.stages).map(function (key) {
        var stage = analysis.stages[key];
        if (Array.isArray(stage)) return { key: key, metrics: stage };
        if (stage && typeof stage === "object") {
          var copy = clonePlain(stage);
          copy.key = copy.key || key;
          return copy;
        }
        return { key: key, metrics: [] };
      });
    }
    return [];
  }

  function normalizeStageKey(stage) {
    var raw = normalizeText(firstDefined(stage && stage.key, stage && stage.id, stage && stage.label, stage && stage.name)).toLowerCase();
    if (/windup|set|와인드|셋업/.test(raw)) return "windup";
    if (/drive|stride|추진|스트라이드|전진/.test(raw)) return "drive";
    if (/block|blocking|lead.?knee|knee|transfer|블로킹|리드|무릎|전달/.test(raw)) return "block";
    if (/trunk|rotation|release|몸통|회전|릴리즈|분리/.test(raw)) return "trunk";
    if (/arm|delivery|throw|ball|팔|투구|릴리스|구속/.test(raw)) return "arm";
    if (/physical|fitness|conditioning|체력|피지컬/.test(raw)) return "physical";
    return "arm";
  }

  function normalizeStatus(metric) {
    var raw = normalizeText(firstDefined(metric.st, metric.status, metric.band, metric.grade, metric.eval, metric.flag)).toLowerCase();
    if (/injury|load|부상|주의/.test(raw)) return "부상";
    if (/strong|good|excellent|high|우수|강점/.test(raw)) return "우수";
    if (/weak|low|bad|risk|flag|미흡|약점|위험/.test(raw)) return "미흡";
    if (/normal|ok|fair|neutral|중립|보통|정상/.test(raw)) return "정상";
    // [2026-06-18] 점수기반 폴백 영구 제거 → 백분위(값 vs 엘리트 p25/p75·dir) 단일.
    //   세션 선수(src=session)는 메트릭 st가 없어 과거 score>=75=우수로 전원 인플레이션(전원 충족98%) 회귀했음.
    //   NORM_BANDS(엘리트 n=20 규준·키 일치)로 정직 백분위 밴딩 → 정적/세션 일관. 점수(score)는 더 이상 밴드에 쓰지 않음.
    var NB = (typeof window !== "undefined" && window.NORM_BANDS) || _NB_BAKED;   // [2026-06-19] 박제 규준 우선 폴백(IIFE/캐시 무관)
    var nb = (NB && (metric.key || metric.k)) ? NB[metric.key || metric.k] : null;
    var v = toNum(firstDefined(metric.value, metric.val, metric.v));
    if (nb && v !== undefined && nb.p25 != null && nb.p75 != null) {
      var d = firstDefined(metric.dir, nb.dir);
      if (d === -1) return v <= nb.p25 ? "우수" : (v > nb.p75 ? "미흡" : "정상");
      if (d === "range" || d === "range1") return (v >= nb.p25 && v <= nb.p75) ? "정상" : "미흡";
      return v >= nb.p75 ? "우수" : (v < nb.p25 ? "미흡" : "정상");
    }
    return "정상";
  }

  function normalizeCategory(metric, stage, phaseKey) {
    var cat = firstDefined(metric.cat, metric.category, metric.group, metric.bucket, stage && stage.sub, stage && stage.label, stage && stage.name);
    cat = normalizeText(cat).replace(/^\d+\.\s*/, "");
    if (cat) return cat;
    return { windup: "와인드업", drive: "추진", block: "블로킹", trunk: "몸통", arm: "팔궤도", physical: "피지컬" }[phaseKey] || phaseKey;
  }

  function isTypeCard(metric) {
    return !!(
      metric.typeCard ||
      metric.visualType === "typeCard" ||
      metric.displayPolicy === "type_context" ||
      metric.displayLayer === "type"
    );
  }

  function metricToCho(metric, stage, phaseKey) {
    if (!metric || typeof metric !== "object") return null;
    var out = {};
    out.key = normalizeText(firstDefined(metric.key, metric.id, metric.metricKey, metric.label, metric.name));
    out.name = normalizeText(firstDefined(metric.name, metric.label, metric.title, out.key));
    out.val = firstDefined(metric.val, metric.value, metric.displayValue, metric.text);
    out.unit = firstDefined(metric.unit, metric.units, "");
    out.cat = normalizeCategory(metric, stage, phaseKey);

    if (metric.scored === false || metric.scoreIncluded === false || isTypeCard(metric)) {
      out.scored = false;
    } else {
      out.scored = !!(metric.scored || metric.scoreIncluded || metric.score != null);
    }

    out.st = normalizeStatus(metric);
    if (metric.typeNeutral === true || metric.key === "armTransferRatio") out.st = "중립";  // [2026-06-22] styleNeutral 양보축·강등 변인은 '미흡' 아닌 '중립'(표시-점수 정합·apply-patch와 동일·미래 full 재베이크 보존)

    ["lo", "hi", "pos", "p25", "med", "p75", "normN"].forEach(function (field) {
      var value = firstDefined(metric[field], metric.normband && metric.normband[field]);
      if (value !== undefined) out[field] = value;
    });

    if (out.pos === undefined) out.pos = firstDefined(metric.percentile, metric.pct);
    /* [2026-06-20] 세션 선수 pos 베이크 — 세션 phaseData엔 pos가 없어 리포트 메카닉 퍼센타일이 '—'로 나오던 것 수정.
       z→정규CDF(엘리트 n=20 규준 NORM_BANDS/_NB_BAKED, med≈(p25+p75)/2) → 정적 재베이크 pos와 동일 프레임. */
    if (out.pos == null && out.scored && out.val != null && out.key) {
      try {
        var _NBx = (typeof window !== "undefined" && window.NORM_BANDS) || _NB_BAKED;
        var _nbm = _NBx && _NBx[out.key];
        var _vv = toNum(out.val);
        if (_nbm && _nbm.p25 != null && _nbm.p75 != null && _vv !== undefined) {
          var _med = (_nbm.med != null) ? _nbm.med : (_nbm.p25 + _nbm.p75) / 2;
          var _sig = Math.abs(_nbm.p75 - _nbm.p25) / 1.349 || 1;
          var _dd = firstDefined(metric.dir, _nbm.dir);
          var _zz = (_vv - _med) / _sig * (_dd === -1 ? -1 : 1);
          var _tt = 1 / (1 + 0.2316419 * Math.abs(_zz)), _dn = 0.3989423 * Math.exp(-_zz * _zz / 2);
          var _pp = _dn * _tt * (0.3193815 + _tt * (-0.3565638 + _tt * (1.781478 + _tt * (-1.821256 + _tt * 1.330274))));
          out.pos = Math.max(1, Math.min(99, Math.round((_zz > 0 ? 1 - _pp : _pp) * 100)));
        }
      } catch (e) {}
    }

    if (metric.normband) out.normband = clonePlain(metric.normband);
    if (metric.displayPolicy) out.displayPolicy = metric.displayPolicy;
    if (metric.displayLayer) out.displayLayer = metric.displayLayer;
    if (metric.displayBucket) out.displayBucket = metric.displayBucket;
    if (metric.prov) out.prov = clonePlain(metric.prov);
    if (metric.dx) out.dx = clonePlain(metric.dx);
    if (metric.neutral !== undefined) out.neutral = metric.neutral;
    if (metric.contextLabel) out.contextLabel = metric.contextLabel;
    if (metric.injury) out.injury = clonePlain(metric.injury);
    if (metric.typeEval) out.typeEval = metric.typeEval;

    var typeCard = isTypeCard(metric);
    if (typeCard) {
      out.typeCard = true;
      out.quality = firstDefined(metric.quality, metric.st, out.st);
      out.typeDesc = firstDefined(metric.typeDesc, metric.desc, metric.note, metric.summary, "");
      out.typeNote = firstDefined(metric.typeNote, metric.note, metric.flagDetail, metric.warn, metric.warning, "");
      out.scored = false;
    }

    var flag = firstDefined(metric.flag, metric.warn, metric.warning);
    if (flag !== undefined) out.flag = flag;
    var detail = firstDefined(metric.flagDetail, metric.note, metric.reason);
    if (detail !== undefined) out.flagDetail = detail;

    return out.name || out.key ? out : null;
  }

  function normalizePhaseData(input) {
    var phaseData = {};
    PHASE_KEYS.forEach(function (key) {
      phaseData[key] = [];
    });
    if (!input || typeof input !== "object") return phaseData;
    Object.keys(input).forEach(function (key) {
      var stageKey = normalizeStageKey({ key: key });
      var arr = Array.isArray(input[key]) ? input[key] : [];
      phaseData[stageKey] = phaseData[stageKey].concat(arr.map(function (metric) {
        return clonePlain(metric);
      }));
    });
    return phaseData;
  }

  function theiaToPhaseData(analysis) {
    if (!analysis) return normalizePhaseData(null);
    if (analysis.analysis) return theiaToPhaseData(analysis.analysis);
    if (analysis.phaseData && !analysis.phases && !analysis.stages) return normalizePhaseData(analysis.phaseData);

    var phaseData = normalizePhaseData(analysis.phaseData || null);
    stageList(analysis).forEach(function (stage) {
      var _rk = normalizeText(firstDefined(stage && stage.key, stage && stage.id, stage && stage.label)).toLowerCase();
      if (/^consistency$|^balance$|동작 일관성|좌우 밸런스|보조·5단계/.test(_rk)) return;   // [2026-06-20] 보조·5단계 외(일관성·밸런스)=어트랙터 참고 신호 → 충족률·강점·평가에 미반영(별도 어트랙터 카드로 노출). 기존엔 default 'arm'으로 잘못 카운트되던 것 교정.
      var phaseKey = normalizeStageKey(stage);
      var metrics = Array.isArray(stage.metrics) ? stage.metrics : [];
      metrics.forEach(function (metric) {
        var converted = metricToCho(metric, stage, phaseKey);
        if (converted) phaseData[phaseKey].push(converted);
      });
    });
    return phaseData;
  }

  function playerNameFrom(analysis, fallback) {
    return normalizeText(firstDefined(
      analysis && analysis.name,
      analysis && analysis.playerName,
      analysis && analysis.player && analysis.player.name,
      analysis && analysis.meta && analysis.meta.playerName,
      fallback
    ));
  }

  function velocityFrom(analysis) {
    return firstDefined(
      analysis && analysis.velo,
      analysis && analysis.measured_kmh,
      analysis && analysis.max_kmh,
      analysis && analysis.velo_summary && analysis.velo_summary.max_kmh,
      analysis && analysis.velo_summary && analysis.velo_summary.avg_kmh,
      analysis && analysis.player && analysis.player.max_velocity_kmh,
      analysis && analysis.player && analysis.player.ball_speed_avg
    );
  }

  // [2026-06-19] 세션(분석) 경로 '동작 유형' 분류·유형별 차별화 평가 주입.
  //   문제: 정적 players.js 는 오프라인 베이크(apply_type_rebake/apply_type_neutral)로 유형카드+typeNeutral 보유하나,
  //   세션 경로(theiaToPhaseData)는 그 단계가 없어 '유형 없음'+점수 비차별화(문서준 81% vs 정적 92%).
  //   분류기는 이미 phases.compute 가 산출(analysis.phases.windupType/strideType/blockingType, etdiag trunk7/armball9).
  //   여기서 그 유형키를 phaseData 메트릭에 typeCard 로 합성 + 비핵심 식별변인의 '미흡'을 scored:false(차별화평가).
  //   SSOT = _motion_viewer_build/apply_type_neutral.js (동일 맵). _hasBakedTypes 가드로 멱등(정적/기적용 skip). Theia 전용.
  var _TR = {
    WIN_EASY: { compact: "빠른 전환형", coil_dominant: "회전 코일형", linear_load: "축발 적재형", high_lift: "큰 리듬형" },
    STR_EASY: { long_power: "긴 보폭형", compact_quick: "빠른 템포형", low_drop: "깊은 낙하형", rot_ready: "회전 준비형", linear_drift: "미끄러짐형" },
    BLK_EASY: { extension: "신전 블로킹형", bracing_holding: "버팀·유지형", controlled_flexion: "조절 굴곡형", collapse_leakage: "블로킹 안정성 보강형", mixed: "혼합형" },
    WIN_CORE: { hipHinge: "linear_load", wuKneeAP: "linear_load", wuPelCoil: "coil_dominant", wuTrunkCoil: "coil_dominant", wuDriveHipER: "coil_dominant", wuCoilTq: "coil_dominant", wuPelVel: "compact", wuTrkVel: "compact" },
    STR_DIM: { strideLen: "stride", propImpPct: "prop", rearProp: "prop", comVDrop: "drop", hssBuildKF: "rotready", pelOpenKF: "rotready" },
    STR_CORE: { long_power: ["stride", "prop"], compact_quick: [], low_drop: ["drop"], rot_ready: ["rotready"], linear_drift: [] },
    BLK_CORE: { kneeExtROM: "extension", kneeContribPct: "extension", kneeAbs: "bracing_holding", kneeAbsE: "controlled_flexion" }
  };
  function _isNonCore(phase, key, t) {
    if (phase === "windup") { var c = _TR.WIN_CORE[key]; return c ? c !== t.wk : false; }
    if (phase === "drive") { var d = _TR.STR_DIM[key]; if (!d) return false; return (_TR.STR_CORE[t.sk] || []).indexOf(d) < 0; }
    if (phase === "block") { var c2 = _TR.BLK_CORE[key]; return c2 ? c2 !== t.bk : false; }
    return false;
  }
  function _hasBakedTypes(pd) {
    for (var ph in pd) { var a = pd[ph] || []; for (var i = 0; i < a.length; i++) { if (a[i] && a[i].typeCard) return true; } }
    return false;
  }
  function _ensureCard(arr, key, label, desc, quality) {
    if (!arr || !label) return;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].key === key) {   // 기존 메트릭(blockingType 등) → 카드 승격
        arr[i].typeCard = true; arr[i].scored = false; arr[i].val = label;
        arr[i].name = arr[i].name || "동작 유형"; arr[i].quality = quality || arr[i].quality || "유효";
        if (desc && !arr[i].typeDesc) arr[i].typeDesc = desc;
        return;
      }
    }
    arr.unshift({ key: key, name: "동작 유형", val: label, unit: "", scored: false, neutral: true, typeCard: true, quality: quality || "유효", typeDesc: desc || "" });
  }
  function applyTypeLayer(pd, analysis) {
    try {
      if (!pd || _hasBakedTypes(pd)) return pd;   // 정적/이미적용 멱등 skip
      var P = (analysis && analysis.phases) || analysis || {};
      var X = (analysis && (analysis.etdiag || analysis.X)) || (P && P.etdiag) || {};
      var wt = P.windupType || {}, st = P.strideType || {}, bt = P.blockingType || {};
      var wk = wt.primary, sk = st.primary, bk = bt.key;
      // 혼합(hybrid: 1·2위 raw차 <8) → 정적 베이크와 동일하게 "주형 · +부형 혼합" 라벨
      var _hyb = function (easy, t) { var p = easy[t.primary] || t.primary; return (t.hybrid && t.secondary && easy[t.secondary]) ? (p + " · +" + easy[t.secondary] + " 혼합") : p; };
      if (wk) _ensureCard(pd.windup, "windupType", _hyb(_TR.WIN_EASY, wt), "다리 들기 전략 유형(우열 아님·해석 기준).");
      if (sk) _ensureCard(pd.drive, "strideType", _hyb(_TR.STR_EASY, st), "드라이브(스트라이드) 전략 유형.");
      if (bk) _ensureCard(pd.block, "blockingType", _TR.BLK_EASY[bk] || bk, "앞다리 블로킹 전략 유형.", (bk === "collapse_leakage") ? "주의" : "유효");
      var trk = X.trunk7 && (X.trunk7.typeKo || X.trunk7.type);
      if (trk) _ensureCard(pd.trunk, "trunkAccelType", trk, "몸통 가속(증폭) 유형.");
      var trkXf = X.trunkarm8 && (X.trunkarm8.typeKo || X.trunkarm8.type);
      if (trkXf) _ensureCard(pd.trunk, "trunkXfType", trkXf, "몸통→팔 전달(X-factor) 유형.");
      var armT = X.armball9 && (X.armball9.typeKo || X.armball9.type);
      if (armT) _ensureCard(pd.arm, "armAccelType", armT, "팔 가속 유형.");
      var t = { wk: wk, sk: sk, bk: bk };
      ["windup", "drive", "block"].forEach(function (ph) {
        (pd[ph] || []).forEach(function (b) {
          if (!b || !b.key || b.typeCard || b.scored === false) return;
          if (b.st === "미흡" && _isNonCore(ph, b.key, t)) { b.scored = false; b.typeNeutral = true; b.typeEval = true; }
        });
      });
    } catch (e) { }
    return pd;
  }

  function toPlayerRecord(item, opts) {
    var options = opts || {};
    var analysis = item && item.analysis ? item.analysis : item;
    if (!analysis || typeof analysis !== "object") return null;

    var name = playerNameFrom(analysis, item && item.name);
    if (!name) return null;

    var existingPhaseData = analysis.phaseData || (item && item.phaseData);
    var record = {
      name: name,
      group: normalizeText(firstDefined(options.group, analysis.group, analysis._team, analysis.team, analysis.player && analysis.player.group, item && item.group, "세션")),
      hand: normalizeHand(firstDefined(analysis.hand, analysis.handedness, analysis.player && analysis.player.hand, analysis.player && analysis.player.handedness, item && item.hand)),
      velo: velocityFrom(analysis),
      phaseData: applyTypeLayer(existingPhaseData && !analysis.phases && !analysis.stages ? normalizePhaseData(existingPhaseData) : theiaToPhaseData(analysis), analysis),
      attractors: firstDefined(analysis.attractors, item && item.attractors),   // [2026-06-19] Theia 어트랙터 — 세션리포트 React 가 _curRec.attractors 로 렌더(누락 시 카드 미표시 버그 수정)
      todaysAttractor: firstDefined(analysis.todaysAttractor, item && item.todaysAttractor),
      repeatability: (function(){ try{ var ph=analysis.phases||(analysis.analysis&&analysis.analysis.phases); var cs=ph&&(ph.stages||[]).filter(function(s){return s&&s.key==="consistency";})[0]; if(!cs||!cs.metrics)return undefined; var byk={}; cs.metrics.forEach(function(m){if(m&&m.key)byk[m.key]=m;}); var defs=[["rotVelCV","회전속도 일관성"],["seqConsist","순서 일관성"],["relTimingCvPct","타이밍 일관성"],["grfDelay","체중이동 시간 일관성"],["strideLenCV","스트라이드 일관성"],["armSlotSdDeg","암슬롯 일관성"],["releaseSdMm","릴리즈 포인트 일관성"]]; var items=defs.map(function(d){var m=byk[d[0]];return (m&&m.score!=null)?{key:d[0],label:d[1],score:Math.round(m.score),band:(m.band||null)}:null;}).filter(Boolean); if(!items.length)return undefined; var avg=Math.round(items.reduce(function(s,x){return s+x.score;},0)/items.length); return {items:items,overall:avg}; }catch(e){return undefined;} })(),   // [2026-06-20] 투구간 반복성(어트랙터·참고·점수無) 일관성 7종 추출
      balance: (function(){ try{ var ph=analysis.phases||(analysis.analysis&&analysis.analysis.phases); var bs=ph&&(ph.stages||[]).filter(function(s){return s&&s.key==="balance";})[0]; if(!bs||!bs.metrics)return undefined; var items=bs.metrics.map(function(m){ if(!m||m.value==null)return null; var nb=(typeof _NB_BAKED!=="undefined")?_NB_BAKED[m.key]:null; var within=null; if(nb){var v=parseFloat(m.value); if(isFinite(v))within=(v>=nb.p25&&v<=nb.p75);} return {key:m.key,label:(m.label||m.key),value:m.value,unit:(m.unit||""),within:within,p25:(nb?nb.p25:null),p75:(nb?nb.p75:null)}; }).filter(Boolean); if(!items.length)return undefined; return {items:items,outside:items.filter(function(x){return x.within===false;}).length}; }catch(e){return undefined;} })(),   // [2026-06-20] 좌우 밸런스(어트랙터·참고·점수無) — etDiag 비커버 전두면 균형(값+엘리트범위)
      source: firstDefined(item && item.source, "theia-session"),
      savedAt: firstDefined(item && item.savedAt, analysis.savedAt, nowIso())
    };

    if (analysis.player && analysis.player.id) record.id = analysis.player.id;
    return record;
  }

  // [2026-06-18] 트랙 격리 — sessionStorage는 같은 오리진(sports.biomotion.kr)이라 theia/uplift 대시보드가 공유.
  //   uplift·imu 세션 선수가 theia 뷰어 드롭다운에 새고(상동고uplift…), 같은 이름이면 정적 theia 선수를 덮어써 전환 실패.
  //   이 뷰어(Theia)는 Theia 트랙 세션만 받는다(system 에 uplift/imu 포함 시 제외).
  function _isForeignTrackTheia(item) {
    var a = (item && item.analysis) ? item.analysis : item;
    var sys = String((a && (a.system || a.track)) || "").toLowerCase();
    return /uplift|imu/.test(sys);
  }
  function readSessionPlayers() {
    var byName = {};
    storagePayloads().forEach(function (payload) {
      asArray(payload).forEach(function (item) {
        if (_isForeignTrackTheia(item)) return;   // 타 트랙(uplift/imu) 세션 누수 차단
        var record = toPlayerRecord(item);
        if (record && record.name) byName[record.name] = record;
      });
    });
    return Object.keys(byName).map(function (name) {
      return byName[name];
    });
  }

  function mergePlayers(players) {
    var list = players || [];
    root.PLAYERS = root.PLAYERS || {};
    root.PLAYER_ORDER = root.PLAYER_ORDER || [];
    list.forEach(function (record) {
      if (!record || !record.name) return;
      root.PLAYERS[record.name] = record;
      if (root.PLAYER_ORDER.indexOf(record.name) < 0) root.PLAYER_ORDER.push(record.name);
    });
    return list;
  }

  function mergeSessionPlayers() {
    return mergePlayers(readSessionPlayers());
  }

  function loadPlayer(name) {
    var key = normalizeText(name);
    if (!key) return null;
    if (root.PLAYERS && root.PLAYERS[key]) return root.PLAYERS[key];
    mergeSessionPlayers();
    return root.PLAYERS && root.PLAYERS[key] ? root.PLAYERS[key] : null;
  }

  function isDynamicPlayer(name) {
    var key = normalizeText(name);
    var rec = loadPlayer(key);
    return !!(rec && rec.source === "theia-session");
  }

  function storeTheiaAnalysis(analysis, opts) {
    var record = toPlayerRecord(analysis, opts);
    if (!record) return null;

    var records = readSessionPlayers().filter(function (item) {
      return item.name !== record.name;
    });
    records.push(record);

    var payload = JSON.stringify({ version: 1, savedAt: nowIso(), players: records });
    writeStore(root.sessionStorage, SESSION_KEY, payload);
    writeStore(root.localStorage, SESSION_KEY, payload);
    mergePlayers([record]);
    return record;
  }

  root.BM_INTEG01 = {
    SESSION_KEY: SESSION_KEY,
    theiaToPhaseData: theiaToPhaseData,
    metricToCho: metricToCho,
    storeTheiaAnalysis: storeTheiaAnalysis,
    readSessionPlayers: readSessionPlayers,
    mergePlayers: mergePlayers,
    mergeSessionPlayers: mergeSessionPlayers,
    loadPlayer: loadPlayer,
    isDynamicPlayer: isDynamicPlayer
  };
  root.theiaToPhaseData = theiaToPhaseData;

  mergeSessionPlayers();
})(typeof window !== "undefined" ? window : globalThis);
