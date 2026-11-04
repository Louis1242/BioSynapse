import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'evidence';
fs.mkdirSync(OUT, { recursive: true });
const results = { startedAt: new Date().toISOString(), s1: null, s2: [], s3: {}, s4: {}, actions: [], consoleErrors: [], pageErrors: [] };

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') results.consoleErrors.push(m.text()); });
page.on('pageerror', e => results.pageErrors.push(String(e)));

const t0 = Date.now();
await page.goto('http://localhost:8123/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.SPIKE && window.SPIKE.ready === true', null, { timeout: 90000 });
results.bootMs = Date.now() - t0;

// S1
results.s1 = await page.evaluate(async () => await window.SPIKE.load('1HHO'));
await page.evaluate(() => window.SPIKE.resetCamera());
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/s1-1hho-loaded.png` });

// S2
for (const rep of ['cartoon', 'ball-and-stick', 'spacefill', 'surface']) {
  const r = await page.evaluate(async rep => await window.SPIKE.setRepresentation(rep), rep);
  await page.evaluate(() => window.SPIKE.resetCamera());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/s2-${rep}.png` });
  results.s2.push({ proto: rep, ...r });
}
await page.evaluate(async () => await window.SPIKE.setRepresentation('cartoon'));
await page.evaluate(() => window.SPIKE.resetCamera());
await page.waitForTimeout(600);

// S3
results.s3.gridCartoon = await page.evaluate(() => window.SPIKE.gridPick(9));
const canvasBox = await page.evaluate(() => {
  const c = document.querySelector('#molview canvas');
  return c ? { w: c.clientWidth, h: c.clientHeight } : null;
});
results.s3.canvas = canvasBox;
// 聚焦 His87 后取视口中心点附近的拾取结果
results.s3.focusHis87 = await page.evaluate(() => window.SPIKE.focusResidue('A', 87));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/s3-focus-his87.png` });
results.s3.centerPicks = await page.evaluate(() => {
  const c = document.querySelector('#molview canvas');
  const cx = Math.round(c.clientWidth / 2), cy = Math.round(c.clientHeight / 2);
  const out = [];
  for (const [dx, dy] of [[0,0],[16,0],[-16,0],[0,16],[0,-16],[24,24],[-24,-24],[32,0],[0,32],[24,-24]]) {
    out.push({ dx, dy, ...window.SPIKE.pickAt(cx + dx, cy + dy) });
  }
  return out;
});
// 拾取耗时（缓存已建好后的稳定值）
results.s3.pickTiming = await page.evaluate(() => {
  const c = document.querySelector('#molview canvas');
  const cx = Math.round(c.clientWidth / 2), cy = Math.round(c.clientHeight / 2);
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) window.SPIKE.pickAt(cx + (i % 5) * 8 - 16, cy + (i % 7) * 6 - 18);
  const avg = (performance.now() - t0) / 50;
  return { n: 50, avgMs: +avg.toFixed(2) };
});
results.s3.gridAfterFocus = await page.evaluate(() => window.SPIKE.gridPick(9));
// 自洽往返：拾取 → 聚焦该残基 → 视口中心再拾取，应回到同一残基
results.s3.roundTrip = await page.evaluate(async () => {
  const c = document.querySelector('#molview canvas');
  const cx = Math.round(c.clientWidth / 2), cy = Math.round(c.clientHeight / 2);
  return await window.SPIKE.pickRoundTrip([[cx, cy], [cx + 50, cy], [cx, cy + 50], [cx - 50, cy - 40], [cx + 80, cy + 80], [cx - 80, cy + 80]]);
});

// S4
results.s4.highlight = await page.evaluate(() => window.SPIKE.highlightResidues([{ chain: 'A', resi: 87 }]));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/s4-highlight-his87.png` });
results.s4.setContents = await page.evaluate(() => ({ size: window.SPIKE.State.highlights.size, values: [...window.SPIKE.State.highlights] }));
results.s4.clear = await page.evaluate(() => window.SPIKE.clearHighlight());

// 8 action 演练
await page.evaluate(async () => await window.SPIKE.load('1HHO'));
results.actions = await page.evaluate(async () => await window.SPIKE.dryRun());
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/s5-dryrun-final.png` });

results.finishedAt = new Date().toISOString();
fs.writeFileSync(`${OUT}/spike-results.json`, JSON.stringify(results, null, 2));
const brief = r => r && { chain: r.chain, resi: r.resi, resn: r.resn, atom: r.atom };
console.log(JSON.stringify({
  bootMs: results.bootMs,
  s1: { ms: results.s1.ms, apiChains: results.s1.api.chains, molChains: results.s1.mol.chains, apiRes: results.s1.api.residues, molPoly: results.s1.mol.polymerResidues, molHetero: results.s1.mol.heteroResidues, atoms: results.s1.mol.atoms, units: results.s1.mol.units, meta: results.s1.api.meta },
  s2: results.s2.map(r => ({ rep: r.proto, ok: r.ok, via: r.via, used: r.used, ms: r.ms, reps: r.reps })),
  s3: {
    pickTiming: results.s3.pickTiming,
    gridCartoon: { ...results.s3.gridCartoon, sample: results.s3.gridCartoon.sample.map(brief) },
    centerPicks: results.s3.centerPicks.map(p => ({ d: [p.dx, p.dy], hit: p.hit, dist: p.dist, res: brief(p.residues && p.residues[0]) })),
    gridAfterFocus: { ...results.s3.gridAfterFocus, sample: results.s3.gridAfterFocus.sample.map(brief) },
    roundTrip: results.s3.roundTrip.map(r => ({ xy: r.xy, first: brief(r.first), hits: r.hits, same: r.same, match: r.match })),
  },
  s4: { highlight: results.s4.highlight, setContents: results.s4.setContents, clear: results.s4.clear },
  actions: results.actions,
  consoleErrors: results.consoleErrors,
  pageErrors: results.pageErrors,
}, null, 2));
await browser.close();
