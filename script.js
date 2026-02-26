/* ===================================================
   PDFMagic – Full Tool Suite
   Tools: merge, split, compress, rotate, watermark,
          pagenumber, reorder, deletepage
=================================================== */

/* ---- TOOL DEFINITIONS ---- */
const TOOLS = {
  merge: {
    title: 'Merge PDF',
    desc: 'Combine multiple PDFs into one file',
    emoji: '🔗',
    color: 'linear-gradient(135deg,#ff5722,#ff9800)',
    multi: true,
  },
  split: {
    title: 'Split PDF',
    desc: 'Split a PDF into multiple files',
    emoji: '✂️',
    color: 'linear-gradient(135deg,#9c27b0,#673ab7)',
    multi: false,
  },
  compress: {
    title: 'Compress PDF',
    desc: 'Reduce PDF file size',
    emoji: '🗜️',
    color: 'linear-gradient(135deg,#0097a7,#00bcd4)',
    multi: false,
  },
  rotate: {
    title: 'Rotate PDF',
    desc: 'Rotate pages to the correct orientation',
    emoji: '🔄',
    color: 'linear-gradient(135deg,#2e7d32,#4caf50)',
    multi: false,
  },
  watermark: {
    title: 'Watermark PDF',
    desc: 'Add text watermarks to your PDF',
    emoji: '©️',
    color: 'linear-gradient(135deg,#e65100,#f57c00)',
    multi: false,
  },
  pagenumber: {
    title: 'Page Numbers',
    desc: 'Add page numbers to your PDF',
    emoji: '🔢',
    color: 'linear-gradient(135deg,#c2185b,#e91e63)',
    multi: false,
  },
  reorder: {
    title: 'Reorder Pages',
    desc: 'Drag to rearrange PDF pages',
    emoji: '↕️',
    color: 'linear-gradient(135deg,#00695c,#00897b)',
    multi: false,
  },
  deletepage: {
    title: 'Delete Pages',
    desc: 'Remove specific pages from your PDF',
    emoji: '🗑️',
    color: 'linear-gradient(135deg,#b71c1c,#f44336)',
    multi: false,
  },
};

/* ---- STATE ---- */
let currentTool = null;
let loadedFiles = [];   // For merge (array), or single file
let splitPageCount = 0;
let reorderPageOrder = [];
let deleteMarked = new Set();
let rotateAngle = 90;
let rotateScopeAll = true;
let splitMode = 'all';
let dragSrc = null;

/* ---- HELPERS ---- */
function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function showResult(msg, type = 'success') {
  const r = document.getElementById('resultArea');
  r.innerHTML = `<div class="result-box ${type}">${msg}</div>`;
}

function clearResult() {
  const r = document.getElementById('resultArea');
  if (r) r.innerHTML = '';
}

