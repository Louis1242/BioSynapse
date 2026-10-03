/* ══════════════════════════════════════════════════════════════════
   app.js · 应用层
   ──────────────────────────────────────────────────────────────────
   架构对应 ADR-0001：
     · 状态单源：State 是唯一写入点，渲染器与覆盖层都是消费者
     · 指令化单向流：模型/用户 → 结构化指令 → executeCommand → 状态 → 渲染
     · 权威端：校验、编号映射、安全判定标注为后端职责（原型中为本地模拟）
   ══════════════════════════════════════════════════════════════════ */

const $  = (s, r)=> (r||document).querySelector(s);
const $$ = (s, r)=> Array.from((r||document).querySelectorAll(s));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 状态单源 ──────────────────────────────────────────────────── */
const State = {
  structure:null, compareStructure:null, compareOn:false, camLinked:true,
  rep:'cartoon', scopeSelection:false,
  selection:null, highlights:new Set(),
  mode:'cache', processStep:0, playing:false, lastClaim:null,
  residues:{ min:1, max:146 },
  commands:[]
};

/* ── 渲染器实例（只读执行） ────────────────────────────────────── */
let VM = null;            // 主视口
let VC = null;            // 对比视口
let cmpWrap = null;

const viewport = $('#viewport');
VM = BSViewer($('#scene'), {
  labelHost: viewport,
  autoRotate: true,
  onCamera: s=>{ if (State.camLinked && VC) VC.apply(s); },
  onPick: p=> handlePick(p)
});

/* ══ 指令执行器：所有 3D 变更的唯一入口（§6 结构化指令契约） ═════ */
function executeCommand(cmd, opts){
  const t0 = performance.now();
  let ok = true, note = '';
  switch(cmd.action){
    case 'load_structure': {
      const spec = STRUCTURES[cmd.target];
      if (!spec){ ok = false; note = '未知结构标识'; break; }
      const slot = cmd.slot === 'compare' ? 'compare' : 'main';
      if (slot === 'main'){
        State.structure = cmd.target;
        VM.setScene(spec);
        VM.setRepresentation(State.rep);
        VM.resetView();
        renderBadge(spec);
        renderDeclaration(spec);
        State.selection = null; State.highlights.clear();
        VM.setHighlight([]);
        renderSelection();
        renderPresetActive();
      } else {
        State.compareStructure = cmd.target;
        ensureCompare(true);
        VC.setScene(spec);
        VC.setRepresentation(State.rep);
        VC.resetView();
      }
      break;
    }
    case 'set_representation': {
      State.rep = cmd.style;
      VM.setRepresentation(cmd.style);
      if (VC) VC.setRepresentation(cmd.style);
      $$('.seg__opt').forEach(b=>{
        const on = b.dataset.rep === cmd.style;
        b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
      });
      break;
    }
    case 'highlight': {
      const keys = (cmd.target||[]).filter(k=>VM.hasSite(k));
      if (!keys.length){ ok = false; note = '目标位点在当前结构中不存在，已忽略'; break; }
      keys.forEach(k=>State.highlights.add(k));          // 幂等：Set 去重
      VM.setHighlight([...State.highlights]);
      if (VC && cmd.slot === 'compare') VC.setHighlight(keys);
      State.selection = siteToSelection(keys[keys.length-1]);
      renderSelection();
      break;
    }
    case 'clear_highlight': {
      if (cmd.target && cmd.target.length){
        cmd.target.forEach(k=>State.highlights.delete(k));
      } else {
        State.highlights.clear();
      }
      VM.setHighlight([...State.highlights]);
      if (!State.highlights.size){ State.selection = null; }
      renderSelection();
      break;
    }
    case 'focus_camera': {
      const k = cmd.target;
      ok = VM.focusSite(k, cmd.zoom);
      if (!ok) note = '聚焦目标不存在，已忽略';
      if (VC && State.camLinked){ /* 联动由 onCamera 覆盖 */ }
      break;
    }
    case 'compare': {
      ensureCompare(true);
      executeCommand({ action:'load_structure', target:cmd.targets[1], slot:'compare' });
      break;
    }
    case 'open_evidence': {
      openDrawer(cmd.claim_id);
      break;
    }
    case 'play_process':
    case 'step': {
      setProcessStep(cmd.step != null ? cmd.step : State.processStep);
      break;
    }
    default:
      ok = false; note = '无法识别的指令，已静默忽略并记录日志';
  }
  const ms = Math.round(performance.now() - t0);
  logCommand(cmd, ok, note, ms);
  return ok;
}

function siteToSelection(key){
  const spec = STRUCTURES[State.structure];
  const s = spec && spec.sites[key];
  if (!s) return null;
  return { key, chain:s.chain || '—', resi:s.resi || null, resn:s.resn || null, label:s.label || key, kind:s.kind };
}
void siteToSelection;

/* ══ 顶栏 / 视口信息渲染 ════════════════════════════════════════ */
function renderBadge(spec){
  const b = $('#structBadge');
  $('.badge__id', b).textContent = spec.id + (spec.source === 'AlphaFold' ? ' · 预测' : '');
  const meta = $('.badge__meta', b);
  meta.innerHTML = '';
  (spec.meta||[]).forEach(m=>{
    const s = document.createElement('span');
    s.textContent = `${m.k} ${m.v}`;
    if (m.kind === 'pred') s.classList.add('is-pred');
    else if (m.kind === 'warn') s.classList.add('is-warn');
    meta.appendChild(s);
  });
  $('#emptyState').hidden = true;
}

function renderDeclaration(spec){
  const bar = $('#declBar');
  if (spec.declare){
    bar.hidden = false;
    $('#declText').textContent = spec.declare;
    $('.decl__ref', bar).textContent = spec.declareRef || '';
    viewport.classList.add('is-schematic');
  } else {
    bar.hidden = true;
    viewport.classList.remove('is-schematic');
  }
}

