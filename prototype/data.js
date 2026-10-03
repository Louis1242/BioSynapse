/* ══════════════════════════════════════════════════════════════════
   data.js · 原型演示数据（MOCK）
   ──────────────────────────────────────────────────────────────────
   重要：本文件全部为原型演示数据，不发起任何真实网络请求。
   - 结构几何为程序化生成的"类真实"坐标，用于界面与交互验证
   - 证据条目统一带 verified:false，UI 会显示"演示数据 · 未校验"
   - 科学结论取自教科书级共识；引文为摘译占位，解析与校验管线尚未接入
   ══════════════════════════════════════════════════════════════════ */

const MOCK_META = {
  prototype: true,
  dataset: '演示数据 · 未经发布校验',
  note: '无源断言校验、链接巡检、引用抽检均由后端管线在真实环境中执行'
};

/* ── 结构库 ─────────────────────────────────────────────────────── */
const PRESETS = [
  { id:'1HHO',          kind:'structure', name:'脱氧血红蛋白',        tag:'PDB · 缓存', short:'1HHO' },
  { id:'1MBO',          kind:'structure', name:'肌红蛋白（抹香鲸）',  tag:'PDB · 缓存', short:'1MBO' },
  { id:'AF-P69905',     kind:'structure', name:'血红蛋白 α 链',       tag:'AlphaFold',  short:'AF'   },
  { id:'mitochondrion', kind:'organelle', name:'线粒体',              tag:'示意',       short:'ORG'  },
  { id:'catalysis',     kind:'process',   name:'酶催化循环',          tag:'示意',       short:'PROC' }
];

