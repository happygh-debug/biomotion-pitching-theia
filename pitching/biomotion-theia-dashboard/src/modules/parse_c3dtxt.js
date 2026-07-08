// parse_c3dtxt.js — Visual3D c3d.txt 파서 (parse_c3dtxt.py 의 JS 포팅)
// 브라우저/Node 공용(UMD). 입력: 파일 텍스트. 출력: {columns, keys, data, col(key), source, nRows, nCols}
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.parseC3DTxt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function splitTsv(line) { return line.replace(/[\r\n]+$/, '').split('\t'); }

  function parseC3DTxt(text) {
    const lines = text.split('\n');
    if (lines.length < 6) throw new Error('c3d.txt: 헤더 부족 (5행 헤더 + 데이터 필요)');
    const r5 = splitTsv(lines[4]);
    const nCols = r5.length;
    const pad = (a) => { const b = a.slice(0, nCols); while (b.length < nCols) b.push(''); return b; };
    const R1 = pad(splitTsv(lines[0])), R2 = pad(splitTsv(lines[1])),
          R3 = pad(splitTsv(lines[2])), R4 = pad(splitTsv(lines[3])), R5 = pad(r5);

    let source = '';
    for (const v of R1) { if (v.trim()) { source = v.trim(); break; } }

    // [2026-06-20] Visual3D export 버전차 호환: 단일성분 스칼라(FRAME_NUMBERS/EVENT_LABEL 등)의 component를
    //   구 export는 'X', 신 export는 '0'으로 표기 → '0'을 'X'로 정규화해 키 통일(예: TIME_0→TIME_X, Footstrike_0→Footstrike_X).
    //   단, 같은 group에 실제 X/Y/Z 벡터 성분이 있으면 정규화하지 않음(키 충돌 방지) — 사전 스캔으로 판별.
    const vecGroups = Object.create(null);
    for (let i = 1; i < nCols; i++) { const g = (R2[i] || '').trim(), c = (R5[i] || '').trim(); if (g && (c === 'X' || c === 'Y' || c === 'Z')) vecGroups[g] = true; }

    const columns = [{ key: '_index', group: '_index', type: 'INDEX', processed: false, component: 'I' }];
    const seen = Object.create(null);
    for (let i = 1; i < nCols; i++) {
      let group = (R2[i] || '').trim();
      const typ = (R3[i] || '').trim();
      const proc = ((R4[i] || '').trim().toUpperCase() === 'PROCESSED');
      let comp = ((R5[i] || '').trim()) || 'X';
      if (comp === '0' && !vecGroups[group]) comp = 'X';
      if (!group) group = '_col' + i;
      const base = group + '_' + comp;
      const cnt = seen[base] || 0;
      const key = cnt === 0 ? base : base + '_' + (cnt + 1);
      seen[base] = cnt + 1;
      columns.push({ key, group, type: typ, processed: proc, component: comp });
    }
    const keys = columns.map(c => c.key);
    const keyIndex = Object.create(null);
    keys.forEach((k, idx) => { keyIndex[k] = idx; });

    const data = [];
    for (let li = 5; li < lines.length; li++) {
      const raw = lines[li];
      if (!raw || !raw.trim()) continue;
      const cells = pad(splitTsv(raw));
      const vals = new Array(nCols);
      for (let c = 0; c < nCols; c++) {
        const cs = (cells[c] || '').trim();
        if (cs === '' || cs === 'nan' || cs === 'NaN') { vals[c] = NaN; }
        else { const n = Number(cs); vals[c] = Number.isNaN(n) ? NaN : n; }
      }
      data.push(vals);
    }
    function col(key) {
      const idx = keyIndex[key];
      if (idx === undefined) return null;
      const out = new Array(data.length);
      for (let r = 0; r < data.length; r++) out[r] = data[r][idx];
      return out;
    }
    return { columns, keys, keyIndex, data, nRows: data.length, nCols, source, col };
  }
  return parseC3DTxt;
});