function renderSelection(){
  const bar = $('#selectionBar');
  if (!State.selection){ bar.innerHTML = '<span class="selection__none">未选择任何位点</span>'; $('#panelCtx').textContent = ctxText(); return; }
  const sel = State.selection;
  const spec = STRUCTURES[State.structure] || {};
  const up = spec.uniprot || {};
  const offset = sel.chain === 'B' || sel.chain === 'D' ? 1 : 0;
  const upid = up['chain'+sel.chain] || Object.values(up)[0] || '—';
  const mapTxt = sel.resi ? `${upid}:${sel.resi + offset}` : '区域';
  bar.innerHTML = `
    <span class="sel-chip">${sel.chain}·${sel.resn||''}${sel.resi||''}</span>
    <span class="sel-map">PDB ${sel.chain}:${sel.resi||'—'} ↔ UniProt <b>${mapTxt}</b></span>
    <span class="sel-map">${sel.label}</span>
    <button class="sel-clear" id="selClear">清除高亮</button>`;
  $('#selClear').onclick = ()=>{
    executeCommand({ action:'clear_highlight' });
    $('#pickCard').hidden = true;
    setResiduePointer(null);
  };
  $('#panelCtx').textContent = ctxText();
}
function ctxText(){
  if (!State.structure) return '上下文：—';
  const s = State.selection;
  return `上下文：${State.structure}${s ? ` · 链 ${s.chain} · 残基 ${s.resi ?? '—'}` : ''} · ${State.highlights.size} 个高亮`;
}

/* 左尺残基指针：讲到哪里、结构在哪里 */
function setResiduePointer(resi){
  const el = $('#residuePointer');
  if (!resi){ el.classList.remove('is-live'); return; }
  const span = State.residues.max - State.residues.min;
  const pct = Math.max(3, Math.min(97, (resi - State.residues.min)/span*100));
  el.style.top = pct + '%';
  $('#residuePointerNum').textContent = resi;
  el.classList.add('is-live');
}