/* ── 结构 ───────────────────────────────────────────────────────── */
const STRUCTURES = {

  '1HHO': {
    id:'1HHO',
    title:'人脱氧血红蛋白 · α₂β₂ 四聚体',
    source:'PDB',
    geom:{ kind:'globin', seed:1207,
      chains:[ {id:'A', label:'α1', offset:0}, {id:'B', label:'β1', offset:1},
               {id:'C', label:'α2', offset:0}, {id:'D', label:'β2', offset:1} ] },
    meta:[
      { k:'来源', v:'RCSB PDB', kind:'ok' },
      { k:'方法', v:'X 射线衍射' },
      { k:'分辨率', v:'1.74 Å' },
      { k:'尺度', v:'纳米 (10⁻⁹ m)' },
      { k:'单位', v:'Å' },
      { k:'坐标系', v:'右手正交（PDB）' },
      { k:'许可', v:'PDB · CC0' },
      { k:'取回时间', v:'2026-10-03 09:12 UTC' }
    ],
    uniprot:{ chainA:'P69905', chainB:'P68871' },
    sites:{
      'heme-A': { label:'血红素 (链 A)', kind:'heme', chain:'A', resi:87, text:'血红素 b · 原卟啉 IX + Fe²⁺' },
      'heme-B': { label:'血红素 (链 B)', kind:'heme', chain:'B', resi:92, text:'血红素 b · 原卟啉 IX + Fe²⁺' },
      'heme-C': { label:'血红素 (链 C)', kind:'heme', chain:'C', resi:87, text:'血红素 b · 原卟啉 IX + Fe²⁺' },
      'heme-D': { label:'血红素 (链 D)', kind:'heme', chain:'D', resi:92, text:'血红素 b · 原卟啉 IX + Fe²⁺' },
      'his87':  { label:'His87 · F8 近端组氨酸', kind:'residue', chain:'A', resi:87, resn:'HIS', text:'近端配体，第五配位键' },
      'his58':  { label:'His58 · E7 远端组氨酸', kind:'residue', chain:'A', resi:58, resn:'HIS', text:'稳定结合的氧，抑制氧化' },
      'his92':  { label:'His92 · F8 近端组氨酸', kind:'residue', chain:'B', resi:92, resn:'HIS', text:'β 链近端配体' },
      'his63':  { label:'His63 · E7 远端组氨酸', kind:'residue', chain:'B', resi:63, resn:'HIS', text:'β 链远端组氨酸' },
      'his146': { label:'His146 · HC3',          kind:'residue', chain:'B', resi:146, resn:'HIS', text:'波尔效应关键残基' },
      'interface':{ label:'α₁β₂ 界面',            kind:'region',  chain:'A', resi:41, resn:'—',  text:'协同效应的构象传递界面' },
      'cavity': { label:'中央腔 (2,3-BPG 位点)',  kind:'region',  chain:'B', resi:2,  resn:'—',  text:'结合 2,3-BPG，稳定紧张态' }
    }
  },

  '1MBO': {
    id:'1MBO',
    title:'抹香鲸氧合肌红蛋白 · 单链',
    source:'PDB',
    geom:{ kind:'globin', seed:807,
      chains:[ {id:'A', label:'单链', offset:1} ] },
    meta:[
      { k:'来源', v:'RCSB PDB', kind:'ok' },
      { k:'方法', v:'X 射线衍射' },
      { k:'分辨率', v:'1.40 Å' },
      { k:'尺度', v:'纳米 (10⁻⁹ m)' },
      { k:'单位', v:'Å' },
      { k:'许可', v:'PDB · CC0' },
      { k:'取回时间', v:'2026-10-03 09:12 UTC' }
    ],
    uniprot:{ chainA:'P02185' },
    sites:{
      'heme-A': { label:'血红素 (单链)', kind:'heme', chain:'A', resi:93, text:'氧合态 · Fe²⁺–O₂' },
      'his93':  { label:'His93 · F8 近端组氨酸', kind:'residue', chain:'A', resi:93, resn:'HIS', text:'近端配体' },
      'his64':  { label:'His64 · E7 远端组氨酸', kind:'residue', chain:'A', resi:64, resn:'HIS', text:'氢键稳定结合的氧' }
    }
  },

  'AF-P69905': {
    id:'AF-P69905',
    title:'血红蛋白 α 链 · AlphaFold 预测模型',
    source:'AlphaFold',
    geom:{ kind:'globin', seed:4417,
      chains:[ {id:'A', label:'预测单链', offset:0} ] },
    meta:[
      { k:'来源', v:'AlphaFold DB', kind:'pred' },
      { k:'性质', v:'预测结构 · 非实验测定', kind:'pred' },
      { k:'pLDDT', v:'96.4（整体，很可信）', kind:'pred' },
      { k:'尺度', v:'纳米 (10⁻⁹ m)' },
      { k:'单位', v:'Å' },
      { k:'许可', v:'CC-BY 4.0' },
      { k:'取回时间', v:'2026-10-03 09:14 UTC' }
    ],
    uniprot:{ chainA:'P69905' },
    sites:{
      'heme-A': { label:'血红素结合口袋', kind:'region', chain:'A', resi:87, text:'配体未建模，仅预测蛋白部分' },
      'his87':  { label:'His87 · F8',  kind:'residue', chain:'A', resi:87, resn:'HIS', text:'pLDDT 97.1 · 高可信' }
    }
  },

  'mitochondrion': {
    id:'mitochondrion',
    title:'线粒体 · 程序化教学示意',
    source:'示意',
    geom:{ kind:'organelle', seed:33 },
    declare:'示意模型 · 非真实结构',
    declareRef:'FR-ORG-002',
    meta:[
      { k:'来源', v:'程序化生成', kind:'warn' },
      { k:'性质', v:'教学示意 · 非实测结构', kind:'warn' },
      { k:'尺度', v:'示意尺度（未按真实比例）', kind:'warn' },
      { k:'依据', v:'教科书级结构描述' }
    ],
    sites:{
      'outer':   { label:'外膜',        kind:'region', text:'平滑的脂双层，含孔蛋白' },
      'inner':   { label:'内膜',        kind:'region', text:'通透性屏障，电子传递链所在' },
      'cristae': { label:'嵴',          kind:'region', text:'内膜内折，放大膜面积' },
      'matrix':  { label:'基质',        kind:'region', text:'三羧酸循环酶系所在' },
      'mtdna':   { label:'线粒体 DNA',  kind:'region', text:'环状基因组 · 拟核' }
    }
  },

  'catalysis': {
    id:'catalysis',
    title:'酶催化循环 · 分步教学示意',
    source:'示意',
    geom:{ kind:'process', seed:9 },
    declare:'教学示意 · 非动力学模拟',
    declareRef:'FR-PROC-003',
    meta:[
      { k:'来源', v:'教学动画脚本', kind:'warn' },
      { k:'性质', v:'示意 · 不含动力学参数', kind:'warn' },
      { k:'步骤', v:'4 步' },
      { k:'依据', v:'教科书级机制描述' }
    ],
    sites:{
      'site':    { label:'活性位点', kind:'region', text:'催化基团所在的凹槽' },
      'substrate':{ label:'底物',    kind:'region', text:'被转化的分子' },
      'product': { label:'产物',     kind:'region', text:'转化后的分子' }
    }
  }
};

