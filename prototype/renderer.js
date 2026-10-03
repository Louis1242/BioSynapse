/* ══════════════════════════════════════════════════════════════════
   renderer.js · 轻量伪 3D 渲染引擎（零依赖）
   ──────────────────────────────────────────────────────────────────
   原型用途：自研投影 + 画家算法，替代真实分子渲染框架，用于验证
   「状态单源 → 指令化执行 → 渲染器只读」的边界（见 ADR-0001）。
   真实工程中该层由分子渲染框架承担，接口形状保持一致：
     setScene / setRepresentation / setHighlight / focusSite / pick / snapshot
   渲染器不持有应用状态，只接受指令并回传投影信息。
   ══════════════════════════════════════════════════════════════════ */

const V3 = {
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]
};

/* 元素色取 CPK 惯例：颜色承载化学语义，不做装饰（已为白底加深） */
const ELEMENT = {
  C :{ color:'#6f6f6a', vdw:1.70 },
  N :{ color:'#5b84c4', vdw:1.55 },
  O :{ color:'#cf5538', vdw:1.52 },
  S :{ color:'#bd9a45', vdw:1.80 },
  P :{ color:'#b97f3e', vdw:1.80 },
  FE:{ color:'#a25a2c', vdw:1.30 }
};
const CHAIN_COLOR = ['#7d94ad','#b09674','#8aa288','#a291ab','#b3a276','#85a3a3'];
/* 高亮色：白底上墨黑对比不足，改为品红；各处一律配低不透明度，避免遮住结构本身 */
const SEL = '#c0399f';
const AMBER = '#9b917d';