/* ══ 指令日志（让不可见的契约可见） ══════════════════════════════ */
function logCommand(cmd, ok, note, ms){
  State.commands.push({ cmd, ok, note, ms });
  const list = $('#cmdList');
  const li = document.createElement('li');
  const payload = JSON.stringify(cmd.target ?? cmd.style ?? cmd.claim_id ?? cmd.targets ?? '')
    .replace(/["\[\]]/g,'').slice(0, 42);
  li.innerHTML = `<span class="c-t">${String(State.commands.length).padStart(2,'0')}</span>
    <span class="c-a">${cmd.action}</span>
    <span>${payload}</span>
    <span class="${ok?'c-ok':'c-skip'}">${ok ? '✓ ' + ms + 'ms' : '⊘ ' + (note||'已忽略')}</span>`;
  list.prepend(li);
  while (list.children.length > 40) list.lastChild.remove();
  $('#cmdCount').textContent = State.commands.length;
}

/* ══ 结构库 / 场景 ══════════════════════════════════════════════ */
function renderPresetList(){
  const ul = $('#presetList');
  ul.innerHTML = '';
  PRESETS.forEach(p=>{
    const li = document.createElement('li');
    li.innerHTML = `<button data-id="${p.id}">
      <span class="p-id">${p.short}</span>
      <span class="p-name">${p.name}</span>
      <span class="p-tag">${p.tag}</span>
    </button>`;
    $('button', li).onclick = ()=> openPreset(p);
    ul.appendChild(li);
  });
}
function renderPresetActive(){
  $$('#presetList button').forEach(b=> b.classList.toggle('is-on', b.dataset.id === State.structure));
}
function openPreset(p){
  if (p.kind === 'organelle') return runScript('s4');
  if (p.kind === 'process')   return runScript('proc');
  if (p.id === 'AF-P69905')   return runPredict();
  executeCommand({ action:'load_structure', target:p.id });
  if (p.id === '1HHO') runScript('s1');
  else addLibraryCard(p);
}
function addLibraryCard(p){
  addTurn(`
    <div class="card">
      <p class="card__kicker">结构已加载 · 缓存命中</p>
      <h4 class="card__title">${p.name}（${p.id}）</h4>
      <p>可从左侧黄金场景或直接提问继续；该结构在演示数据中未绑定讲解脚本，因此不会生成任何断言。</p>
    </div>`);
}

/* ══ 讲解（批注本版式）+ 讲到哪里亮到哪里 ════════════════════ */
let streaming = false;
function narrate(script){
  if (streaming) return Promise.resolve();
  streaming = true;
  const items = script.sentences || script.steps;
  if (script.compare) executeCommand({ action:'compare', targets:[script.structure, script.compare] });
  else if (!State.compareOn && script.structure !== State.structure)
    executeCommand({ action:'load_structure', target:script.structure });

  const head = document.createElement('section');
  head.className = 'narr';
  head.innerHTML = `
    <div class="narr__head">
      <span class="narr__title">讲解 · ${script.title||''}</span>
      <span class="narr__mode">${modeLabel(script.modelRun.mode)}</span>
      <span class="rule"></span>
    </div>
    <div class="narr__body"></div>`;
  const body = $('.narr__body', head);
  addTurn(head, true);

  let chain = Promise.resolve();
  items.forEach((s, i)=>{
    chain = chain.then(()=> typeSentence(body, script, s, i));
  });
  return chain.then(()=>{ streaming = false; });
}

function typeSentence(body, script, s, idx){
  return new Promise(resolve=>{
    const wrap = document.createElement('article');
    wrap.className = 'sent';
    wrap.dataset.claim = s.claim;
    wrap.innerHTML = `
      <div class="sent__note">
        <span class="sent__claim">${s.claim}</span>
        <span class="sent__stamp" data-lv="${s.lv}" title="置信层级：${s.lv}"></span>
        <span class="sent__site">${siteShort(s.sites)}</span>
      </div>
      <div>
        <p class="sent__body"></p>
        <div class="sent__acts"></div>
      </div>`;
    body.appendChild(wrap);
    const p = $('.sent__body', wrap);
    const caret = document.createElement('span'); caret.className = 'caret';

    /* 讲到哪里、亮到哪里：先执行 3D 指令，再落文字 */
    if (s.sites && s.sites.length){
      executeCommand({ action:'clear_highlight' });
      executeCommand({ action:'highlight', target:s.sites });
      if (s.rep) executeCommand({ action:'set_representation', style:s.rep });
      if (s.focus) executeCommand({ action:'focus_camera', target:s.focus });
      const resi = STRUCTURES[State.structure]?.sites?.[s.sites[0]]?.resi;
      setResiduePointer(resi || null);
    }
    if (script.steps) setProcessStep(s.n || 0);

    wrap.classList.add('is-live');
    State.lastClaim = s.claim;
    scrollThread();

    const text = s.text;
    const instant = reduceMotion || text.length > 140;
    let i = 0;
    const finish = ()=>{
      caret.remove();
      wrap.classList.remove('is-live');
      const acts = $('.sent__acts', wrap);
      acts.innerHTML = `
        <button class="sent__act sent__act--ev" data-n="${(s.ev||[]).length}" data-claim="${s.claim}">证据 ${(s.ev||[]).length}</button>
        <button class="sent__act" data-locate="${s.claim}">在 3D 中定位</button>`;
      $$('.sent__act', acts).forEach(b=>{
        b.onclick = ()=> b.dataset.claim ? openDrawer(b.dataset.claim) : locateClaim(s.claim, s);
      });
      $('#tabEvid').textContent = `证据`;
      setTimeout(resolve, reduceMotion ? 0 : 260);
    };
    if (instant){ p.textContent = text; finish(); return; }
    p.appendChild(caret);
    const tick = setInterval(()=>{
      i += 2;
      p.textContent = text.slice(0, i);
      p.appendChild(caret);
      if (i >= text.length){ clearInterval(tick); finish(); }
    }, 26);
  });
}

function locateClaim(claim, s){
  executeCommand({ action:'clear_highlight' });
  executeCommand({ action:'highlight', target:s.sites });
  if (s.focus) executeCommand({ action:'focus_camera', target:s.focus });
}
function siteShort(keys){
  if (!keys || !keys.length) return '';
  const spec = STRUCTURES[State.structure];
  const first = spec && spec.sites && spec.sites[keys[0]];
  if (!first) return keys[0];
  return first.resi ? `${first.chain}·${first.resi}` : (first.label || keys[0]);
}
function modeLabel(mode){
  return mode === 'byok' ? 'BYOK · 用户 Key' : mode === 'local' ? '本地模型' : '预生成缓存 · 兜底';
}

/* 逐条回放（会话恢复用，不流式） */
function renderStaticNarration(script){
  const head = document.createElement('section');
  head.className = 'narr';
  head.innerHTML = `<div class="narr__head"><span class="narr__title">讲解 · ${script.title||''}</span>
    <span class="narr__mode">${modeLabel(script.modelRun.mode)}</span><span class="rule"></span></div>
    <div class="narr__body"></div>`;
  const body = $('.narr__body', head);
  (script.sentences || script.steps).forEach(s=>{
    const wrap = document.createElement('article');
    wrap.className = 'sent';
    wrap.innerHTML = `<div class="sent__note"><span class="sent__claim">${s.claim}</span>
      <span class="sent__stamp" data-lv="${s.lv}"></span><span class="sent__site">${siteShort(s.sites)}</span></div>
      <div><p class="sent__body">${s.text}</p>
      <div class="sent__acts"><button class="sent__act sent__act--ev" data-n="${(s.ev||[]).length}" data-claim="${s.claim}">证据 ${(s.ev||[]).length}</button></div></div>`;
    $('.sent__act', wrap).onclick = ()=> openDrawer(s.claim);
    body.appendChild(wrap);
  });
  addTurn(head, true);
}

/* ══ 对话线程 ═══════════════════════════════════════════════════ */
function addTurn(el, isNarr){
  const thread = $('#thread');
  const intro = $('.thread__intro', thread);
  if (intro) intro.remove();
  if (typeof el === 'string'){
    const d = document.createElement('div');
    d.innerHTML = el;
    el = d.firstElementChild;
  }
  if (!isNarr && !el.classList.contains('turn--user')) el.classList.add('is-block');
  thread.appendChild(el);
  scrollThread();
  return el;
}
function addUser(text){
  const el = document.createElement('div');
  el.className = 'turn--user';
  el.innerHTML = `<div><p class="turn__who">你</p><div class="bubble">${escapeHtml(text)}</div></div>`;
  addTurn(el);
}
function scrollThread(){
  const t = $('#thread');
  t.scrollTop = t.scrollHeight;
}
function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

/* ══ 证据抽屉 ═══════════════════════════════════════════════════ */
function openDrawer(claimId){
  const found = findClaim(claimId);
  if (!found){
    addTurn(`<div class="card"><p class="card__kicker">证据</p><h4 class="card__title">该断言暂无绑定证据</h4>
      <p>按设计，无源断言数量必须为 0：找不到证据时不展示结论，也不编造来源。</p></div>`);
    return;
  }
  const { script, s } = found;
  State.lastClaim = claimId;
  $('#drawerTitle').textContent = s.text.length > 46 ? s.text.slice(0,46) + '…' : s.text;
  const bodyEl = $('#drawerBody');
  bodyEl.innerHTML = '';

  /* 断言元信息 */
  const claimBox = document.createElement('div');
  claimBox.className = 'ev';
  claimBox.innerHTML = `
    <div class="ev__top">
      <span class="ev__type">CLAIM</span>
      <span class="ev__lv"><i class="stamp stamp--${lvClass(s.lv)}"></i>${s.lv}</span>
      <span class="ev__unverified">演示数据 · 未校验</span>
    </div>
    <p class="ev__title">${escapeHtml(s.text)}</p>
    <div class="ev__meta">
      <span>claim_id</span><b>${claimId}</b>
      <span>结构引用</span><b>${STRUCTURES[script.structure]?.id || script.structure}</b>
      <span>绑定证据</span><b>${(s.ev||[]).length} 条</b>
    </div>`;
  bodyEl.appendChild(claimBox);

  (s.ev||[]).forEach((ev, i)=>{
    const id = 'ev_' + claimId + '_' + i;
    const box = document.createElement('div');
    box.className = 'ev';
    box.innerHTML = `
      <div class="ev__top">
        <span class="ev__type">${ev.type}</span>
        <span class="ev__lv"><i class="stamp stamp--${lvClass(ev.lv)}"></i>${ev.lv} · ${ev.support.split('：')[0]}</span>
        <span class="ev__unverified">${ev.verified ? '已校验' : '演示数据 · 未巡检'}</span>
      </div>
      <p class="ev__title">${escapeHtml(ev.title)}</p>
      <p class="ev__loc">${ev.ref} · ${ev.locatorType} · ${ev.locator}</p>
      <blockquote class="ev__quote">${escapeHtml(ev.quote)}<em>${ev.quoteKind}</em></blockquote>
      <div class="ev__meta">
        <span>支持关系</span><b>${ev.support}</b>
        <span>取回时间</span><b>${ev.retrievedAt}</b>
        <span>许可</span><b>${ev.license}</b>
        <span>跳转代理</span><b>${ev.proxy}</b>
      </div>
      <div class="ev__acts">
        <a class="ev__link" href="${ev.url}" target="_blank" rel="noopener noreferrer">打开来源 ↗</a>
        ${s.sites && s.sites.length ? `<button class="btn btn--ghost btn--sm" data-locate="${claimId}">在 3D 中定位该断言</button>` : ''}
      </div>`;
    $$('[data-locate]', box).forEach(b=> b.onclick = ()=> locateClaim(claimId, s));
    void id;
    bodyEl.appendChild(box);
  });

  /* ModelRun：可复现记录 */
  const run = document.createElement('div');
  run.className = 'runbox';
  run.innerHTML = `
    <h4>ModelRun · 可复现记录</h4>
    <dl>
      <dt>model</dt><dd>${script.modelRun.model}</dd>
      <dt>prompt_hash</dt><dd>${script.modelRun.promptHash}</dd>
      <dt>params</dt><dd>${JSON.stringify(script.modelRun.params)}</dd>
      <dt>generated_at</dt><dd>${script.modelRun.generatedAt}</dd>
      <dt>review</dt><dd>${script.modelRun.reviewedBy}</dd>
    </dl>`;
  bodyEl.appendChild(run);

  const foot = document.createElement('p');
  foot.className = 'drawer__foot';
  foot.innerHTML = `外链统一经后端跳转代理（${(s.ev && s.ev[0]) ? s.ev[0].proxy : '—'}），便于链接规则维护与死链巡检；PMID 类型证据待真实数据管线接入后补齐。`;
  bodyEl.appendChild(foot);

  $('#drawer').hidden = false;
  $('#tabEvid').classList.add('is-on');
  $('#tabNarr').classList.remove('is-on');
}
function lvClass(lv){
  return lv === '实验证实' ? 'exp' : lv === '计算预测' ? 'pre' : 'con';
}
function findClaim(claimId){
  for (const key of Object.keys(SCRIPTS)){
    const sc = SCRIPTS[key];
    const items = sc.sentences || sc.steps || [];
    const s = items.find(x=> x.claim === claimId);
    if (s) return { script:sc, s };
  }
  return null;
}
$('#drawerClose').onclick = ()=>{
  $('#drawer').hidden = true;
  $('#tabEvid').classList.remove('is-on');
  $('#tabNarr').classList.add('is-on');
};
$('#tabNarr').onclick = ()=>{
  $('#drawer').hidden = true;
  $('#tabEvid').classList.remove('is-on');
  $('#tabNarr').classList.add('is-on');
};
$('#tabEvid').onclick = ()=>{
  if (State.lastClaim) openDrawer(State.lastClaim);
  else openDrawer('c_1hho_01');
};

/* ══ 点击拾取 → Click-to-Ask（FR-3D-005 / FR-CHAT-003） ═════════ */
function handlePick(p){
  if (!p || !State.structure) return;
  const spec = STRUCTURES[State.structure];
  const key = p.siteKey && spec.sites[p.siteKey] ? p.siteKey : null;
  const sel = key ? siteToSelection(key) : {
    key:null, chain:p.chain || '—', resi:p.resi || null, resn:p.resn || '—', kind:'residue', label:'未标注位点'
  };
  State.selection = sel;
  if (key){
    executeCommand({ action:'highlight', target:[key] });
    executeCommand({ action:'focus_camera', target:key });
  } else {
    executeCommand({ action:'clear_highlight' });
    State.selection = sel;              // 未标注位点同样要反映到底栏与上下文
    renderSelection();
    setResiduePointer(sel.resi);
  }
  const card = $('#pickCard');
  card.hidden = false;
  $('#pickSite').textContent = `${sel.chain}·${sel.resn||''}${sel.resi||''}` + (key ? '' : ' · 未标注');
  const up = spec.uniprot || {};
  const upid = up['chain'+sel.chain] || Object.values(up)[0] || '—';
  const offset = (sel.chain === 'B' || sel.chain === 'D') ? 1 : 0;
  $('#pickMap').innerHTML = sel.resi
    ? `PDB ${sel.chain}:${sel.resi} ↔ UniProt ${upid}:${sel.resi + offset}（编号映射在校验前完成，避免错位）`
    : '区域选择 · 无残基编号';
  $('#pickAsk').onclick = ()=>{
    $('#pickCard').hidden = true;
    State.pendingSite = key || sel.key;
    send(`链 ${sel.chain} 的残基 ${sel.resi || ''} 突变会怎样？`, { site:key });
  };
  $('#pickClear').onclick = ()=>{
    $('#pickCard').hidden = true;
    executeCommand({ action:'clear_highlight' });
    setResiduePointer(null);
  };
}
$('#pickClose').onclick = ()=>{ $('#pickCard').hidden = true; };

/* ══ 对比模式（FR-3D-007） ═════════════════════════════════════ */
function ensureCompare(on){
  const vp = viewport;
  if (on && !State.compareOn){
    State.compareOn = true;
    vp.classList.add('is-compare');
    $('#scene').style.right = '50%';
    cmpWrap = document.createElement('div');
    cmpWrap.className = 'cmp';
    cmpWrap.innerHTML = `
      <div class="cmp__tag" id="cmpTag">对比结构</div>`;
    const cvs = document.createElement('canvas');
    cvs.className = 'cmp__canvas';
    cmpWrap.appendChild(cvs);
    vp.appendChild(cmpWrap);
    const div = document.createElement('div');
    div.className = 'cmp__div';
    vp.appendChild(div);
    VC = BSViewer(cvs, { labels:false, autoRotate:true,
      onCamera: s=>{ if (State.camLinked) VM.apply(s); } });
    VM.resize();
    $('#btnLinkCam').hidden = false;
    $('#btnCompare').setAttribute('aria-pressed','true');
    $('#btnCompare').classList.add('is-on');
  } else if (!on && State.compareOn){
    State.compareOn = false;
    vp.classList.remove('is-compare');
    $('#scene').style.right = '';
    cmpWrap && cmpWrap.remove();
    $('.cmp__div', vp) && $('.cmp__div', vp).remove();
    VC = null; cmpWrap = null;
    VM.resize();
    $('#btnLinkCam').hidden = true;
    $('#btnCompare').setAttribute('aria-pressed','false');
    $('#btnCompare').classList.remove('is-on');
    State.compareStructure = null;
  }
  if (cmpWrap && State.compareStructure) $('#cmpTag').textContent = State.compareStructure;
}
$('#btnCompare').onclick = ()=> ensureCompare(!State.compareOn);
$('#btnLinkCam').onclick = e=>{
  State.camLinked = !State.camLinked;
  e.currentTarget.setAttribute('aria-pressed', String(State.camLinked));
  e.currentTarget.classList.toggle('is-on', State.camLinked);
  if (State.camLinked && VC) VC.apply(VM.snapshot());
};
$('#btnReset').onclick = ()=>{ executeCommand({ action:'focus_camera' , target:'' }); VM.resetView(); if (VC) VC.resetView(); };
$('#btnFocus').onclick = ()=>{
  if (!State.selection){ addTurn(`<div class="card"><p class="card__kicker">聚焦</p><p>先在 3D 中点选一个位点，或在左侧运行 S2。</p></div>`); return; }
  if (State.selection.key) VM.focusSite(State.selection.key);
};

/* ══ 表示模式 / 作用范围 ═══════════════════════════════════════ */
$$('.seg__opt').forEach(b=>{
  b.onclick = ()=> executeCommand({ action:'set_representation', style:b.dataset.rep });
});
$('#scopeSel').onchange = e=>{
  State.scopeSelection = e.target.checked;
  addTurn(`<div class="card"><p class="card__kicker">表示作用范围</p>
    <p>${e.target.checked
      ? '表示切换现在只作用于当前选择范围；未选中时回退为全局。'
      : '表示切换作用于整个结构。'}</p></div>`);
};

/* ══ 过程分步控制（FR-PROC-001/002/003） ═══════════════════════ */
let procBar = null;
function ensureProcessBar(show, script){
  if (show && !procBar){
    procBar = document.createElement('div');
    procBar.className = 'procbar';
    procBar.innerHTML = `
      <button class="tool" id="procPlay" aria-pressed="false">播放</button>
      <button class="tool" id="procPrev">上一步</button>
      <button class="tool" id="procNext">下一步</button>
      <div class="procbar__steps" id="procSteps"></div>`;
    viewport.appendChild(procBar);
    const steps = (script || SCRIPTS.proc).steps;
    $('#procSteps').innerHTML = steps.map(s=>`<button class="procstep" data-n="${s.n}"><b>${s.n+1}</b>${s.name}</button>`).join('');
    $$('.procstep').forEach(b=> b.onclick = ()=>{
      const n = Number(b.dataset.n);
      setProcessStep(n);
      const s = steps.find(x=>x.n === n);
      renderStepNote(s);
    });
    $('#procNext').onclick = ()=>{ const n = Math.min(3, State.processStep+1); setProcessStep(n); renderStepNote(steps.find(x=>x.n===n)); };
    $('#procPrev').onclick = ()=>{ const n = Math.max(0, State.processStep-1); setProcessStep(n); renderStepNote(steps.find(x=>x.n===n)); };
    $('#procPlay').onclick = e=>{
      State.playing = !State.playing;
      e.currentTarget.classList.toggle('is-on', State.playing);
      e.currentTarget.textContent = State.playing ? '暂停' : '播放';
      if (State.playing) playLoop(steps);
    };
  } else if (!show && procBar){
    State.playing = false;
    procBar.remove(); procBar = null;
  }
}
function playLoop(steps){
  if (!State.playing) return;
  const n = (State.processStep + 1) % 4;
  setProcessStep(n);
  renderStepNote(steps.find(x=>x.n === n));
  setTimeout(()=> playLoop(steps), 2100);
}
function setProcessStep(n){
  State.processStep = n;
  executeCommand({ action:'step', step:n });
  $$('.procstep').forEach(b=> b.classList.toggle('is-on', Number(b.dataset.n) === n));
}
function renderStepNote(s){
  if (!s) return;
  addTurn(`<div class="card"><p class="card__kicker">步骤 ${s.n+1} · ${s.name} · ${s.lv}</p>
    <p style="font-family:var(--serif);font-size:13.5px;line-height:1.8;color:var(--ink-2)">${s.text}</p>
    <div class="ev__acts"><button class="btn btn--ghost btn--sm" data-claim="${s.claim}">证据 ${(s.ev||[]).length}</button></div></div>`,
    true);
  $$('#thread [data-claim]').forEach(b=> b.onclick = ()=> openDrawer(b.dataset.claim));
}

/* ══ 输入路由（真实环境：后端意图解析 + 校验） ════════════════ */
function send(text, ctx){
  if (!text.trim()) return;
  addUser(text);
  const t = text.trim();
  const hit = INTENTS.find(i=> i.re.test(t));
  const id = hit ? hit.id : 'fallback';
  if (id === 'dualuse') return denyCard();
  if (id === 'unsupported') return unsupportedCard(t);
  if (State.playing){ State.playing = false; $('#procPlay') && $('#procPlay').classList.remove('is-on'); }

  switch(id){
    case 'load_1hho': {
      const explicit = /1hho/i.test(t);
      if (!explicit && State.structure !== '1HHO') return candidateCard('hemoglobin');
      if (!explicit && State.structure === '1HHO') return narrate(SCRIPTS.s1);
      executeCommand({ action:'load_structure', target:'1HHO' });
      return narrate(SCRIPTS.s1);
    }
    case 'mutation': {
      if (!State.structure || !STRUCTURES[State.structure].sites['his87'])
        return addTurn(`<div class="card"><p class="card__kicker">需要结构上下文</p><p>先加载 1HHO，再点击残基提问。</p></div>`);
      const site = (ctx && ctx.site) || (State.selection && State.selection.key);
      if (!site){
        executeCommand({ action:'highlight', target:['his87'] });
        executeCommand({ action:'focus_camera', target:'his87' });
        addTurn(`<div class="card"><p class="card__kicker">位点上下文</p><p>尚未选中残基，已默认定位到链 A 的 His87（F8）作为本次追问的上下文。</p></div>`);
      }
      return narrate(SCRIPTS.s2);
    }
    case 'compare': return narrate(SCRIPTS.s3);
    case 'organelle': return narrate(SCRIPTS.s4);
    case 'process': return narrate(SCRIPTS.proc);
    case 'predict': return runPredict();
    case 'evidence': return openDrawer(State.lastClaim || 'c_1hho_01');
    case 'save': return saveSession();
    case 'restore': return restorePrompt();
    case 'focus': {
      const m = t.match(/(\d{1,3})/);
      if (!m) return addTurn(`<div class="card"><p class="card__kicker">聚焦</p><p>请给出残基号，例如「His87」或「残基 92」。</p></div>`);
      const resi = Number(m[1]);
      const key = Object.keys(STRUCTURES[State.structure]?.sites || {}).find(k=>{
        const s = STRUCTURES[State.structure].sites[k];
        return s.kind === 'residue' && s.resi === resi;
      });
      if (!key) return addTurn(`<div class="card">
        <p class="card__kicker">该位点暂无绑定证据</p>
        <h4 class="card__title">残基 ${resi} 无法讲解</h4>
        <p>演示数据只为少数位点绑定了证据（His87 / His58 / His92 / His63 / His146）。按「无源断言 = 0」原则，这里不生成任何结论。</p></div>`);
      return handlePick({ siteKey:key });
    }
    default: return clarifyCard(t);
  }
}

function runPredict(){
  executeCommand({ action:'load_structure', target:'AF-P69905' });
  const spec = STRUCTURES['AF-P69905'];
  addTurn(`<div class="card">
    <p class="card__kicker">来源标注 · 计算预测</p>
    <h4 class="card__title">这是 AlphaFold 预测结构，不是实验测定结构</h4>
    <p>整体 pLDDT 96.4；配体与金属离子通常不建模，因此这里不展示血红素，也不对结合性质下结论。</p>
  </div>`, true);
  const sentences = [
    { claim:'c_af_01', lv:'计算预测', text:'预测模型给出 α 链的珠蛋白折叠：八段螺旋的排布与实验结构高度一致，核心区置信度很高。',
      sites:['his87'], focus:'his87', rep:'cartoon', ev:[SRC.aphafold] },
    { claim:'c_af_02', lv:'计算预测', text:'但预测模型没有血红素：没有配体，就无法从这张模型直接判断铁的结合几何——这正是"预测结构须标注不确定性"的典型场景。',
      sites:['his87'], focus:'his87', ev:[SRC.aphafold] },
    { claim:'c_af_03', lv:'计算预测', text:'看哪里：注意 His87 侧链的朝向；在实验结构里它是被铁"钉住"的，这里只能算一个概率性摆位。',
      sites:['his87'], focus:'his87', ev:[SRC.aphafold] }
  ];
  return narrate({ id:'af', structure:'AF-P69905', modelRun:{ model:'预生成缓存 · BS-EDU-v1（预测结构讲解）', mode:'cache',
    promptHash:'sha256:0af31c7e…22d9', params:{ temperature:0.2, top_p:0.9, max_tokens:480 },
    generatedAt:'2026-09-28 04:30 UTC', reviewedBy:'科学复核 · 已通过（演示）' }, title:'AlphaFold 预测结构', sentences });
  void spec;
}

function candidateCard(kind){
  const list = CANDIDATES[kind] || [];
  const el = addTurn(`<div class="card">
    <p class="card__kicker">检索命中多个候选 · 不静默猜测</p>
    <h4 class="card__title">「${kind === 'hemoglobin' ? '血红蛋白' : '肌红蛋白'}」对应多个结构</h4>
    <p>请选择要加载的结构（真实实现中候选来自多标识符解析服务）。</p>
    <div class="cands">${list.map(c=>`<button data-id="${c.id}">
      <span class="c-id">${c.id}</span><span class="c-name">${c.name}</span><span class="c-src">${c.src}</span></button>`).join('')}</div>
  </div>`, true);
  $$('.cands button', el).forEach(b=> b.onclick = ()=>{
    const id = b.dataset.id;
    State.structure = null;
    executeCommand({ action:'load_structure', target:id });
    if (id === '1HHO') narrate(SCRIPTS.s1);
    else if (id === 'AF-P69905') runPredict();
    else addLibraryCard(PRESETS.find(p=>p.id === id));
  });
}

function denyCard(){
  addTurn(`<div class="card card--deny">
    <p class="card__kicker">安全策略命中 · 后端判定</p>
    <h4 class="card__title">${SAFETY.denyTitle}</h4>
    <p>${SAFETY.denyBody}</p>
    <div class="trace">${SAFETY.trace.map(x=>`· ${x}`).join('<br>')}</div>
  </div>`, true);
  logCommand({ action:'safety.refuse' }, false, 'REFUSE · 已留痕', 1);
}

function unsupportedCard(t){
  addTurn(`<div class="card">
    <p class="card__kicker">拒答 · 超出证据范围</p>
    <h4 class="card__title">暂无可靠来源支持</h4>
    <p>「${escapeHtml(t.slice(0,28))}」涉及临床判断或个人化结论，教学证据库不覆盖此类问题。按 FR-AI-005，这里明确说明"没有可靠来源"，而不是给一个听起来合理的答案。</p>
    <div class="trace">· 检索范围：结构 · 功能注释 · 教科书级共识<br>· 命中 0 条可绑定证据<br>· 无源断言计数保持 0</div>
  </div>`, true);
}

function clarifyCard(t){
  addTurn(`<div class="card">
    <p class="card__kicker">未解析为可执行意图</p>
    <h4 class="card__title">还不能把这句话变成 3D 动作</h4>
    <p>已记录原文，未执行任何渲染指令（避免"看起来执行了"的假反馈）。可试试：</p>
    <div class="cands">
      <button data-say="1HHO 怎么运氧？"><span class="c-id">1HHO</span><span class="c-name">怎么运氧？</span><span class="c-src">load → highlight → narrate</span></button>
      <button data-say="线粒体长什么样？"><span class="c-id">线粒体</span><span class="c-name">细胞器示意</span><span class="c-src">示意声明</span></button>
      <button data-say="和肌红蛋白比呢？"><span class="c-id">对比</span><span class="c-name">1HHO vs 1MBO</span><span class="c-src">compare</span></button>
    </div></div>`, true);
  void t;
  $$('#thread .cands button').forEach(b=> b.onclick = ()=> send(b.dataset.say));
}

/* ══ 会话：保存 / 恢复 / 导出（FR-SES-001~003） ════════════════ */
const LS_KEY = 'biosynapse.sessions.v1';
function loadSessions(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch(_) { return []; }
}
function persist(list){
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch(_){}
  renderSessions();
}
function saveSession(){
  const list = loadSessions();
  const spec = STRUCTURES[State.structure] || {};
  const rec = {
    id:'s_' + Date.now(),
    name:`${State.structure || '未加载'} · ${new Date().toLocaleTimeString('zh-CN',{hour12:false})}`,
    at:new Date().toISOString(),
    structure:State.structure, compare:State.compareStructure, rep:State.rep,
    highlights:[...State.highlights], selection:State.selection,
    camera:VM.snapshot(), lastClaim:State.lastClaim,
    audit:{ sources:spec.source || '—', mode:State.mode, proto:true }
  };
  list.unshift(rec);
  persist(list.slice(0, 12));
  addTurn(`<div class="card"><p class="card__kicker">会话已保存</p>
    <h4 class="card__title">${rec.name}</h4>
    <div class="trace">· 结构 ${rec.structure || '—'} · 视角 ${rec.camera.yaw.toFixed(2)}/${rec.camera.pitch.toFixed(2)} · 高亮 ${rec.highlights.length} 项<br>
    · 导出内容保留来源 URL、retrieved_at、模型版本等审计字段（FR-SES-003）</div></div>`, true);
}
function restorePrompt(){
  const list = loadSessions();
  if (!list.length) return addTurn(`<div class="card"><p class="card__kicker">恢复</p><p>还没有保存过的会话。</p></div>`);
  const el = addTurn(`<div class="card"><p class="card__kicker">恢复会话</p>
    <h4 class="card__title">选择要恢复的会话</h4>
    <div class="cands">${list.map(s=>`<button data-id="${s.id}">
      <span class="c-id">${s.structure || '—'}</span><span class="c-name">${s.name}</span>
      <span class="c-src">${new Date(s.at).toLocaleString('zh-CN',{hour12:false})}</span></button>`).join('')}</div></div>`, true);
  $$('.cands button', el).forEach(b=> b.onclick = ()=> restoreSession(b.dataset.id));
}
function restoreSession(id){
  const rec = loadSessions().find(s=>s.id === id);
  if (!rec) return;
  $('#thread').innerHTML = '';
  if (rec.compare) ensureCompare(true);
  executeCommand({ action:'load_structure', target:rec.structure });
  if (rec.compare) executeCommand({ action:'load_structure', target:rec.compare, slot:'compare' });
  executeCommand({ action:'set_representation', style:rec.rep });
  (rec.highlights||[]).forEach(k=> executeCommand({ action:'highlight', target:[k] }));
  VM.apply(rec.camera);
  if (VC) VC.apply(rec.camera);
  const script = Object.values(SCRIPTS).find(s=> s.structure === rec.structure);
  if (script) renderStaticNarration(script);
  addTurn(`<div class="card"><p class="card__kicker">会话已恢复</p>
    <h4 class="card__title">${rec.name}</h4>
    <p>视角、高亮、讲解与证据状态按保存时的记录重建；结构来源可用时重新拉取，不可用时回落缓存并显式提示。</p></div>`, true);
}
function renderSessions(){
  const list = loadSessions();
  const ul = $('#sessionList');
  $('#sessionCount').textContent = list.length ? `${list.length} 条` : '0 条';
  $('#btnExport').disabled = !list.length;
  if (!list.length){ ul.innerHTML = '<li class="sessions__empty">尚无保存的会话</li>'; return; }
  ul.innerHTML = '';
  list.forEach(s=>{
    const li = document.createElement('li');
    li.innerHTML = `<button><span class="s-name">${s.structure || '—'} · ${new Date(s.at).toLocaleString('zh-CN',{hour12:false})}</span>
      <span class="s-meta">${s.highlights.length} 高亮 · ${s.rep}</span></button>`;
    $('button', li).onclick = ()=> restoreSession(s.id);
    ul.appendChild(li);
  });
}
$('#btnExport').onclick = ()=>{
  const list = loadSessions();
  const payload = {
    app:'BioSynapse', version:'0.1.0-alpha', prototype:true,
    exportedAt:new Date().toISOString(),
    note:'导出包含结构标识、视角参数、断言与证据清单及其审计字段；演示数据未经校验。',
    sessions:list
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `biosynapse-sessions-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$('#btnSave').onclick = ()=> saveSession();

/* ══ 模式切换（NFR-7 能力契约） ════════════════════════════════ */
$$('.modeswitch__opt').forEach(b=>{
  b.onclick = ()=>{
    State.mode = b.dataset.mode;
    $$('.modeswitch__opt').forEach(x=>{
      const on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-checked', String(on));
    });
    const copy = {
      cache:'已切到预生成缓存兜底：零配置可用，首 token 目标 < 2s；断网或未配置 Key 时自动落到这条路径。',
      byok:'已切到 BYOK：需要你的 API Key。原型不发起真实调用；能力契约显示为流式 + 函数调用 + 结构化输出。',
      local:'已切到本地模型：若模型不支持结构化输出，将按能力契约降级为「文本 + 代码块提取」，并按最大上下文裁剪历史。'
    }[State.mode];
    addTurn(`<div class="card"><p class="card__kicker">讲解来源 · 能力契约</p><p>${copy}</p>
      <div class="trace">can_stream · can_call_functions · max_context · can_structured_output · can_control_3d</div></div>`, true);
  };
});

/* ══ 指令日志开关 / 快捷输入 ═══════════════════════════════════ */
$('#logToggle').onclick = e=>{
  const open = $('#cmdLog').hidden;
  $('#cmdLog').hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
};
$$('#quickChips button').forEach(b=> b.onclick = ()=> send(b.dataset.say));
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-say]');
  if (b && !b.closest('#quickChips')) send(b.dataset.say);
});

/* 输入框 */
const input = $('#input');
function submitInput(){
  const t = input.value.trim();
  if (!t) return;
  input.value = '';
  send(t);
}
$('#btnSend').onclick = submitInput;
input.addEventListener('keydown', e=>{
  if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); submitInput(); }
});
document.addEventListener('keydown', e=>{
  if (e.key === 'Escape'){
    $('#drawer').hidden = true; $('#pickCard').hidden = true;
    $('#tabEvid').classList.remove('is-on');
    $('#tabNarr').classList.add('is-on');
  }
});

/* 结构库检索 */
$('#libSearch').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  $$('#presetList li').forEach(li=>{
    const b = $('button', li);
    li.classList.toggle('hide', !!q && !b.textContent.toLowerCase().includes(q));
  });
});

/* 场景入口 */
$$('#sceneList button, .vp__empty [data-scene]').forEach(b=>{
  b.onclick = ()=>{
    const s = b.dataset.scene;
    if (s === 's1'){ executeCommand({ action:'load_structure', target:'1HHO' }); narrate(SCRIPTS.s1); }
    if (s === 's2'){
      executeCommand({ action:'load_structure', target:'1HHO' });
      handlePick({ siteKey:'his87' });
      narrate(SCRIPTS.s2);
    }
    if (s === 's3') narrate(SCRIPTS.s3);
    if (s === 's4') narrate(SCRIPTS.s4);
  };
});

/* 过程入口 */
$$('#presetList button').forEach(()=>{});

/* ══ HUD 轮询 ═════════════════════════════════════════════════ */
setInterval(()=>{
  const s = VM.stats();
  $('#hudFps').textContent = s.fps || '–';
  $('#hudPrim').textContent = s.prims || '–';
  $('#hudZoom').textContent = s.zoom.toFixed ? s.zoom.toFixed(2) + '×' : s.zoom + '×';
}, 500);

/* ══ 启动 ═════════════════════════════════════════════════════ */
renderPresetList();
renderSessions();
renderSelection();
$('#composerHint').textContent = 'Enter 发送 · Shift+Enter 换行 · 演示数据不发起真实模型调用';