/* ── 证据条目 ──────────────────────────────────────────────────── */
/* verified:false ⇒ UI 显示"演示数据 · 未校验"；真实环境由后端巡检替换 */
const SRC = {
  pdb1hho: { id:'s_pdb_1hho', type:'PDB', ref:'1HHO',
    title:'Fermi 等，人脱氧血红蛋白晶体结构（1.74 Å）',
    locator:'坐标文件全量 · 链 A–D',
    quote:'四条链各含一枚血红素；近端组氨酸位于 F 螺旋第 8 位。',
    quoteKind:'摘译（演示占位）',
    locatorType:'坐标记录',
    support:'直接支持：结构组成与位点几何',
    lv:'实验证实',
    url:'https://www.rcsb.org/structure/1HHO', proxy:'/go/pdb/1HHO',
    license:'PDB · CC0', retrievedAt:'2026-10-03 09:12 UTC', verified:false },

  pdb1mbo: { id:'s_pdb_1mbo', type:'PDB', ref:'1MBO',
    title:'抹香鲸氧合肌红蛋白晶体结构',
    locator:'坐标文件全量 · 单链',
    quote:'单条珠蛋白链折叠成八段 α 螺旋，中央包埋一枚血红素。',
    quoteKind:'摘译（演示占位）',
    locatorType:'坐标记录',
    support:'直接支持：单亚基组成与折叠',
    lv:'实验证实',
    url:'https://www.rcsb.org/structure/1MBO', proxy:'/go/pdb/1MBO',
    license:'PDB · CC0', retrievedAt:'2026-10-03 09:12 UTC', verified:false },

  up_alpha: { id:'s_up_p69905', type:'UniProt', ref:'P69905',
    title:'HBA_HUMAN · 血红蛋白 α 链（141 aa）',
    locator:'Sequence & variants 章节',
    quote:'成熟 α 链为 141 个残基；F8 组氨酸对应第 87 位。',
    quoteKind:'摘译（演示占位）',
    locatorType:'条目章节',
    support:'支持：序列长度与位点编号对齐',
    lv:'实验证实',
    url:'https://www.uniprot.org/uniprotkb/P69905/entry', proxy:'/go/uniprot/P69905',
    license:'UniProt · CC-BY 4.0', retrievedAt:'2026-10-03 09:13 UTC', verified:false },

  up_beta: { id:'s_up_p68871', type:'UniProt', ref:'P68871',
    title:'HBB_HUMAN · 血红蛋白 β 链（146 aa）',
    locator:'Sequence & variants 章节',
    quote:'β 链 F8 组氨酸对应第 92 位；C 端 His146 参与波尔效应。',
    quoteKind:'摘译（演示占位）',
    locatorType:'条目章节',
    support:'支持：β 链编号与功能位点',
    lv:'实验证实',
    url:'https://www.uniprot.org/uniprotkb/P68871/entry', proxy:'/go/uniprot/P68871',
    license:'UniProt · CC-BY 4.0', retrievedAt:'2026-10-03 09:13 UTC', verified:false },

  up_myo: { id:'s_up_p02185', type:'UniProt', ref:'P02185',
    title:'MYG_PHYCD · 抹香鲸肌红蛋白',
    locator:'Sequence 章节',
    quote:'单链珠蛋白，第 93 位组氨酸为近端配体。',
    quoteKind:'摘译（演示占位）',
    locatorType:'条目章节',
    support:'支持：肌红蛋白单链与近端位点',
    lv:'实验证实',
    url:'https://www.uniprot.org/uniprotkb/P02185/entry', proxy:'/go/uniprot/P02185',
    license:'UniProt · CC-BY 4.0', retrievedAt:'2026-10-03 09:13 UTC', verified:false },

  doi_perutz: { id:'s_doi_perutz1970', type:'DOI', ref:'10.1038/228726a0',
    title:'Perutz, Stereochemistry of cooperative effects in haemoglobin, Nature 228:726',
    locator:'pp. 726–730 · 构象传递示意',
    quote:'氧合引起铁原子位移，并沿 F 螺旋与亚基界面传递构象变化，从而解释协同效应。',
    quoteKind:'摘译（演示占位）',
    locatorType:'页码段落',
    support:'机制支持：协同效应的结构解释',
    lv:'领域共识',
    url:'https://doi.org/10.1038/228726a0', proxy:'/go/doi/10.1038/228726a0',
    license:'Nature · 阅读需订阅', retrievedAt:'2026-10-03 09:15 UTC', verified:false },

  doi_review: { id:'s_doi_allostery', type:'DOI', ref:'10.1007/s00232-020-00130-5',
    title:'血红蛋白变构作用综述（演示占位文献）',
    locator:'变构模型章节',
    quote:'两态模型仍是教学主线，但其动力学细节在后续工作中被持续修正。',
    quoteKind:'摘译（演示占位）',
    locatorType:'章节',
    support:'背景支持：模型边界与不确定性',
    lv:'领域共识',
    url:'https://doi.org/10.1007/s00232-020-00130-5', proxy:'/go/doi/10.1007/s00232-020-00130-5',
    license:'Springer · 阅读需订阅', retrievedAt:'2026-10-03 09:15 UTC', verified:false },

  aphafold: { id:'s_af_p69905', type:'DOI', ref:'AF-P69905-F1',
    title:'AlphaFold DB · 血红蛋白 α 链预测模型',
    locator:'模型 v4 · 逐残基 pLDDT',
    quote:'预测模型在珠蛋白核心区置信度很高，但配体与金属离子通常不建模。',
    quoteKind:'摘译（演示占位）',
    locatorType:'模型文件',
    support:'支持：预测性质与不确定性标注',
    lv:'计算预测',
    url:'https://alphafold.ebi.ac.uk/entry/P69905', proxy:'/go/alphafold/P69905',
    license:'CC-BY 4.0', retrievedAt:'2026-10-03 09:14 UTC', verified:false },

  book_mito: { id:'s_mito_text', type:'DOI', ref:'MOOC-MITO-DEMO',
    title:'细胞器结构教学条目（示意依据 · 演示占位）',
    locator:'结构描述段落',
    quote:'线粒体由外膜、内膜与基质组成，内膜内折形成嵴以扩大反应面积。',
    quoteKind:'摘译（演示占位）',
    locatorType:'教学条目',
    support:'支持：示意模型的结构依据',
    lv:'领域共识',
    url:'https://doi.org/10.1000/demo.mitochondrion', proxy:'/go/doi/10.1000/demo.mitochondrion',
    license:'演示条目 · 非真实 DOI', retrievedAt:'2026-10-03 09:20 UTC', verified:false },

  book_enzyme: { id:'s_enzyme_text', type:'DOI', ref:'MOOC-ENZYME-DEMO',
    title:'酶催化机制教学条目（示意依据 · 演示占位）',
    locator:'催化循环段落',
    quote:'酶的活性位点通过结合能稳定过渡态，从而降低反应活化能。',
    quoteKind:'摘译（演示占位）',
    locatorType:'教学条目',
    support:'支持：分步示意与机制描述',
    lv:'领域共识',
    url:'https://doi.org/10.1000/demo.enzyme', proxy:'/go/doi/10.1000/demo.enzyme',
    license:'演示条目 · 非真实 DOI', retrievedAt:'2026-10-03 09:20 UTC', verified:false }
};