function download(bytes, filename, mime = 'application/pdf') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function downloadZip(entries) {
  const zip = new JSZip();
  entries.forEach(e => zip.file(e.name, e.bytes));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pdfmagic_output.zip'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* ---- NAVIGATION ---- */
function showHome() {
  document.getElementById('homePage').classList.remove('hidden');
  document.getElementById('toolPage').classList.add('hidden');
  currentTool = null;
  loadedFiles = [];
}

function openTool(toolKey) {
  currentTool = toolKey;
  loadedFiles = [];
  splitPageCount = 0;
  reorderPageOrder = [];
  deleteMarked = new Set();
  clearResult();

  const t = TOOLS[toolKey];
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('toolPage').classList.remove('hidden');

  // Top bar
  const icon = document.getElementById('ttIcon');
  icon.textContent = t.emoji;
  icon.style.background = t.color;
  document.getElementById('ttTitle').textContent = t.title;
  document.getElementById('ttDesc').textContent = t.desc;

  // Drop zone
  const dz = document.getElementById('dropzone');
  dz.style.display = '';
  document.getElementById('workArea').style.display = 'none';
  document.getElementById('dzEmoji').textContent = t.emoji;
  document.getElementById('dzTitle').textContent = t.multi
    ? 'Drop your PDF files here'
    : 'Drop your PDF here';

  const fi = document.getElementById('fileInput');
  fi.multiple = t.multi;
  fi.value = '';
  document.getElementById('workCard').innerHTML = '';
  document.getElementById('resultArea').innerHTML = '';

  setupDropZone();
}

/* ---- DROP ZONE ---- */
function setupDropZone() {
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('fileInput');

  dz.onclick = () => fi.click();
  document.getElementById('dzBrowse').onclick = (e) => { e.stopPropagation(); fi.click(); };

  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = (e) => {
    e.preventDefault(); dz.classList.remove('over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length) handleFiles(files);
  };
  fi.onchange = () => { if (fi.files.length) handleFiles(Array.from(fi.files)); };
}

function handleFiles(files) {
  const t = TOOLS[currentTool];
  if (t.multi) {
    files.forEach(f => {
      if (!loadedFiles.find(x => x.name === f.name && x.size === f.size))
        loadedFiles.push(f);
    });
  } else {
    loadedFiles = [files[0]];
  }

  document.getElementById('dropzone').style.display = 'none';
  document.getElementById('workArea').style.display = 'block';
  clearResult();
  renderWorkCard();
}

/* ---- RENDER WORK CARD ---- */
function renderWorkCard() {
  const card = document.getElementById('workCard');
  card.innerHTML = '';

  switch (currentTool) {
    case 'merge': renderMerge(card); break;
    case 'split': renderSplit(card); break;
    case 'compress': renderCompress(card); break;
    case 'rotate': renderRotate(card); break;
    case 'watermark': renderWatermark(card); break;
    case 'pagenumber': renderPageNumber(card); break;
    case 'reorder': renderReorder(card); break;
    case 'deletepage': renderDeletePage(card); break;
  }
}

/* ===================================================
   MERGE
=================================================== */
function renderMerge(card) {
  card.innerHTML = `
    <div class="work-card-header">
      <h3>Files to Merge <span id="mergeCount" style="background:rgba(255,107,53,.2);color:#ff6b35;font-size:13px;padding:2px 10px;border-radius:100px;font-family:var(--font-body)">${loadedFiles.length}</span></h3>
      <div class="add-more-row">
        <button class="btn-add" id="btnAddMore">+ Add More PDFs</button>
        <input type="file" id="addMoreInput" accept=".pdf" multiple hidden/>
      </div>
    </div>
    <div class="drag-hint">↕ Drag files to reorder before merging</div>
    <div class="file-list" id="mergeList"></div>
    <div class="work-actions">
      <button class="btn-secondary" id="btnClearMerge">✕ Clear All</button>
      <button class="btn-primary" id="btnMerge">🔗 Merge PDF</button>
    </div>
  `;

  renderMergeList();

  document.getElementById('btnAddMore').onclick = () => document.getElementById('addMoreInput').click();
  document.getElementById('addMoreInput').onchange = (e) => {
    Array.from(e.target.files).forEach(f => {
      if (!loadedFiles.find(x => x.name === f.name && x.size === f.size)) loadedFiles.push(f);
    });
    renderWorkCard();
  };
  document.getElementById('btnClearMerge').onclick = () => {
    loadedFiles = [];
    document.getElementById('dropzone').style.display = '';
    document.getElementById('workArea').style.display = 'none';
    clearResult();
  };
  document.getElementById('btnMerge').onclick = runMerge;
}

function renderMergeList() {
  const list = document.getElementById('mergeList');
  if (!list) return;
  list.innerHTML = '';
  loadedFiles.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'fitem';
    el.draggable = true;
    el.innerHTML = `
      <span class="fitem-handle">⠿</span>
      <span class="fitem-icon">📄</span>
      <div class="fitem-info">
        <div class="fitem-name">${f.name}</div>
        <div class="fitem-size">${fmt(f.size)}</div>
      </div>
      <button class="fitem-del">✕</button>
    `;
    el.querySelector('.fitem-del').onclick = () => {
      loadedFiles.splice(i, 1);
      if (loadedFiles.length === 0) {
        document.getElementById('dropzone').style.display = '';
        document.getElementById('workArea').style.display = 'none';
      } else renderWorkCard();
    };

    // Drag reorder
    el.ondragstart = () => { dragSrc = i; setTimeout(() => el.classList.add('dragging'), 0); };
    el.ondragend = () => el.classList.remove('dragging');
    el.ondragover = (e) => { e.preventDefault(); el.classList.add('over-item'); };
    el.ondragleave = () => el.classList.remove('over-item');
    el.ondrop = (e) => {
      e.preventDefault(); el.classList.remove('over-item');
      if (dragSrc !== null && dragSrc !== i) {
        const moved = loadedFiles.splice(dragSrc, 1)[0];
        loadedFiles.splice(i, 0, moved);
        dragSrc = null;
        renderWorkCard();
      }
    };
    list.appendChild(el);
  });
  const cnt = document.getElementById('mergeCount');
  if (cnt) cnt.textContent = loadedFiles.length;
}

