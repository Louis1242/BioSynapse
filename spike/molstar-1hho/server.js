/**
 * Spike 服务器（零依赖，仅 Node 内置模块 + fetch）
 * 职责：① 静态页面 ② /api/structure/:id 代理（下载 mmCIF + 元数据 + 统计 + 磁盘缓存）
 * ③ 上游失败时用陈旧缓存降级，无缓存则 503 + degraded
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8123);
const ROOT = __dirname;
const CACHE_DIR = path.join(ROOT, '.cache');
const CIF_URL = id => `https://files.rcsb.org/download/${id}.cif`;
const META_URL = id => `https://data.rcsb.org/rest/v1/core/entry/${id}`;
const TTL_MS = 24 * 60 * 60 * 1000;

fs.mkdirSync(CACHE_DIR, { recursive: true });

/** 从 mmCIF 的 _atom_site 循环里统计 原子数 / 链数 / 残基数 */
function statsFromCif(text) {
  const lines = text.split('\n');
  let headerStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^_atom_site\./.test(lines[i].trim()) && lines[i - 1] && !/^_atom_site\./.test(lines[i - 1].trim())) {
      headerStart = i;
      break;
    }
  }
  if (headerStart < 0) return { atoms: 0, chains: 0, residues: 0, error: 'no _atom_site loop' };
  const fields = [];
  let i = headerStart;
  while (i < lines.length && /^_atom_site\./.test(lines[i].trim())) {
    fields.push(lines[i].trim().replace('_atom_site.', ''));
    i++;
  }
  const idx = name => fields.indexOf(name);
  const cGroup = idx('group_PDB'), cAsymA = idx('auth_asym_id'), cAsymL = idx('label_asym_id');
  const cSeqA = idx('auth_seq_id'), cSeqL = idx('label_seq_id'), cComp = idx('label_comp_id');
  const chains = new Set(), residues = new Set(), hetResidues = new Set();
  let atoms = 0;
  for (; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (raw === '#' || raw === '' || raw.startsWith('loop_') || raw.startsWith('_')) break;
    const f = raw.split(/\s+/);
    if (f.length < fields.length) continue;
    const grp = cGroup >= 0 ? f[cGroup] : 'ATOM';
    const asym = cAsymA >= 0 ? f[cAsymA] : f[cAsymL];
    const seq = cSeqA >= 0 ? f[cSeqA] : f[cSeqL];
    const comp = cComp >= 0 ? f[cComp] : '?';
    if (grp === 'ATOM') {
      atoms++;
      chains.add(asym);
      residues.add(`${asym}|${seq}|${comp}`);
    } else if (grp === 'HETATM') {
      hetResidues.add(`${asym}|${seq}|${comp}`);
    }
  }
  return { atoms, chains: chains.size, residues: residues.size, heteroResidues: hetResidues.size, chainIds: [...chains].sort() };
}

function cachePath(id) {
  return { cif: path.join(CACHE_DIR, `${id}.cif`), meta: path.join(CACHE_DIR, `${id}.json`) };
}

function readCache(id) {
  const p = cachePath(id);
  if (!fs.existsSync(p.cif)) return null;
  const cif = fs.readFileSync(p.cif, 'utf8');
  const meta = fs.existsSync(p.meta) ? JSON.parse(fs.readFileSync(p.meta, 'utf8')) : {};
  const ageMs = Date.now() - fs.statSync(p.cif).mtimeMs;
  return { cif, meta, stale: ageMs > TTL_MS, ageMs };
}

async function fetchUpstream(id) {
  const t0 = Date.now();
  const [cifRes, metaRes] = await Promise.all([
    fetch(CIF_URL(id), { signal: AbortSignal.timeout(15000) }),
    fetch(META_URL(id), { signal: AbortSignal.timeout(15000) }),
  ]);
  if (!cifRes.ok) throw new Error(`cif HTTP ${cifRes.status}`);
  const cif = await cifRes.text();
  const entry = metaRes.ok ? await metaRes.json() : {};
  const meta = {
    id,
    title: entry?.struct?.title ?? null,
    method: (Array.isArray(entry?.exptl) ? entry.exptl.map(x => x.method) : [entry?.exptl?.method]).filter(Boolean).join('|') || null,
    resolution_a: entry?.rcsb_entry_info?.resolution_combined?.[0] ?? null,
    polymer_entity_count: entry?.rcsb_entry_info?.polymer_entity_count ?? null,
    rcsb_polymer_monomer_count: entry?.rcsb_entry_info?.deposited_polymer_monomer_count ?? null,
    source: 'RCSB_PDB',
    source_url: CIF_URL(id),
    version: entry?.rcsb_accession_info?.revision_date ?? entry?.rcsb_accession_info?.initial_release_date ?? null,
    initial_release: entry?.rcsb_accession_info?.initial_release_date ?? null,
    retrieved_at: new Date().toISOString(),
    license: 'PDB data is freely available (CC0)',
    upstream_ms: Date.now() - t0,
  };
  return { cif, meta };
}

async function handleStructure(id, wantCif) {
  let source = 'cache', degraded = false, ageMs = 0;
  id = String(id || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(id)) return { status: 400, body: { error: 'BAD_ID', degraded: true, fallback: 'mock' } };

  let got = readCache(id);
  const forceFail = process.env.FORCE_UPSTREAM_FAIL === '1';
  const needFetch = forceFail ? false : (!got || got.stale);
  let fetchError = null;
  if (needFetch) {
    try {
      const up = await fetchUpstream(id);
      const p = cachePath(id);
      fs.writeFileSync(p.cif, up.cif);
      fs.writeFileSync(p.meta, JSON.stringify(up.meta, null, 2));
      got = { cif: up.cif, meta: up.meta, stale: false, ageMs: 0 };
      source = 'rcsb';
    } catch (e) {
      fetchError = String(e.message);
      if (got) degraded = true;           // 陈旧缓存兜底
      else return { status: 503, body: { error: 'UPSTREAM_FAIL', detail: fetchError, degraded: true, fallback: 'mock' } };
    }
  }
  if (got) {
    if (source === 'cache') degraded = degraded || got.stale || forceFail;
    ageMs = got.ageMs;
  }
  const stats = statsFromCif(got.cif);
  if (wantCif) return { status: 200, text: got.cif, degraded, source };
  return {
    status: 200,
    body: {
      id, format: 'mmcif', degraded, source, cache_age_ms: Math.round(ageMs),
      fetch_error: fetchError, ...stats, meta: got.meta,
      cif_url: `/api/structure/${id}?format=cif`,
    },
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');

  const m = p.match(/^\/api\/structure\/([^/]+)$/);
  if (m) {
    try {
      const wantCif = url.searchParams.get('format') === 'cif';
      const r = await handleStructure(m[1], wantCif);
      res.statusCode = r.status;
      if (r.text) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end(r.text); }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(r.body, null, 2));
    } catch (e) {
      res.statusCode = 500; return res.end(JSON.stringify({ error: 'INTERNAL', detail: String(e.message) }));
    }
  }

  // 静态
  let file = null;
  if (p === '/' ) file = path.join(ROOT, 'public', 'index.html');
  else if (p.startsWith('/molstar/')) file = path.join(ROOT, 'node_modules', 'molstar', 'build', 'viewer', p.slice('/molstar/'.length));
  else if (p.startsWith('/static/')) file = path.join(ROOT, 'public', p.slice('/static/'.length));
  if (file) {
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    return res.end(fs.readFileSync(file));
  }
  res.statusCode = 404; res.end('not found');
});

server.listen(PORT, () => console.log(`spike server on http://localhost:${PORT}`));