/* ── 讲解脚本：每句 = 一条断言（claim） ─────────────────────────── */
/* sites: 该句在 3D 中要点亮的位点；focus: 相机聚焦目标 */
const SCRIPTS = {

  s1: {
    id:'s1', structure:'1HHO', rep:'cartoon', tone:'cache',
    modelRun:{ model:'预生成缓存 · BS-EDU-v1', mode:'cache',
      promptHash:'sha256:9f2c41b7…a71d', params:{ temperature:0.2, top_p:0.9, max_tokens:640 },
      generatedAt:'2026-09-28 04:10 UTC', reviewedBy:'科学复核 · 已通过（演示）' },
    title:'血红蛋白怎么运氧',
    sentences:[
      { claim:'c_1hho_01', lv:'实验证实', text:'血红蛋白是一个 α₂β₂ 四聚体：两条 α 链与两条 β 链各自折叠成珠蛋白螺旋束，每个亚基的中央都嵌着一枚血红素。',
        sites:['heme-A','heme-B','heme-C','heme-D'], focus:'heme-A', rep:'cartoon', ev:[SRC.pdb1hho, SRC.up_alpha] },

      { claim:'c_1hho_02', lv:'实验证实', text:'每个血红素的中心是一枚亚铁离子 Fe²⁺，被四个吡咯氮锁在环心；近端组氨酸 F8 再从下方补上第五个配位键。',
        sites:['heme-A','his87'], focus:'his87', rep:'ball-and-stick', ev:[SRC.pdb1hho, SRC.up_alpha] },

      { claim:'c_1hho_03', lv:'领域共识', text:'第六个配位点留给氧：氧结合时把铁原子拉回环平面，这点小到不足 0.1 纳米的位移会沿 F 螺旋传下去，撬动整个亚基。',
        sites:['his87','heme-A'], focus:'heme-A', rep:'ball-and-stick', ev:[SRC.doi_perutz, SRC.pdb1hho] },

      { claim:'c_1hho_04', lv:'领域共识', text:'一个氧的结合会把其余亚基从紧张态推向松弛态，让它们对氧的亲和力升高——这就是协同效应，也是氧解离曲线呈 S 形的原因。',
        sites:['interface','heme-B','heme-C'], focus:'interface', rep:'cartoon', ev:[SRC.doi_perutz, SRC.doi_review] },

      { claim:'c_1hho_05', lv:'领域共识', text:'于是它能在肺部装满氧、在组织卸下氧；2,3-BPG 与波尔效应再各推一把——后者靠的正是 β 链 C 端的 His146。',
        sites:['cavity','his146'], focus:'cavity', rep:'cartoon', ev:[SRC.up_beta, SRC.doi_review] },

      { claim:'c_1hho_06', lv:'实验证实', text:'看哪里：先看链 A 中央那枚血红素与它正下方的 His87（F8），再整体旋转四聚体——四个血红素的位置，本身就是协同效应的舞台。',
        sites:['heme-A','his87','heme-B','heme-C','heme-D'], focus:'heme-A', rep:'cartoon', ev:[SRC.pdb1hho] }
    ]
  },

  s2: {
    id:'s2', structure:'1HHO', rep:'ball-and-stick', tone:'byok',
    modelRun:{ model:'BYOK · 演示模型 A（能力契约：流式/函数调用/结构化输出）', mode:'byok',
      promptHash:'sha256:41ad9c02…e3b8', params:{ temperature:0.1, top_p:0.9, max_tokens:600 },
      generatedAt:'2026-10-03 09:31 UTC', reviewedBy:'自动校验通过 · 待人工抽检' },
    title:'His F8 突变会怎样',
    sentences:[
      { claim:'c_1hho_m1', lv:'实验证实', text:'你选中的是 α 链第 87 位组氨酸，也就是珠蛋白命名法里的 F8：它是血红素的近端配体。',
        sites:['his87','heme-A'], focus:'his87', ev:[SRC.pdb1hho, SRC.up_alpha] },

      { claim:'c_1hho_m2', lv:'领域共识', text:'把 F8 换成酪氨酸后，铁原子会被额外配位并被稳定成 Fe³⁺，血红素就失去了可逆结合氧的能力——这类变异常被称为 M 型血红蛋白。',
        sites:['his87','heme-A'], focus:'his87', ev:[SRC.up_alpha, SRC.doi_review] },

      { claim:'c_1hho_m3', lv:'领域共识', text:'另一侧的远端 His58（E7）不直接接触铁，却负责稳住结合的氧、抑制氧化；它被替换同样会推向高铁血红蛋白。',
        sites:['his58','heme-A'], focus:'his58', ev:[SRC.up_alpha, SRC.doi_perutz] },

      { claim:'c_1hho_m4', lv:'领域共识', text:'因此这两个位点的替换都会破坏"亚铁—氧"的可逆平衡，表现为氧亲和力下降与发绀；具体临床判断需要专业检查，教材层面只到机制为止。',
        sites:['heme-A'], focus:'heme-A', ev:[SRC.doi_review, SRC.up_alpha] },

      { claim:'c_1hho_m5', lv:'计算预测', text:'看哪里：切成球棍表示，量一量 His87 咪唑环与铁之间的轴向距离——预测模型给出的数值与实验结构存在零点几埃的差异。',
        sites:['his87'], focus:'his87', rep:'ball-and-stick', ev:[SRC.aphafold] }
    ]
  },

  s3: {
    id:'s3', structure:'1HHO', compare:'1MBO', rep:'cartoon', tone:'cache',
    modelRun:{ model:'预生成缓存 · BS-EDU-v1', mode:'cache',
      promptHash:'sha256:77b1e5aa…c204', params:{ temperature:0.2, top_p:0.9, max_tokens:620 },
      generatedAt:'2026-09-28 04:12 UTC', reviewedBy:'科学复核 · 已通过（演示）' },
    title:'血红蛋白 vs 肌红蛋白',
    sentences:[
      { claim:'c_cmp_01', lv:'实验证实', text:'肌红蛋白只有一条链、一枚血红素，是单亚基的储氧蛋白；血红蛋白是 α₂β₂ 四聚体，因此才拿到了协同效应这件新能力。',
        sites:['heme-A'], focus:'heme-A', ev:[SRC.pdb1mbo, SRC.pdb1hho] },

      { claim:'c_cmp_02', lv:'领域共识', text:'两者的珠蛋白折叠几乎同源：都是八段 α 螺旋围出一个疏水口袋——这是"结构保守、功能分化"最经典的教科书例子。',
        sites:['heme-A'], focus:'heme-A', rep:'cartoon', ev:[SRC.up_myo, SRC.up_alpha] },

      { claim:'c_cmp_03', lv:'实验证实', text:'看哪里：打开相机联动旋转，把 1MBO 的单链与 1HHO 的链 A 对着看——螺旋束几乎可以重叠，差别落在界面与构象转换能力上。',
        sites:['his87','heme-A'], focus:'his87', ev:[SRC.pdb1mbo, SRC.pdb1hho] }
    ]
  },

  s4: {
    id:'s4', structure:'mitochondrion', rep:'schematic', tone:'cache',
    modelRun:{ model:'预生成缓存 · BS-EDU-v1（示意内容）', mode:'cache',
      promptHash:'sha256:2c9de110…9f31', params:{ temperature:0.2, top_p:0.9, max_tokens:560 },
      generatedAt:'2026-09-28 04:20 UTC', reviewedBy:'科学复核 · 已通过（演示）' },
    title:'线粒体长什么样',
    sentences:[
      { claim:'c_mito_01', lv:'领域共识', text:'线粒体是双层膜的细胞器：外膜平滑，内膜向基质一侧反复内折，形成一层层嵴。',
        sites:['outer','inner'], focus:'inner', ev:[SRC.book_mito] },

      { claim:'c_mito_02', lv:'领域共识', text:'内折把内膜面积放大了数倍，为电子传递链复合体与 ATP 合酶提供排布空间——面积就是产能的物理前提。',
        sites:['cristae'], focus:'cristae', ev:[SRC.book_mito] },

      { claim:'c_mito_03', lv:'领域共识', text:'内膜两侧的质子梯度驱动 ATP 合酶旋转催化，这就是化学渗透偶联：先把能量存成梯度，再兑换成 ATP。',
        sites:['inner','cristae'], focus:'cristae', ev:[SRC.book_mito] },

      { claim:'c_mito_04', lv:'领域共识', text:'基质里装着三羧酸循环的酶系，还有一小圈属于自己的环状 DNA（拟核），这也是线粒体被看作内共生后代的理由之一。',
        sites:['matrix','mtdna'], focus:'mtdna', ev:[SRC.book_mito] },

      { claim:'c_mito_05', lv:'领域共识', text:'看哪里：点亮"内膜/嵴"，注意嵴把膜空间切成了许多相邻腔室——膜面积、腔室数量与产能效率在这里是同一件事。',
        sites:['cristae','inner'], focus:'cristae', ev:[SRC.book_mito] }
    ]
  },

  proc: {
    id:'proc', structure:'catalysis', rep:'schematic', tone:'cache',
    modelRun:{ model:'预生成缓存 · BS-EDU-v1（示意内容）', mode:'cache',
      promptHash:'sha256:5be07a3c…77aa', params:{ temperature:0.2, top_p:0.9, max_tokens:520 },
      generatedAt:'2026-09-28 04:24 UTC', reviewedBy:'科学复核 · 已通过（演示）' },
    title:'酶催化循环 · 分步',
    steps:[
      { n:0, name:'游离', claim:'c_enz_01', lv:'领域共识',
        text:'底物在溶液里随机碰撞酶的表面——绝大多数碰撞什么也不会发生，因为跨越活化能垒需要一次"刚刚好"的接触。',
        sites:['site','substrate'], ev:[SRC.book_enzyme] },
      { n:1, name:'结合', claim:'c_enz_02', lv:'领域共识',
        text:'底物落进活性位点，被几个残基的侧链用氢键和疏水作用固定住；这一步释放的结合能，正是后面降低能垒的本钱。',
        sites:['site','substrate'], ev:[SRC.book_enzyme] },
      { n:2, name:'转化', claim:'c_enz_03', lv:'领域共识',
        text:'催化基团给出或接受质子，化学键被重排；过渡态被优先稳定，于是反应走了一条低得多的路径。',
        sites:['site','substrate'], ev:[SRC.book_enzyme] },
      { n:3, name:'释放', claim:'c_enz_04', lv:'领域共识',
        text:'产物离开活性位点，酶恢复原状，可以立刻进入下一轮循环——这就是酶以极低用量反复催化的原因。',
        sites:['site','product'], ev:[SRC.book_enzyme] }
    ]
  }
};

