'use strict';
const fs = require('fs');
const path = require('path');

const MARKER = 'BM-STATIC-EXPORT';
const STAMP =
  '<!-- ' +
  MARKER +
  ': 선수·팀 정적 HTML export. NOT build.py/index.html. ' +
  '최신 앱: ../index.html (python3 build.py). ' +
  '재생성: node _분석/scripts/build_player_reports_full.js -->\n';

function hasStamp(html) {
  return html.includes(MARKER);
}

function wrap(html) {
  if (hasStamp(html)) return html;
  return STAMP + html;
}

function stampFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  if (hasStamp(html)) return { path: filePath, status: 'skip' };
  fs.writeFileSync(filePath, wrap(html));
  return { path: filePath, status: 'stamped' };
}

function stampDir(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.html')) continue;
    out.push(stampFile(path.join(dir, name)));
  }
  return out;
}

module.exports = { MARKER, STAMP, hasStamp, wrap, stampFile, stampDir };

if (require.main === module) {
  const root = process.argv[2] || path.join(process.cwd(), 'reports');
  const results = stampDir(root);
  results.forEach((r) => console.log((r.status === 'stamped' ? '✓ ' : '· ') + path.basename(r.path)));
  const n = results.filter((r) => r.status === 'stamped').length;
  console.log('스탬프 ' + n + '/' + results.length + ' (' + root + ')');
}
