// KU Uplift 0628 세션의 파싱된 rapsodoTab(구종별 구속·회전·효율·무브·스트라이크%·투구별)을
// ku_cohort.js에서 추출 → korea/데이터/rapsodo.js (window.RAPSODO). Theia RapsodoTab이 그대로 렌더.
const fs=require("fs");
const src=fs.readFileSync("/Users/biomotion/Projects/biomotion-platform-uplift-pitching/netlify_통합배포/pitching/uplift/korea/ku_cohort.js","utf8");
const root={};(function(){const self=root,window=root;eval(src);})();
const coh=root.__KU_COHORT||[];
const NAMES=["홍은성","홍주환","정휘진","정원진","김범근","김동환","김준영","오훈택","박경도","유재동"];
const RAP={};
NAMES.forEach(nm=>{ const r=coh.filter(x=>x.name===nm&&x.session==="20260628")[0]; const D=r&&r.DATA;
  if(D&&D.rapsodoTab&&D.rapsodoTab.pitches&&D.rapsodoTab.pitches.length) RAP[nm]=D.rapsodoTab; });
fs.writeFileSync("REPLACE_OUT/rapsodo.js","window.RAPSODO = "+JSON.stringify(RAP)+";\n");
console.log("RAPSODO",Object.keys(RAP).length+"명");