function mulberry(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shade(hex, amt){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  if (amt < 0){ r*=1+amt; g*=1+amt; b*=1+amt; }
  else { r+=(255-r)*amt; g+=(255-g)*amt; b+=(255-b)*amt; }
  return `rgb(${r|0},${g|0},${b|0})`;
}
function rgba(hex, a){
  if (hex.startsWith('rgb')) return hex.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  const n = parseInt(hex.slice(1),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/* ══ 几何生成 ═════════════════════════════════════════════════════ */

/* 珠蛋白折叠：8 段 α 螺旋 + 非螺旋环区 + C 端尾 + 中央血红素 */
function buildGlobin(spec){
  const rnd = mulberry(spec.seed || 1);
  const atoms=[], bonds=[], ribbons=[], hemes=[], sites={};
  const HELICES = [
    { name:'A', from:4,   to:18  }, { name:'B', from:19, to:35 },
    { name:'C', from:36,  to:42  }, { name:'D', from:43, to:50 },
    { name:'E', from:52,  to:72  }, { name:'F', from:77, to:88 },
    { name:'G', from:92,  to:100 }, { name:'H', from:103,to:136 }
  ];
  const SINGLE = spec.chains.length === 1;
  const ORIGIN = SINGLE ? [[0,0,0]]
    : [[-9.6,-3.2,1.6],[9.6,3.2,-1.6],[9.6,-3.2,-1.6],[-9.6,3.2,1.6]];
  const RESN = ['ALA','LEU','VAL','GLY','GLU','LYS','SER','THR','ASP','PHE','ILE','ASN'];

  spec.chains.forEach((chain, ci)=>{
    const origin = ORIGIN[ci % ORIGIN.length];
    const color = CHAIN_COLOR[ci % CHAIN_COLOR.length];
    const isBeta = !!chain.offset;
    const proxResi = SINGLE ? 93 : (isBeta ? 92 : 87);
    const distResi = SINGLE ? 64 : (isBeta ? 63 : 58);
    const proxKey  = SINGLE ? 'his93' : (isBeta ? 'his92' : 'his87');
    const distKey  = SINGLE ? 'his64' : (isBeta ? 'his63' : 'his58');

    /* 血红素口袋 */
    const pocketDir  = V3.norm([0.30, -0.22, 0.93]);
    const hemeCenter = V3.add(origin, V3.mul(pocketDir, 4.4));
    const hemeNormal = V3.norm([pocketDir[0]*0.4, pocketDir[1]*0.4, pocketDir[2]]);
    const n1 = V3.norm(V3.cross(hemeNormal, [0,1,0]));
    const n2 = V3.cross(hemeNormal, n1);
    const proximalPos = V3.add(hemeCenter, V3.mul(hemeNormal, -3.0));
    const distalPos   = V3.add(hemeCenter, V3.add(V3.mul(hemeNormal, 3.2), V3.mul(n1, 1.1)));

    const chains_pts = [];
    const helixData = [];

    HELICES.forEach((h, hi)=>{
      const phi = (hi*45 + ci*11) * Math.PI/180;
      const R = 8.5 + (hi % 2)*1.0;
      const zOff = ((hi % 4) - 1.5)*3.0;
      const center = V3.add(origin, [Math.cos(phi)*R, Math.sin(phi)*R, zOff]);
      const sign = hi % 2 ? 1 : -1;
      const tilt = ((hi % 3) - 1)*0.2;
      const axis = V3.norm([-Math.sin(phi)*sign, Math.cos(phi)*sign, tilt]);
      const p1 = V3.norm(V3.cross(axis, [0,0,1]));
      const p2 = V3.cross(axis, p1);
      const N = h.to - h.from + 1;
      const pts=[], resis=[];
      for (let t=0;t<N;t++){
        const along = (t-(N-1)/2)*1.46;
        const ang = t*1.72 + hi*0.7;
        const wob = V3.mul(V3.add(V3.mul(p1, Math.cos(ang)), V3.mul(p2, Math.sin(ang))), 2.25);
        const jit = V3.mul([rnd()-0.5, rnd()-0.5, rnd()-0.5], 0.4);
        let pos = V3.add(V3.add(center, V3.mul(axis, along)), V3.add(wob, jit));
        const resi = h.from + t;
        let key = null, resn;
        if (resi === proxResi){ pos = V3.lerp(pos, proximalPos, 0.93); key = proxKey; resn = 'HIS'; }
        else if (resi === distResi){ pos = V3.lerp(pos, distalPos, 0.9); key = distKey; resn = 'HIS'; }
        else resn = RESN[Math.floor(rnd()*RESN.length)];

        const idx = atoms.length;
        atoms.push({ i:idx, chain:chain.id, resi, resn, el:'C', pos, color, helix:h.name, sites:key?[key]:[] });
        if (t>0) bonds.push({ a:idx-1, b:idx, kind:'backbone', color });
        if (key) sites[key] = { key, kind:'residue', chain:chain.id, resi, resn:'HIS', pos, anchor:pos };
        pts.push(pos); resis.push(resi);
      }
      helixData.push({ pts, resis });
      ribbons.push({ chain:chain.id, helix:h.name, color, pts, resis });
      chains_pts.push(pts);
    });

    /* 环区 */
    for (let i=0;i<helixData.length-1;i++){
      const a = helixData[i].pts.at(-1), b = helixData[i+1].pts[0];
      const mid = V3.add(V3.mul(V3.add(a,b),0.5), V3.mul(V3.norm(V3.sub(b,a)), (i%2?1.6:-1.6)));
      const pts=[];
      for (let t=0;t<=6;t++){
        const u=t/6, w0=(1-u)*(1-u), w1=2*(1-u)*u, w2=u*u;
        pts.push([a[0]*w0+mid[0]*w1+b[0]*w2, a[1]*w0+mid[1]*w1+b[1]*w2, a[2]*w0+mid[2]*w1+b[2]*w2]);
      }
      ribbons.push({ chain:chain.id, color, pts, isLoop:true });
      chains_pts.push(pts);
    }

    /* C 端尾（β 链含 His146 / 波尔效应残基） */
    const tailStart = helixData.at(-1).pts.at(-1);
    const tailDir = V3.norm(V3.sub(tailStart, origin));
    const tailPts=[], tailResis=[];
    for (let t=1;t<=9;t++){
      const pos = V3.add(tailStart, V3.add(V3.mul(tailDir, t*1.5), [Math.sin(t*0.9)*1.1, Math.cos(t*1.3)*0.9, Math.sin(t*0.6)*0.8]));
      const resi = 136+t;
      const idx = atoms.length;
      const isH146 = resi === 146 && isBeta;
      atoms.push({ i:idx, chain:chain.id, resi, resn:isH146?'HIS':'GLY', el:'C', pos, color, sites:isH146?['his146']:[] });
      if (t>1) bonds.push({ a:idx-1, b:idx, kind:'backbone', color });
      tailPts.push(pos); tailResis.push(resi);
      if (isH146) sites['his146'] = { key:'his146', kind:'residue', chain:chain.id, resi, resn:'HIS', pos, anchor:pos };
    }
    ribbons.push({ chain:chain.id, color, pts:tailPts, resis:tailResis, isTail:true });

    /* 血红素（原卟啉 IX 粗模 + Fe²⁺） */
    const hemeIdx = [];
    const ringR = 3.4;
    for (let k=0;k<20;k++){
      if (k % 5 === 0) continue;      // 四个吡咯氮的位置留空
      const ang = k/20*Math.PI*2;
      const pos = V3.add(hemeCenter, V3.add(V3.mul(n1, Math.cos(ang)*ringR), V3.mul(n2, Math.sin(ang)*ringR)));
      hemeIdx.push(atoms.push({ i:atoms.length, chain:chain.id, resi:0, resn:'HEM', el:'C', pos, color:'#c9c3b6', sites:['heme-'+chain.id] }) - 1);
    }
    for (let k=0;k<4;k++){
      const ang = k/4*Math.PI*2 + 0.31;
      const pos = V3.add(hemeCenter, V3.add(V3.mul(n1, Math.cos(ang)*ringR*0.5), V3.mul(n2, Math.sin(ang)*ringR*0.5)));
      hemeIdx.push(atoms.push({ i:atoms.length, chain:chain.id, resi:0, resn:'HEM', el:'N', pos, color:ELEMENT.N.color, sites:['heme-'+chain.id] }) - 1);
    }
    const tailDir2 = V3.mul(V3.add(V3.mul(n1, 0.85), V3.mul(n2, 0.53)), 1);
    [-1,1].forEach(s=>{
      for (let t=1;t<=5;t++){
        const pos = V3.add(hemeCenter, V3.add(V3.mul(tailDir2, s*(ringR + 1.6*t)), V3.mul(hemeNormal, -0.3*t)));
        hemeIdx.push(atoms.push({ i:atoms.length, chain:chain.id, resi:0, resn:'HEM', el:(t%2?'C':'O'), pos,
          color:(t%2?ELEMENT.C.color:ELEMENT.O.color), sites:['heme-'+chain.id] }) - 1);
      }
    });
    const feIdx = atoms.push({ i:atoms.length, chain:chain.id, resi:0, resn:'FE', el:'FE', pos:hemeCenter, color:ELEMENT.FE.color, sites:['heme-'+chain.id] }) - 1;
    hemeIdx.push(feIdx);
    for (let k=0;k<hemeIdx.length-1;k++) bonds.push({ a:hemeIdx[k], b:hemeIdx[(k+1)%(hemeIdx.length-1)], kind:'heme' });

    const proxIdx = atoms.findIndex(a=>a.chain===chain.id && a.resi===proxResi);
    if (proxIdx >= 0) bonds.push({ a:proxIdx, b:feIdx, kind:'coordination' });

    hemes.push({ chain:chain.id, center:hemeCenter, normal:hemeNormal, fe:feIdx, siteKey:'heme-'+chain.id });
    sites['heme-'+chain.id] = { key:'heme-'+chain.id, kind:'heme', chain:chain.id, resi:proxResi, pos:hemeCenter, anchor:hemeCenter };

    if (!SINGLE && chain.id === 'A') sites['interface'] = { key:'interface', kind:'region', chain:'A', resi:41, pos:V3.add(origin,[0,7.5,0]), anchor:V3.add(origin,[0,7.5,0]) };
    if (!SINGLE && chain.id === 'B') sites['cavity']    = { key:'cavity',    kind:'region', chain:'B', resi:2,  pos:[0,0,0], anchor:[0,0,0] };
  });

  return { kind:'molecule', atoms, bonds, ribbons, hemes, meshes:[], sites };
}

/* 细胞器示意：双层椭球膜 + 折叠嵴 + 基质颗粒 + 环状 DNA */
function buildOrganelle(spec){
  const rnd = mulberry(spec.seed || 33);
  const meshes=[], ribbons=[], atoms=[], sites={};
  const RX=25, RY=13.5, RZ=13.8;

  function ellipsoid(sx,sy,sz,alpha){
    const verts=[], faces=[], NU=24, NV=15;
    for (let v=0;v<=NV;v++){
      const th = v/NV*Math.PI;
      for (let u=0;u<NU;u++){
        const ph = u/NU*Math.PI*2;
        verts.push([Math.sin(th)*Math.cos(ph)*sx, Math.cos(th)*sy, Math.sin(th)*Math.sin(ph)*sz]);
      }
    }
    const id=(u,v)=> v*NU + (u % NU);
    for (let v=0;v<NV;v++) for (let u=0;u<NU;u++) faces.push([id(u,v), id(u+1,v), id(u+1,v+1), id(u,v+1)]);
    return { verts, faces, alpha };
  }
  meshes.push({ ...ellipsoid(RX, RY, RZ, 0.13), color:'#7fa7c9', siteKey:'outer' });
  meshes.push({ ...ellipsoid(RX*0.88, RY*0.84, RZ*0.84, 0.10), color:AMBER, siteKey:'inner' });

  /* 嵴：内膜内折，以折带表达（示意，不含真实几何） */
  for (let i=0;i<7;i++){
    const x0 = (i/6 - 0.5)*2 * RX*0.62;
    const folds = 4 + (i%2);
    const pts=[];
    for (let k=0;k<=folds*5;k++){
      const u = k/(folds*5);
      const y = (u-0.5)*RY*1.36;
      const zig = Math.sin(u*Math.PI*folds)*RY*0.44;
      const taper = 1 - Math.pow(Math.abs(u-0.5)*2, 2);
      pts.push([x0 + zig*0.3, y, zig*taper*1.05]);
    }
    ribbons.push({ chain:'M'+i, color:AMBER, pts, isCrista:true });
  }

  /* 基质颗粒 */
  for (let i=0;i<190;i++){
    const th = rnd()*Math.PI, ph = rnd()*Math.PI*2, r = 0.54 + rnd()*0.36;
    atoms.push({ i:atoms.length, chain:'M', resi:0, resn:'MTX', el:'C', color:'#5d6672', sites:['matrix'],
      pos:[Math.sin(th)*Math.cos(ph)*RX*0.76, Math.cos(th)*RY*0.72, Math.sin(th)*Math.sin(ph)*RZ*0.76] });
  }
  /* 环状 DNA（拟核） */
  const dnaC = [-RX*0.4, RY*0.1, 1.0], dnaR = 4.4;
  for (let k=0;k<46;k++){
    const a = k/46*Math.PI*2, wob = 0.9*Math.sin(a*3);
    atoms.push({ i:atoms.length, chain:'D', resi:k+1, resn:'DNA', el:'P', color:'#96ab90', sites:['mtdna'],
      pos:[dnaC[0] + Math.cos(a)*(dnaR+wob)*0.9, dnaC[1] + Math.sin(a)*(dnaR+wob)*0.5, dnaC[2] + wob*0.9] });
  }

  sites['outer']   = { key:'outer',   kind:'region', label:'外膜',       anchor:[0, RY*1.05, 0] };
  sites['inner']   = { key:'inner',   kind:'region', label:'内膜',       anchor:[-RX*0.86, RY*0.34, 0] };
  sites['cristae'] = { key:'cristae', kind:'region', label:'嵴',         anchor:[0, 0, RZ*0.92] };
  sites['matrix']  = { key:'matrix',  kind:'region', label:'基质',       anchor:[RX*0.36, -RY*0.62, 0] };
  sites['mtdna']   = { key:'mtdna',   kind:'region', label:'线粒体 DNA', anchor:dnaC };

  return { kind:'organelle', atoms, bonds:[], ribbons, hemes:[], meshes, sites };
}

/* 过程示意：小型酶 + 可动底物（分步插值，不含动力学量） */
function buildProcess(spec){
  const atoms=[], bonds=[], ribbons=[], sites={};
  [[-1,-1],[1,1]].forEach((s,i)=>{
    const axis = V3.norm([s[0], 0.22*s[1], 0.26*s[1]]);
    const p1 = V3.norm(V3.cross(axis,[0,0,1])), p2 = V3.cross(axis,p1);
    const center = [s[0]*6.4, s[1]*2.2, 0];
    const pts=[];
    for (let t=0;t<17;t++){
      const along = (t-8)*1.45, ang = t*1.72;
      const pos = V3.add(center, V3.add(V3.mul(axis, along), V3.add(V3.mul(p1, Math.cos(ang)*2.3), V3.mul(p2, Math.sin(ang)*2.3))));
      const idx = atoms.length;
      atoms.push({ i:idx, chain:'E', resi:t+1, resn:'CAT', el:'C', color:CHAIN_COLOR[i], pos, sites:['site'] });
      if (t>0) bonds.push({ a:idx-1, b:idx, kind:'backbone', color:CHAIN_COLOR[i] });
      pts.push(pos);
    }
    ribbons.push({ chain:'E'+i, color:CHAIN_COLOR[i], pts });
  });
  atoms.push({ i:atoms.length, chain:'E', resi:64,  resn:'SER', el:'O', color:ELEMENT.O.color, pos:[-1.2,1.6,2.1], sites:['site'] });
  atoms.push({ i:atoms.length, chain:'E', resi:102, resn:'HIS', el:'N', color:ELEMENT.N.color, pos:[ 1.2,2.1,1.2], sites:['site'] });

  const subStart = atoms.length;
  [[-0.6,5.8,3.0],[1.7,6.5,2.2],[0.2,4.5,4.3]].forEach((p,k)=>{
    atoms.push({ i:atoms.length, chain:'S', resi:k+1, resn:'SUB', el:(k===0?'C':'O'),
      color:(k===0?ELEMENT.C.color:ELEMENT.O.color), pos:p, sites:['substrate'],
      mover:{ free:p,
              bind:[p[0]*0.42-0.2, 2.7-k*0.7, 3.5-k*0.9],
              mid :[p[0]*0.30,      2.1+k*0.4, 3.1+k*0.1],
              out :[p[0]*0.4+2.4,   7.2+k,     1.5+k] } });
    if (k>0) bonds.push({ a:subStart, b:atoms.length-1, kind:'substrate' });
  });
  const subEnd = atoms.length;

  sites['site']      = { key:'site',      kind:'region', label:'活性位点', anchor:[0,1.4,2.8] };
  sites['substrate'] = { key:'substrate', kind:'region', label:'底物',     anchor:[0.6,5.9,3.0] };
  sites['product']   = { key:'product',   kind:'region', label:'产物',     anchor:[2.6,7.6,1.7] };

  return { kind:'process', atoms, bonds, ribbons, hemes:[], meshes:[], sites, subStart, subEnd };
}

const BUILDERS = { globin:buildGlobin, organelle:buildOrganelle, process:buildProcess };

/* ══ 渲染器 ═══════════════════════════════════════════════════════ */
function BSViewer(canvas, opts){
  const o = Object.assign({ labelHost:null, onCamera:null, onPick:null, autoRotate:true }, opts||{});
  const ctx = canvas.getContext('2d');
  const labelHost = o.labelHost || canvas.parentElement;
  const st = {
    scene:null, rep:'cartoon', highlights:new Set(),
    yaw:-0.62, pitch:0.30, dist:150, target:[0,0,0], targetGoal:null, distGoal:null,
    w:1, h:1, dpr:1, prims:0, picks:[], labelEls:new Map(),
    time:0, frames:0, lastFps:0, fps:0, step:0,
    drag:false, moved:false, last:[0,0], vel:[0,0], spin:o.autoRotate ? 0.00035 : 0
  };
  const sprites = new Map();

  function sprite(color, rPx, glow){
    const q = Math.max(2, Math.round(rPx));
    const key = color + '|' + q + '|' + (glow?1:0);
    if (sprites.has(key)) return sprites.get(key);
    const size = Math.ceil(q*2.3);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const cx = size/2, rad = size/2;
    const grad = g.createRadialGradient(cx-rad*0.34, cx-rad*0.38, rad*0.05, cx, cx, rad*0.94);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.32, color);
    grad.addColorStop(1, shade(color, -0.66));
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cx, rad*0.94, 0, Math.PI*2); g.fill();
    if (sprites.size > 900) sprites.clear();
    sprites.set(key, c);
    return c;
  }

  function resize(){
    const r = canvas.getBoundingClientRect();
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
    canvas.width = Math.floor(st.w*st.dpr);
    canvas.height = Math.floor(st.h*st.dpr);
  }

  /* 世界 → 屏幕（透视投影） */
  function project(p){
    const cy=Math.cos(st.yaw), sy=Math.sin(st.yaw);
    const cp=Math.cos(st.pitch), sp=Math.sin(st.pitch);
    const x=p[0]-st.target[0], y=p[1]-st.target[1], z=p[2]-st.target[2];
    const x1 = x*cy + z*sy, z1 = -x*sy + z*cy;
    const y1 = y*cp - z1*sp, z2 = y*sp + z1*cp;
    const f = st.w*1.45*st.dpr;
    const d = Math.max(18, z2 + st.dist);
    const k = f/d;
    return { x: st.w*st.dpr/2 + x1*k, y: st.h*st.dpr/2 - y1*k, z:d, k, vis:d>0 };
  }
  const fog = (z,a)=> a*(1 - Math.min(1, Math.max(0,(z-70)/240))*0.42);
  const scaleR = k => k*(st.dist/150);

  function strokePath(pts){
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  /* 主链带状 */
  function drawRibbons(rep){
    const list = st.scene.ribbons.map(rb=>{
      const pts = rb.pts.map(project);
      return { rb, pts, z: pts.reduce((s,p)=>s+p.z,0)/pts.length };
    }).sort((a,b)=>b.z-a.z);
    st.prims = list.length;
    list.forEach(({rb, pts, z})=>{
      if (pts.length < 2) return;
      const loop = !!rb.isLoop;
      const sel = rb.resis && [...st.highlights].some(k=>{
        const s = st.scene.sites[k];
        return s && s.kind === 'residue' && s.chain === rb.chain && rb.resis.includes(s.resi);
      });
      const w = (loop ? 1.6 : 4.8)*st.dpr*Math.max(.55, st.dist/150);
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.strokeStyle = rgba('#050608', fog(z, loop?0.5:0.6));
      ctx.lineWidth = w + (loop?1.4:3.4)*st.dpr;
      strokePath(pts); ctx.stroke();
      ctx.strokeStyle = rgba(sel ? SEL : rb.color, fog(z, loop?0.5:(sel?0.72:0.92)));
      ctx.lineWidth = w; strokePath(pts); ctx.stroke();
      if (sel){
        ctx.strokeStyle = rgba(SEL, fog(z, 0.28));
        ctx.lineWidth = w + 4*st.dpr; strokePath(pts); ctx.stroke();
      }
    });
    void rep;
  }

  /* 小半径原子（卡通模式下的 Cα 与侧链标记） */
  function drawAtomsSmall(){
    const list = [];
    st.scene.atoms.forEach(a=>{
      if (a.resn === 'HEM' || a.resn === 'FE') return;
      const p = project(a.pos);
      list.push({ p, a });
      st.picks.push({ x:p.x, y:p.y, z:p.z, siteKey:(a.sites&&a.sites[0])||null, atom:a, resi:a.resi, chain:a.chain, resn:a.resn, rad:12*st.dpr });
    });
    list.sort((x,y)=>y.p.z-x.p.z);
    st.prims += list.length;
    list.forEach(({p,a})=>{
      const sel = a.sites && a.sites.some(s=>st.highlights.has(s));
      const r = (sel?3.2:2.0)*scaleR(p.k);
      if (r < 0.5) return;
      const s = sprite(sel?SEL:a.color, r*st.dpr, sel);
      ctx.globalAlpha = fog(p.z, sel ? 0.82 : 1);
      ctx.drawImage(s, p.x - s.width/2, p.y - s.height/2);
      ctx.globalAlpha = 1;
    });
  }

  /* 大半径原子（球棍 / 空间填充 / 表面）。
     不变量：四种表示模式必须有可区分的渲染参数 ——
     球棍 vdw×0.46 且画键；空间填充 vdw×0.95 不画键；表面同空间填充再加轮廓晕圈。 */
  function drawAtomsBig(rep){
    const stick = rep === 'ball-and-stick';
    const surface = rep === 'surface';
    const list = st.scene.atoms.map(a=>{
      const p = project(a.pos);
      const el = ELEMENT[a.el] || ELEMENT.C;
      const sel = a.sites && a.sites.some(s=>st.highlights.has(s));
      const base = stick ? el.vdw*0.46 : el.vdw*0.95;
      const r = base*scaleR(p.k)*(sel?1.28:1);
      return { p, a, el, sel, r };
    }).sort((x,y)=>y.p.z-x.p.z);
    st.prims += list.length;
    /* 所有大原子模式都可拾取（半径随表示模式放大） */
    list.forEach(({p,a,el,sel,r})=>{
      st.picks.push({ x:p.x, y:p.y, z:p.z, siteKey:(a.sites&&a.sites[0])||null, atom:a, resi:a.resi, chain:a.chain, resn:a.resn, rad:Math.max(10*st.dpr, r*st.dpr) });
    });
    if (stick){
      /* 先画键，再画球 */
      const bonds = st.scene.bonds.map(b=>{
        const A = st.scene.atoms[b.a], B = st.scene.atoms[b.b];
        if (!A || !B) return null;
        const pa = project(A.pos), pb = project(B.pos);
        return { pa, pb, z:(pa.z+pb.z)/2, kind:b.kind, color:b.color || A.color };
      }).filter(Boolean).sort((x,y)=>y.z-x.z);
      bonds.forEach(({pa,pb,z,kind,color})=>{
        ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y);
        const w = (kind==='coordination' ? 2.2 : kind==='heme' ? 1.6 : 3.2)*st.dpr*Math.max(.5, st.dist/150);
        ctx.lineWidth = Math.max(.7, w);
        ctx.strokeStyle = kind === 'coordination'
          ? rgba(SEL, fog(z, 0.6))
          : rgba(shade(color, -0.2), fog(z, kind === 'heme' ? 0.85 : 0.7));
        ctx.stroke();
      });
    }
    list.forEach(({p,a,sel,r})=>{
      if (r < 0.5) return;
      if (surface){
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.5, r + 1.7*st.dpr), 0, Math.PI*2);
        ctx.fillStyle = rgba('#0b0e12', fog(p.z, 0.9)); ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.4, r), 0, Math.PI*2);
        ctx.fillStyle = rgba(sel ? SEL : '#7f8c94', fog(p.z, sel ? 0.7 : 0.96)); ctx.fill();
      } else {
        const s = sprite(sel ? SEL : a.color, r*st.dpr, sel);
        ctx.globalAlpha = fog(p.z, sel ? 0.82 : 1);
        ctx.drawImage(s, p.x - s.width/2, p.y - s.height/2);
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawHemes(compact){
    /* 高亮反馈：静态、限定在选中位点本身，不做逐帧呼吸动画，避免满屏闪动的圈 */
    st.scene.hemes.forEach(h=>{
      const c = project(h.center);
      const sel = st.highlights.has(h.siteKey);
      if (compact){
        const r = Math.max(3, 6.0*scaleR(c.k));
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI*2);
        ctx.strokeStyle = sel ? rgba(SEL, 0.45) : rgba(AMBER, fog(c.z, 0.6));
        ctx.lineWidth = (sel?1.6:1.2)*st.dpr; ctx.stroke();
      }
      st.picks.push({ x:c.x, y:c.y, z:c.z, siteKey:h.siteKey, resi:h.siteKey, chain:h.chain, resn:'HEM', rad:15*st.dpr });
    });
  }

  function drawMolecule(){
    st.picks = [];
    const compact = st.rep === 'cartoon' || st.rep === 'schematic';
    drawRibbons(st.rep);
    if (compact) drawAtomsSmall(); else drawAtomsBig(st.rep);
    drawHemes(compact);
  }

  function drawOrganelle(){
    st.picks = [];
    const faces = [];
    st.scene.meshes.forEach(m=>{
      const proj = m.verts.map(project);
      m.faces.forEach(f=>{
        const pts = f.map(i=>proj[i]);
        const a=pts[0], b=pts[1], c=pts[2];
        const area = (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
        if (area <= 0) return;                        // 背面剔除
        faces.push({ pts, z: pts.reduce((s,p)=>s+p.z,0)/pts.length, m });
      });
    });
    faces.sort((x,y)=>y.z-x.z);
    st.prims = faces.length;
    faces.forEach(({pts,z,m})=>{
      const sel = st.highlights.has(m.siteKey);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = rgba(sel ? SEL : m.color, fog(z, sel ? 0.20 : m.alpha));
      ctx.fill();
      ctx.strokeStyle = rgba(sel ? SEL : m.color, fog(z, sel ? 0.48 : 0.30));
      ctx.lineWidth = (sel ? 1.1 : 0.6)*st.dpr; ctx.stroke();
    });

    const cris = st.scene.ribbons.map(rb=>{
      const pts = rb.pts.map(project);
      return { rb, pts, z: pts.reduce((s,p)=>s+p.z,0)/pts.length };
    }).sort((a,b)=>b.z-a.z);
    cris.forEach(({rb, pts, z})=>{
      const sel = st.highlights.has('cristae');
      const w = (sel ? 3.6 : 2.2)*st.dpr*Math.max(.5, st.dist/150);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(sel ? SEL : rb.color, fog(z, sel ? 0.72 : 0.62));
      ctx.lineWidth = w; strokePath(pts); ctx.stroke();
    });

    st.scene.atoms.map(a=>({ p:project(a.pos), a })).sort((x,y)=>y.p.z-x.p.z).forEach(({p,a})=>{
      const sel = a.sites && st.highlights.has(a.sites[0]);
      const r = (a.resn === 'DNA' ? 2.5 : 1.6)*scaleR(p.k)*(sel?1.5:1);
      if (r < 0.35) return;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fillStyle = rgba(sel ? SEL : a.color, fog(p.z, sel ? 0.75 : 0.52));
      ctx.fill();
    });
    if (st.highlights.has('mtdna')){
      const dp = st.scene.atoms.filter(a=>a.resn === 'DNA').map(a=>project(a.pos));
      if (dp.length){
        ctx.beginPath(); dp.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath();
        ctx.strokeStyle = rgba(SEL, 0.3); ctx.lineWidth = 1.4*st.dpr; ctx.stroke();
      }
    }
    Object.values(st.scene.sites).forEach(s=>{
      const p = project(s.anchor || s.pos);
      st.picks.push({ x:p.x, y:p.y, z:p.z, siteKey:s.key, rad: Math.max(22*st.dpr, 22*scaleR(p.k)) });
    });
  }

  function drawProcess(){
    st.picks = [];
    drawRibbons('cartoon');
    drawAtomsBig('ball-and-stick');
    if (st.step >= 2){
      const A = st.scene.atoms[st.scene.subStart];
      const B = st.scene.atoms[st.scene.subEnd-1];
      if (A && B){
        const pa = project(A.pos), pb = project(B.pos);
        ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y);
        ctx.setLineDash([4*st.dpr,4*st.dpr]);
        ctx.strokeStyle = rgba(SEL, 0.72); ctx.lineWidth = 1.6*st.dpr; ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function syncLabels(){
    const keys = st.scene && st.scene.kind === 'organelle'
      ? Object.keys(st.scene.sites).filter(k=>st.scene.sites[k].label) : [];
    keys.forEach(k=>{
      let el = st.labelEls.get(k);
      if (!el){
        el = document.createElement('button');
        el.type = 'button'; el.className = 'vlabel';
        el.addEventListener('click', e=>{ e.stopPropagation(); o.onPick && o.onPick({ siteKey:k, fromLabel:true }); });
        labelHost.appendChild(el);
        st.labelEls.set(k, el);
      }
      const s = st.scene.sites[k];
      const p = project(s.anchor || s.pos);
      el.textContent = s.label;
      el.style.transform = `translate(${(p.x/st.dpr).toFixed(1)}px, ${(p.y/st.dpr).toFixed(1)}px)`;
      el.style.opacity = p.vis ? '1' : '0';
      el.classList.toggle('is-on', st.highlights.has(k));
    });
    st.labelEls.forEach((el,k)=>{
      if (!keys.includes(k)){ el.remove(); st.labelEls.delete(k); }
    });
  }

  function loop(ts){
    st.time = ts;
    st.frames++;
    if (ts - st.lastFps > 500){ st.fps = Math.round(st.frames*1000/(ts - st.lastFps)); st.frames = 0; st.lastFps = ts; }
    if (st.targetGoal){
      st.target = V3.lerp(st.target, st.targetGoal, 0.12);
      if (V3.len(V3.sub(st.target, st.targetGoal)) < 0.04) st.targetGoal = null;
    }
    if (st.distGoal != null){
      st.dist += (st.distGoal - st.dist)*0.1;
      if (Math.abs(st.dist - st.distGoal) < 0.4) st.distGoal = null;
    }
    if (!st.drag){
      st.vel[0] *= 0.93; st.vel[1] *= 0.93;
      st.yaw += st.vel[0] + st.spin;
      st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch + st.vel[1]));
    }
    if (st.scene && st.scene.kind === 'process'){
      const keys = ['free','bind','mid','out'];
      st.scene.atoms.forEach(a=>{
        if (!a.mover) return;
        const t = Math.max(0, Math.min(2.999, st.step));
        const i0 = Math.floor(t), f = t - i0;
        a.pos = V3.lerp(a.mover[keys[i0]], a.mover[keys[i0+1]], f);
      });
    }
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (st.scene){
      if (st.scene.kind === 'organelle') drawOrganelle();
      else if (st.scene.kind === 'process') drawProcess();
      else drawMolecule();
    }
    syncLabels();
    requestAnimationFrame(loop);
  }

  /* ── 交互 ── */
  canvas.addEventListener('pointerdown', e=>{
    st.drag = true; st.moved = false; st.last = [e.clientX, e.clientY];
    try { canvas.setPointerCapture(e.pointerId); } catch(_){}
    canvas.parentElement.classList.add('is-drag');
  });
  canvas.addEventListener('pointermove', e=>{
    if (!st.drag) return;
    const dx = e.clientX - st.last[0], dy = e.clientY - st.last[1];
    if (Math.abs(dx) + Math.abs(dy) > 2) st.moved = true;
    st.last = [e.clientX, e.clientY];
    st.yaw += dx*0.0062;
    st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch + dy*0.0062));
    st.vel = [dx*0.0008, dy*0.0008];
    o.onCamera && o.onCamera(snapshot());
  });
  const endDrag = ()=>{ st.drag = false; canvas.parentElement.classList.remove('is-drag'); };
  canvas.addEventListener('pointerup', e=>{ endDrag(); if (!st.moved) pickAt(e); });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    st.dist = Math.max(34, Math.min(420, st.dist*(1 + Math.sign(e.deltaY)*0.09)));
    st.distGoal = null;
    o.onCamera && o.onCamera(snapshot());
  }, { passive:false });

  function pickAt(e){
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left)*st.dpr, y = (e.clientY - r.top)*st.dpr;
    let best = null, bd = 1e9;
    st.picks.forEach(p=>{
      const d = Math.hypot(p.x - x, p.y - y);
      const lim = p.rad || 13*st.dpr;
      if (d < lim && d < bd){ bd = d; best = p; }
    });
    if (best && o.onPick) o.onPick({ siteKey:best.siteKey, atom:best.atom, resi:best.resi, chain:best.chain, resn:best.resn });
  }

  function snapshot(){ return { yaw:st.yaw, pitch:st.pitch, dist:st.dist, target:[...st.target] }; }
  function apply(s){
    if (!s) return;
    st.yaw = s.yaw; st.pitch = s.pitch; st.dist = s.dist;
    st.targetGoal = null; st.distGoal = null;
    st.target = [...(s.target || [0,0,0])];
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);

  return {
    /* 指令化接口：渲染器只读执行，不反向持有应用状态 */
    setScene(spec){
      st.scene = BUILDERS[spec.geom.kind](spec.geom);
      st.step = 0; st.target = [0,0,0]; st.targetGoal = null; st.distGoal = null;
      st.highlights = new Set();
      st.dist = spec.geom.kind === 'organelle' ? 136 : spec.geom.kind === 'process' ? 104 : 152;
      st.labelEls.forEach(el=>el.remove()); st.labelEls.clear();
    },
    setRepresentation(rep){ st.rep = rep; },
    setAutoRotate(on){ st.spin = on ? 0.00035 : 0; },
    setHighlight(keys){ st.highlights = new Set(keys || []); },
    focusSite(key, zoom){
      const s = st.scene && st.scene.sites[key];
      if (!s) return false;
      st.targetGoal = [...(s.anchor || s.pos)];
      st.distGoal = zoom || (st.scene.kind === 'organelle' ? 116 : 80);
      return true;
    },
    resetView(){
      st.targetGoal = [0,0,0];
      st.distGoal = st.scene ? (st.scene.kind === 'organelle' ? 136 : st.scene.kind === 'process' ? 104 : 152) : 152;
    },
    setStep(n){ st.step = Math.max(0, Math.min(2.999, n)); },
    getStep(){ return st.step; },
    hasSite(key){ return !!(st.scene && st.scene.sites[key]); },
    siteOf(key){ return st.scene && st.scene.sites[key]; },
    snapshot, apply,
    stats(){ return { fps:st.fps, prims:st.prims, zoom:(152/st.dist) }; },
    resize
  };
}

window.BSViewer = BSViewer;
window.V3 = V3;