/* ── 消歧候选（FR-CHAT-002） ───────────────────────────────────── */
const CANDIDATES = {
  hemoglobin:[
    { id:'1HHO',      name:'人脱氧血红蛋白',        src:'PDB · α₂β₂ 四聚体' },
    { id:'AF-P69905', name:'血红蛋白 α 链（预测）', src:'AlphaFold · pLDDT 96.4' },
    { id:'1MBO',      name:'肌红蛋白（抹香鲸）',    src:'PDB · 单链' }
  ],
  myoglobin:[
    { id:'1MBO',      name:'抹香鲸氧合肌红蛋白',    src:'PDB · 单链' },
    { id:'AF-P69905', name:'血红蛋白 α 链（预测）', src:'AlphaFold · 近缘折叠' }
  ]
};

/* ── 输入意图（原型用关键词路由，真实环境在服务端做意图解析） ──── */
const INTENTS = [
  { id:'load_1hho',  re:/1hho|血红蛋白|hemoglobin|运氧|载氧|协同|波尔|bohr|bpg|变构/i },
  { id:'mutation',   re:/突变|替换|变异|mutation|换成|点了|这个位点/i },
  { id:'compare',    re:/对比|比呢|比较|并排|肌红蛋白|1mbo|myoglobin/i },
  { id:'organelle',  re:/线粒体|细胞器|mitochond|内膜|嵴|基质|细胞核|高尔基|内质网|溶酶体|核糖体|叶绿体/i },
  { id:'process',    re:/酶|催化|过程|步骤|动画|循环|atp|复制|转录|翻译|信号/i },
  { id:'predict',    re:/alphafold|预测结构|plddt|预测模型|af-/i },
  { id:'evidence',   re:/证据|来源|出处|引用|文献|pmid|doi|怎么知道/i },
  { id:'save',       re:/保存|存档|记录会话/i },
  { id:'restore',    re:/恢复|打开会话|继续上次/i },
  { id:'focus',      re:/his\s?\d+|组氨酸|残基\s?\d+|第\s?\d+\s?位/i },
  { id:'dualuse',    re:/增强致病|致病性增强|设计引物|合成基因|改造病毒|毒性增强|逃逸疫苗|气溶胶/i },
  { id:'unsupported',re:/存活率|预后|该用什么药|剂量|临床诊断/i }
];

/* ── 安全策略命中演示（SAFE-001 / SAFE-002） ───────────────────── */
const SAFETY = {
  denyTitle:'请求已进入受控流程',
  denyBody:'输入筛查命中双重用途关键词。按设计，最终安全判定只在后端执行，前端不参与放行；本次请求不会被模型处理。',
  trace:[
    'safety.gateway · 输入筛查 · 命中',
    'policy.decision · REFUSE_CONTROLLED_PATH',
    'audit.log · 已留痕（不可由普通用户删除）',
    'human.review · 已入复核队列（SAFE-003）'
  ]
};