async function runMerge() {
  if (loadedFiles.length < 2) return showResult('❌ Please add at least 2 PDF files.', 'error');
  const btn = document.getElementById('btnMerge');
  btn.disabled = true;
  showResult('⏳ Merging PDFs...', 'loading');
  try {
    const merged = await PDFLib.PDFDocument.create();
    for (let i = 0; i < loadedFiles.length; i++) {
      showResult(`⏳ Processing file ${i + 1} of ${loadedFiles.length}...`, 'loading');
      const ab = await loadedFiles[i].arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(ab);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    showResult('⏳ Saving...', 'loading');
    const bytes = await merged.save();
    download(bytes, 'merged.pdf');
    showResult(`✅ Successfully merged ${loadedFiles.length} files! Download started.`, 'success');
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   SPLIT
=================================================== */
function renderSplit(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header">
      <h3>Split PDF</h3>
      <button class="btn-secondary" id="btnChangeSplit" style="font-size:12px;padding:7px 14px">Change File</button>
    </div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div class="ctrl-group">
      <div class="ctrl-label">Split Mode</div>
      <div class="ctrl-tabs">
        <button class="ctab ${splitMode==='all'?'active':''}" data-m="all">All Pages</button>
        <button class="ctab ${splitMode==='range'?'active':''}" data-m="range">By Range</button>
        <button class="ctab ${splitMode==='every'?'active':''}" data-m="every">Every N Pages</button>
      </div>
    </div>
    <div id="splitModeUI"></div>
    <div class="work-actions">
      <button class="btn-secondary" id="btnClearSplit">✕ Clear</button>
      <button class="btn-primary" id="btnSplit">✂️ Split PDF</button>
    </div>
  `;

  document.getElementById('btnChangeSplit').onclick = () => {
    loadedFiles = [];
    document.getElementById('dropzone').style.display = '';
    document.getElementById('workArea').style.display = 'none';
  };

  document.querySelectorAll('.ctab').forEach(t => {
    t.onclick = () => {
      splitMode = t.dataset.m;
      document.querySelectorAll('.ctab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderSplitModeUI();
    };
  });

  document.getElementById('btnClearSplit').onclick = () => {
    loadedFiles = [];
    document.getElementById('dropzone').style.display = '';
    document.getElementById('workArea').style.display = 'none';
    clearResult();
  };
  document.getElementById('btnSplit').onclick = runSplit;
  renderSplitModeUI();

  // Pre-load page count
  f.arrayBuffer().then(ab => PDFLib.PDFDocument.load(ab)).then(pdf => {
    splitPageCount = pdf.getPageCount();
    document.querySelectorAll('.page-count-note').forEach(el => {
      el.textContent = `This PDF has ${splitPageCount} pages.`;
    });
  });
}

function renderSplitModeUI() {
  const ui = document.getElementById('splitModeUI');
  if (!ui) return;
  if (splitMode === 'all') {
    ui.innerHTML = `<div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:16px 18px;color:var(--muted);font-size:14px;margin-bottom:8px">📄 Each page will become a separate PDF file, downloaded as a ZIP archive. <span class="page-count-note" style="color:#ff6b35"></span></div>`;
  } else if (splitMode === 'range') {
    ui.innerHTML = `
      <div id="rangeRows"></div>
      <button class="btn-add" id="btnAddRange">+ Add Range</button>
      <p class="page-count-note" style="font-size:12px;color:var(--muted);margin-top:8px"></p>
    `;
    addRangeRow();
    document.getElementById('btnAddRange').onclick = addRangeRow;
    if (splitPageCount) document.querySelector('.page-count-note').textContent = `PDF has ${splitPageCount} pages.`;
  } else {
    ui.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:16px 18px">
        <span style="color:var(--muted);font-size:14px">Split every</span>
        <input type="number" id="everyN" value="1" min="1" class="ctrl-input" style="width:80px;text-align:center"/>
        <span style="color:var(--muted);font-size:14px">pages</span>
      </div>
      <p class="page-count-note" style="font-size:12px;color:var(--muted);margin-top:8px"></p>
    `;
    if (splitPageCount) document.querySelector('.page-count-note').textContent = `PDF has ${splitPageCount} pages.`;
    document.getElementById('everyN').oninput = () => {
      if (splitPageCount) {
        const n = parseInt(document.getElementById('everyN').value) || 1;
        const parts = Math.ceil(splitPageCount / n);
        document.querySelector('.page-count-note').textContent = `Will create ${parts} file${parts!==1?'s':''}.`;
      }
    };
  }
}

let rangeRowCount = 0;
function addRangeRow() {
  const rr = document.getElementById('rangeRows');
  if (!rr) return;
  const row = document.createElement('div');
  row.className = 'range-row';
  const id = rangeRowCount++;
  row.innerHTML = `
    <input type="number" placeholder="From" min="1" class="ctrl-input range-from" style="width:90px"/>
    <span style="color:var(--muted)">to</span>
    <input type="number" placeholder="To" min="1" class="ctrl-input range-to" style="width:90px"/>
    <button class="btn-remove">✕</button>
  `;
  row.querySelector('.btn-remove').onclick = () => {
    if (document.querySelectorAll('.range-row').length > 1) row.remove();
  };
  rr.appendChild(row);
}

async function runSplit() {
  const f = loadedFiles[0];
  const btn = document.getElementById('btnSplit');
  btn.disabled = true;
  showResult('⏳ Splitting PDF...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const src = await PDFLib.PDFDocument.load(ab);
    const total = src.getPageCount();
    let segments = [];

    if (splitMode === 'all') {
      for (let i = 0; i < total; i++) segments.push([i]);
    } else if (splitMode === 'every') {
      const n = Math.max(1, parseInt(document.getElementById('everyN').value) || 1);
      for (let i = 0; i < total; i += n) {
        const chunk = [];
        for (let j = i; j < Math.min(i + n, total); j++) chunk.push(j);
        segments.push(chunk);
      }
    } else {
      const rows = document.querySelectorAll('.range-row');
      for (const row of rows) {
        const from = parseInt(row.querySelector('.range-from').value);
        const to = parseInt(row.querySelector('.range-to').value);
        if (isNaN(from) || isNaN(to)) { showResult('❌ Fill all page range fields.', 'error'); btn.disabled = false; return; }
        if (from < 1 || to > total || from > to) { showResult(`❌ Invalid range ${from}–${to}. PDF has ${total} pages.`, 'error'); btn.disabled = false; return; }
        const chunk = [];
        for (let i = from - 1; i <= to - 1; i++) chunk.push(i);
        segments.push(chunk);
      }
    }

    if (segments.length === 1) {
      const pdf = await PDFLib.PDFDocument.create();
      const pages = await pdf.copyPages(src, segments[0]);
      pages.forEach(p => pdf.addPage(p));
      download(await pdf.save(), f.name.replace('.pdf', '_split.pdf'));
      showResult('✅ PDF split! Download started.', 'success');
    } else {
      showResult(`⏳ Packaging ${segments.length} files into ZIP...`, 'loading');
      const entries = [];
      const base = f.name.replace('.pdf', '');
      for (let i = 0; i < segments.length; i++) {
        const pdf = await PDFLib.PDFDocument.create();
        const pages = await pdf.copyPages(src, segments[i]);
        pages.forEach(p => pdf.addPage(p));
        const label = splitMode === 'all'
          ? `${base}_page${segments[i][0] + 1}.pdf`
          : `${base}_part${i + 1}.pdf`;
        entries.push({ name: label, bytes: await pdf.save() });
      }
      await downloadZip(entries);
      showResult(`✅ Split into ${segments.length} files! ZIP downloaded.`, 'success');
    }
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   COMPRESS
=================================================== */
function renderCompress(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header"><h3>Compress PDF</h3></div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div class="ctrl-group">
      <div class="ctrl-label">Compression Level</div>
      <div class="ctrl-tabs">
        <button class="ctab active" data-cl="low">Low (Best Quality)</button>
        <button class="ctab" data-cl="med">Medium</button>
        <button class="ctab" data-cl="high">High (Smallest)</button>
      </div>
    </div>
    <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:14px 18px;color:var(--muted);font-size:13px;margin-bottom:8px">
      ℹ️ Compression removes redundant data in the PDF structure. Results vary by file content.
    </div>
    <div class="work-actions">
      <button class="btn-secondary" onclick="loadedFiles=[];document.getElementById('dropzone').style.display='';document.getElementById('workArea').style.display='none';clearResult()">✕ Clear</button>
      <button class="btn-primary" id="btnCompress">🗜️ Compress PDF</button>
    </div>
  `;
  let level = 'low';
  document.querySelectorAll('[data-cl]').forEach(t => {
    t.onclick = () => {
      level = t.dataset.cl;
      document.querySelectorAll('[data-cl]').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
    };
  });
  document.getElementById('btnCompress').onclick = () => runCompress(level);
}

async function runCompress(level) {
  const f = loadedFiles[0];
  const btn = document.getElementById('btnCompress');
  btn.disabled = true;
  showResult('⏳ Compressing...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const src = await PDFLib.PDFDocument.load(ab, { ignoreEncryption: true });

    // pdf-lib re-serialization compresses by default
    // We apply objectsPerTick tuning based on level
    const opts = {
      useObjectStreams: level !== 'low',
      addDefaultPage: false,
      objectsPerTick: level === 'high' ? 200 : level === 'med' ? 100 : 50,
    };
    const bytes = await src.save(opts);

    const savings = (((f.size - bytes.length) / f.size) * 100).toFixed(1);
    const savingsNum = parseFloat(savings);
    download(bytes, f.name.replace('.pdf', '_compressed.pdf'));
    if (savingsNum > 0) {
      showResult(`✅ Compressed! ${fmt(f.size)} → ${fmt(bytes.length)} (saved ${savings}%). Download started.`, 'success');
    } else {
      showResult(`✅ Download started. (This PDF is already well-optimized — ${fmt(bytes.length)})`, 'success');
    }
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   ROTATE
=================================================== */
function renderRotate(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header"><h3>Rotate PDF</h3></div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div class="ctrl-group">
      <div class="ctrl-label">Rotation Angle</div>
      <div class="rotate-btns">
        <button class="rbtn selected" data-deg="90">↻ 90° Right</button>
        <button class="rbtn" data-deg="180">↔ 180°</button>
        <button class="rbtn" data-deg="270">↺ 90° Left</button>
      </div>
    </div>
    <div class="ctrl-group">
      <div class="ctrl-label">Apply To</div>
      <div class="ctrl-tabs">
        <button class="ctab active" data-scope="all">All Pages</button>
        <button class="ctab" data-scope="range">Page Range</button>
      </div>
    </div>
    <div id="rotateRangeUI"></div>
    <div class="work-actions">
      <button class="btn-secondary" onclick="loadedFiles=[];document.getElementById('dropzone').style.display='';document.getElementById('workArea').style.display='none';clearResult()">✕ Clear</button>
      <button class="btn-primary" id="btnRotate">🔄 Rotate PDF</button>
    </div>
  `;

  rotateAngle = 90; rotateScopeAll = true;

  document.querySelectorAll('[data-deg]').forEach(b => {
    b.onclick = () => {
      rotateAngle = parseInt(b.dataset.deg);
      document.querySelectorAll('[data-deg]').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
    };
  });
  document.querySelectorAll('[data-scope]').forEach(b => {
    b.onclick = () => {
      rotateScopeAll = b.dataset.scope === 'all';
      document.querySelectorAll('[data-scope]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      document.getElementById('rotateRangeUI').innerHTML = rotateScopeAll ? '' :
        `<div style="display:flex;align-items:center;gap:10px;margin-top:8px">
          <input class="ctrl-input" id="rotateFrom" type="number" placeholder="From page" min="1" style="width:130px"/>
          <span style="color:var(--muted)">to</span>
          <input class="ctrl-input" id="rotateTo" type="number" placeholder="To page" min="1" style="width:130px"/>
        </div>`;
    };
  });
  document.getElementById('btnRotate').onclick = runRotate;
}

async function runRotate() {
  const f = loadedFiles[0];
  const btn = document.getElementById('btnRotate');
  btn.disabled = true;
  showResult('⏳ Rotating pages...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(ab);
    const total = pdf.getPageCount();
    let indices = [];

    if (rotateScopeAll) {
      indices = Array.from({ length: total }, (_, i) => i);
    } else {
      const from = parseInt(document.getElementById('rotateFrom').value);
      const to = parseInt(document.getElementById('rotateTo').value);
      if (isNaN(from) || isNaN(to) || from < 1 || to > total || from > to) {
        showResult(`❌ Invalid range. PDF has ${total} pages.`, 'error');
        btn.disabled = false; return;
      }
      for (let i = from - 1; i < to; i++) indices.push(i);
    }

    indices.forEach(i => {
      const page = pdf.getPage(i);
      const current = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((current + rotateAngle) % 360));
    });

    download(await pdf.save(), f.name.replace('.pdf', '_rotated.pdf'));
    showResult(`✅ Rotated ${indices.length} page${indices.length !== 1 ? 's' : ''} by ${rotateAngle}°! Download started.`, 'success');
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   WATERMARK
=================================================== */
function renderWatermark(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header"><h3>Watermark PDF</h3></div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div class="ctrl-group">
      <div class="ctrl-label">Watermark Text</div>
      <input class="ctrl-input" id="wmText" placeholder="e.g. CONFIDENTIAL, DRAFT, © Your Name" value="CONFIDENTIAL"/>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="ctrl-group">
        <div class="ctrl-label">Font Size</div>
        <input class="ctrl-input" id="wmSize" type="number" value="48" min="12" max="120"/>
      </div>
      <div class="ctrl-group">
        <div class="ctrl-label">Opacity (%)</div>
        <input class="ctrl-input" id="wmOpacity" type="number" value="25" min="5" max="100"/>
      </div>
    </div>
    <div class="ctrl-group">
      <div class="ctrl-label">Color</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="rbtn selected" data-wmc="gray">Gray</button>
        <button class="rbtn" data-wmc="red">Red</button>
        <button class="rbtn" data-wmc="blue">Blue</button>
        <button class="rbtn" data-wmc="green">Green</button>
      </div>
    </div>
    <div class="wm-preview" id="wmPreview" style="color:rgba(150,150,150,0.5)">CONFIDENTIAL</div>
    <div class="work-actions">
      <button class="btn-secondary" onclick="loadedFiles=[];document.getElementById('dropzone').style.display='';document.getElementById('workArea').style.display='none';clearResult()">✕ Clear</button>
      <button class="btn-primary" id="btnWatermark">© Add Watermark</button>
    </div>
  `;

  const colors = { gray: [0.6,0.6,0.6], red: [0.8,0.1,0.1], blue: [0.1,0.2,0.8], green: [0.1,0.6,0.2] };
  let wmColor = 'gray';

  function updatePreview() {
    const txt = document.getElementById('wmText').value || 'WATERMARK';
    const op = (parseInt(document.getElementById('wmOpacity').value) || 25) / 100;
    const sz = parseInt(document.getElementById('wmSize').value) || 48;
    const c = colors[wmColor];
    document.getElementById('wmPreview').textContent = txt;
    document.getElementById('wmPreview').style.color = `rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${op})`;
    document.getElementById('wmPreview').style.fontSize = Math.min(sz, 48) + 'px';
  }

  ['wmText','wmSize','wmOpacity'].forEach(id => document.getElementById(id).oninput = updatePreview);

  document.querySelectorAll('[data-wmc]').forEach(b => {
    b.onclick = () => {
      wmColor = b.dataset.wmc;
      document.querySelectorAll('[data-wmc]').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      updatePreview();
    };
  });

  document.getElementById('btnWatermark').onclick = () => runWatermark(colors[wmColor]);
}

async function runWatermark(colorArr) {
  const f = loadedFiles[0];
  const text = document.getElementById('wmText').value.trim() || 'WATERMARK';
  const size = parseInt(document.getElementById('wmSize').value) || 48;
  const opacity = (parseInt(document.getElementById('wmOpacity').value) || 25) / 100;
  const btn = document.getElementById('btnWatermark');
  btn.disabled = true;
  showResult('⏳ Adding watermark...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(ab);
    const font = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const pages = pdf.getPages();
    pages.forEach(page => {
      const { width, height } = page.getSize();
      const tw = font.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: (width - tw) / 2,
        y: height / 2 - size / 2,
        size,
        font,
        color: PDFLib.rgb(colorArr[0], colorArr[1], colorArr[2]),
        opacity,
        rotate: PDFLib.degrees(45),
      });
    });
    download(await pdf.save(), f.name.replace('.pdf', '_watermarked.pdf'));
    showResult(`✅ Watermark added to ${pages.length} page${pages.length!==1?'s':''}! Download started.`, 'success');
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   PAGE NUMBERS
=================================================== */
function renderPageNumber(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header"><h3>Add Page Numbers</h3></div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="ctrl-group">
        <div class="ctrl-label">Position</div>
        <select class="ctrl-select" id="pnPos">
          <option value="bottom-center">Bottom Center</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-center">Top Center</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>
      <div class="ctrl-group">
        <div class="ctrl-label">Start From</div>
        <input class="ctrl-input" id="pnStart" type="number" value="1" min="1"/>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="ctrl-group">
        <div class="ctrl-label">Font Size</div>
        <input class="ctrl-input" id="pnSize" type="number" value="12" min="8" max="32"/>
      </div>
      <div class="ctrl-group">
        <div class="ctrl-label">Format</div>
        <select class="ctrl-select" id="pnFormat">
          <option value="n">1, 2, 3...</option>
          <option value="page-n">Page 1, Page 2...</option>
          <option value="n-of-t">1 of 10...</option>
        </select>
      </div>
    </div>
    <div class="work-actions">
      <button class="btn-secondary" onclick="loadedFiles=[];document.getElementById('dropzone').style.display='';document.getElementById('workArea').style.display='none';clearResult()">✕ Clear</button>
      <button class="btn-primary" id="btnPageNum">🔢 Add Page Numbers</button>
    </div>
  `;
  document.getElementById('btnPageNum').onclick = runPageNumber;
}

async function runPageNumber() {
  const f = loadedFiles[0];
  const pos = document.getElementById('pnPos').value;
  const start = parseInt(document.getElementById('pnStart').value) || 1;
  const size = parseInt(document.getElementById('pnSize').value) || 12;
  const format = document.getElementById('pnFormat').value;
  const btn = document.getElementById('btnPageNum');
  btn.disabled = true;
  showResult('⏳ Adding page numbers...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(ab);
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const total = pages.length;

    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const num = start + i;
      let label;
      if (format === 'page-n') label = `Page ${num}`;
      else if (format === 'n-of-t') label = `${num} of ${total + start - 1}`;
      else label = `${num}`;

      const tw = font.widthOfTextAtSize(label, size);
      const margin = 24;
      let x, y;

      const isBottom = pos.startsWith('bottom');
      y = isBottom ? margin : height - margin - size;
      if (pos.includes('center')) x = (width - tw) / 2;
      else if (pos.includes('right')) x = width - tw - margin;
      else x = margin;

      page.drawText(label, { x, y, size, font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    });

    download(await pdf.save(), f.name.replace('.pdf', '_numbered.pdf'));
    showResult(`✅ Page numbers added to ${total} pages! Download started.`, 'success');
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   REORDER PAGES
=================================================== */
function renderReorder(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header"><h3>Reorder Pages</h3></div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div class="drag-hint">↕ Drag pages to reorder them</div>
    <div class="page-grid" id="pageGrid">
      <div style="color:var(--muted);font-size:13px">Loading pages...</div>
    </div>
    <div class="work-actions">
      <button class="btn-secondary" onclick="loadedFiles=[];document.getElementById('dropzone').style.display='';document.getElementById('workArea').style.display='none';clearResult()">✕ Clear</button>
      <button class="btn-primary" id="btnReorder">↕ Save New Order</button>
    </div>
  `;
  document.getElementById('btnReorder').onclick = runReorder;

  f.arrayBuffer().then(ab => PDFLib.PDFDocument.load(ab)).then(pdf => {
    const total = pdf.getPageCount();
    reorderPageOrder = Array.from({ length: total }, (_, i) => i);
    renderPageGrid(total);
  });
}

function renderPageGrid(total) {
  const grid = document.getElementById('pageGrid');
  if (!grid) return;
  grid.innerHTML = '';
  reorderPageOrder.forEach((originalIdx, pos) => {
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb';
    thumb.draggable = true;
    thumb.dataset.pos = pos;
    thumb.innerHTML = `
      <div class="page-preview">📄</div>
      <div class="page-num">Page ${originalIdx + 1}</div>
    `;
    let dragPos = null;
    thumb.ondragstart = () => { dragPos = pos; setTimeout(() => thumb.classList.add('dragging'), 0); };
    thumb.ondragend = () => thumb.classList.remove('dragging');
    thumb.ondragover = (e) => { e.preventDefault(); thumb.classList.add('over-page'); };
    thumb.ondragleave = () => thumb.classList.remove('over-page');
    thumb.ondrop = (e) => {
      e.preventDefault(); thumb.classList.remove('over-page');
      if (dragPos !== null && dragPos !== pos) {
        const moved = reorderPageOrder.splice(dragPos, 1)[0];
        reorderPageOrder.splice(pos, 0, moved);
        dragPos = null;
        renderPageGrid(total);
      }
    };
    grid.appendChild(thumb);
  });
}

async function runReorder() {
  const f = loadedFiles[0];
  const btn = document.getElementById('btnReorder');
  btn.disabled = true;
  showResult('⏳ Reordering pages...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const src = await PDFLib.PDFDocument.load(ab);
    const out = await PDFLib.PDFDocument.create();
    const pages = await out.copyPages(src, reorderPageOrder);
    pages.forEach(p => out.addPage(p));
    download(await out.save(), f.name.replace('.pdf', '_reordered.pdf'));
    showResult(`✅ Pages reordered! Download started.`, 'success');
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}

/* ===================================================
   DELETE PAGES
=================================================== */
function renderDeletePage(card) {
  const f = loadedFiles[0];
  card.innerHTML = `
    <div class="work-card-header"><h3>Delete Pages</h3></div>
    <div class="file-pill">
      <span class="file-pill-icon">📄</span>
      <span class="file-pill-name">${f.name}</span>
      <span class="file-pill-size">${fmt(f.size)}</span>
    </div>
    <div class="drag-hint">Click pages to mark for deletion (shown in red)</div>
    <div class="delete-grid" id="deleteGrid">
      <div style="color:var(--muted);font-size:13px">Loading pages...</div>
    </div>
    <div id="delCount" style="font-size:13px;color:var(--muted);margin-top:8px;text-align:center"></div>
    <div class="work-actions">
      <button class="btn-secondary" onclick="loadedFiles=[];document.getElementById('dropzone').style.display='';document.getElementById('workArea').style.display='none';clearResult()">✕ Clear</button>
      <button class="btn-primary" id="btnDelete">🗑️ Delete Marked Pages</button>
    </div>
  `;
  document.getElementById('btnDelete').onclick = runDeletePages;

  f.arrayBuffer().then(ab => PDFLib.PDFDocument.load(ab)).then(pdf => {
    const total = pdf.getPageCount();
    renderDeleteGrid(total);
  });
}

function renderDeleteGrid(total) {
  const grid = document.getElementById('deleteGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const el = document.createElement('div');
    el.className = 'del-page' + (deleteMarked.has(i) ? ' marked' : '');
    el.innerHTML = `<div class="del-icon">📄</div><div class="del-num">Page ${i + 1}</div>`;
    el.onclick = () => {
      if (deleteMarked.has(i)) deleteMarked.delete(i);
      else deleteMarked.add(i);
      el.classList.toggle('marked');
      document.getElementById('delCount').textContent =
        deleteMarked.size > 0 ? `${deleteMarked.size} page${deleteMarked.size!==1?'s':''} marked for deletion` : '';
    };
    grid.appendChild(el);
  }
}

async function runDeletePages() {
  if (deleteMarked.size === 0) return showResult('❌ No pages marked for deletion.', 'error');
  const f = loadedFiles[0];
  const btn = document.getElementById('btnDelete');
  btn.disabled = true;
  showResult('⏳ Deleting pages...', 'loading');
  try {
    const ab = await f.arrayBuffer();
    const src = await PDFLib.PDFDocument.load(ab);
    const total = src.getPageCount();
    if (deleteMarked.size >= total) { showResult('❌ Cannot delete all pages.', 'error'); btn.disabled = false; return; }
    const keep = Array.from({ length: total }, (_, i) => i).filter(i => !deleteMarked.has(i));
    const out = await PDFLib.PDFDocument.create();
    const pages = await out.copyPages(src, keep);
    pages.forEach(p => out.addPage(p));
    download(await out.save(), f.name.replace('.pdf', '_edited.pdf'));
    showResult(`✅ Deleted ${deleteMarked.size} page${deleteMarked.size!==1?'s':''}! Download started.`, 'success');
  } catch (e) {
    showResult('❌ Error: ' + e.message, 'error');
  }
  btn.disabled = false;
}
