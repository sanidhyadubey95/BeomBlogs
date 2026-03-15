/**
 * editor.js — Enhanced blog editor
 * New features:
 *   - Speech-to-text (Web Speech API)
 *   - Table block (visual builder)
 *   - Cover image block (optional, with preview)
 *   - Word count & reading time
 *   - Auto-save to localStorage
 *   - Keyboard shortcuts
 *   - Emoji picker
 *   - Tweet/quote block
 */

// ─── State ───────────────────────────────────────────────────────────────────
var blocks        = [];
var blockIdCtr    = 0;
var tags          = [];
var dragSrcType   = null;
var dragSrcId     = null;
var activeTextarea = null;
var currentTab    = 'edit';
var speechActive  = false;
var speechRecog   = null;
var autoSaveTimer = null;

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var today = new Date();
  document.getElementById('meta-date').value =
    today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2,'0') + '-' +
    String(today.getDate()).padStart(2,'0');

  initPalette();
  initDropArea();
  initSpeech();
  initKeyboardShortcuts();
  updateSlug();
  updateWordCount();
  loadAutoSave();

  // Starter block
  addBlock('markdown', 'Write your post here...\n\nUse **bold**, _italic_, `code`, and drag blocks from the left panel to add more content.');
});

// ─── Auto-save ───────────────────────────────────────────────────────────────
function triggerAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(function() {
    try {
      var state = {
        blocks: blocks.map(function(b) { return { id: b.id, type: b.type, data: getBlockData(b.id) }; }),
        meta: {
          title:   document.getElementById('meta-title').value,
          date:    document.getElementById('meta-date').value,
          excerpt: document.getElementById('meta-excerpt').value,
          tags:    tags,
          featured: document.getElementById('opt-featured').checked,
          cover:   document.getElementById('cover-url') ? document.getElementById('cover-url').value : ''
        }
      };
      localStorage.setItem('blogEditorDraft', JSON.stringify(state));
      showToast('Draft saved');
    } catch(e) {}
  }, 1500);
}

function loadAutoSave() {
  try {
    var saved = localStorage.getItem('blogEditorDraft');
    if (!saved) return;
    var state = JSON.parse(saved);
    if (!state || !state.blocks || !state.blocks.length) return;

    var banner = document.getElementById('autosave-banner');
    if (banner) banner.style.display = 'flex';

    document.getElementById('restore-btn').addEventListener('click', function() {
      restoreDraft(state);
      banner.style.display = 'none';
    });
    document.getElementById('discard-btn').addEventListener('click', function() {
      localStorage.removeItem('blogEditorDraft');
      banner.style.display = 'none';
    });
  } catch(e) {}
}

function restoreDraft(state) {
  // Clear existing blocks
  blocks = [];
  document.getElementById('drop-area').querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
  document.getElementById('drop-hint').style.display = 'none';

  // Restore metadata
  if (state.meta) {
    document.getElementById('meta-title').value   = state.meta.title   || '';
    document.getElementById('meta-date').value    = state.meta.date    || '';
    document.getElementById('meta-excerpt').value = state.meta.excerpt || '';
    document.getElementById('opt-featured').checked = state.meta.featured || false;
    tags = state.meta.tags || [];
    renderTags();
    updateSlug();
    if (state.meta.cover && document.getElementById('cover-url')) {
      document.getElementById('cover-url').value = state.meta.cover;
      updateCoverPreview();
    }
  }

  // Restore blocks
  state.blocks.forEach(function(b) {
    blockIdCtr = Math.max(blockIdCtr, parseInt(b.id.replace('block-','')) + 1);
    addBlock(b.type, b.data);
  });
  showToast('Draft restored!');
}

// ─── Toast notifications ──────────────────────────────────────────────────────
function showToast(msg, duration) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function(){ toast.classList.remove('show'); }, duration || 2000);
}

// ─── Word count ───────────────────────────────────────────────────────────────
function updateWordCount() {
  var md    = buildMarkdown();
  var words = md.replace(/[#*_`>\[\]!]/g, '').trim().split(/\s+/).filter(Boolean).length;
  var mins  = Math.max(1, Math.round(words / 200));
  var el    = document.getElementById('word-count');
  if (el) el.textContent = words + ' words · ' + mins + ' min read';
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey)) {
      if (e.key === 'b') { e.preventDefault(); wrapActive('**','**'); }
      if (e.key === 'i') { e.preventDefault(); wrapActive('_','_'); }
      if (e.key === 'k') { e.preventDefault(); insertLinkActive(); }
      if (e.key === 's') { e.preventDefault(); triggerAutoSave(); showToast('Saved!'); }
      if (e.key === 'Enter') { e.preventDefault(); generateFiles(); }
    }
  });
}

// ─── Slug ─────────────────────────────────────────────────────────────────────
function updateSlug() {
  var title = document.getElementById('meta-title').value;
  var slug  = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-') || 'my-post';
  document.getElementById('slug-display').textContent = slug;
  return slug;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────
function handleTagInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    var val = e.target.value.replace(/,/g,'').trim();
    if (val && !tags.includes(val)) { tags.push(val); renderTags(); }
    e.target.value = '';
  } else if (e.key === 'Backspace' && e.target.value === '' && tags.length) {
    tags.pop(); renderTags();
  }
}
function renderTags() {
  var wrap  = document.getElementById('tags-wrap');
  var input = document.getElementById('tag-input');
  wrap.querySelectorAll('.tag-chip').forEach(function(c){ c.remove(); });
  tags.forEach(function(tag, i) {
    var chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = tag + '<button class="tag-chip-remove" onclick="removeTag('+i+')">x</button>';
    wrap.insertBefore(chip, input);
  });
}
function removeTag(i) { tags.splice(i,1); renderTags(); }

// ─── Cover image ──────────────────────────────────────────────────────────────
function updateCoverPreview() {
  var url  = document.getElementById('cover-url').value.trim();
  var prev = document.getElementById('cover-preview');
  if (!prev) return;
  if (url) {
    prev.innerHTML = '<img src="'+url+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:4px;border:1px solid var(--border);">';
  } else {
    prev.innerHTML = '';
  }
}

// ─── Speech to Text ───────────────────────────────────────────────────────────
function initSpeech() {
  var btn = document.getElementById('speech-btn');
  if (!btn) return;

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btn.title = 'Speech recognition not supported in this browser';
    btn.style.opacity = '0.4';
    btn.style.cursor  = 'not-allowed';
    return;
  }

  speechRecog = new SpeechRecognition();
  speechRecog.continuous     = true;
  speechRecog.interimResults = true;
  speechRecog.lang           = 'en-US';

  var interimSpan = null;

  speechRecog.onresult = function(e) {
    var ta = activeTextarea;
    if (!ta || ta.tagName !== 'TEXTAREA') {
      // Find first markdown textarea
      var mds = document.querySelectorAll('.markdown-editor');
      if (mds.length) ta = mds[mds.length - 1];
    }
    if (!ta) return;

    var interim = '';
    var finalText = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        finalText += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    if (finalText) {
      // Remove interim placeholder and insert final
      if (interimSpan) { interimSpan = null; }
      var pos = ta.selectionStart;
      ta.value = ta.value.substring(0, pos) + finalText + ' ' + ta.value.substring(pos);
      ta.selectionStart = ta.selectionEnd = pos + finalText.length + 1;
      ta.dispatchEvent(new Event('input'));
    }
    // Show interim in status
    var status = document.getElementById('speech-status');
    if (status) status.textContent = interim ? '🎤 ' + interim : (speechActive ? '🎤 Listening...' : '');
  };

  speechRecog.onerror = function(e) {
    showToast('Speech error: ' + e.error);
    stopSpeech();
  };

  speechRecog.onend = function() {
    if (speechActive) speechRecog.start(); // keep going if still active
  };

  btn.addEventListener('click', function() {
    if (speechActive) stopSpeech();
    else startSpeech();
  });
}

function startSpeech() {
  if (!speechRecog) return;
  speechActive = true;
  speechRecog.start();
  var btn = document.getElementById('speech-btn');
  btn.classList.add('recording');
  btn.textContent = '⏹ Stop';
  document.getElementById('speech-status').textContent = '🎤 Listening...';
  showToast('Listening... speak now');
}

function stopSpeech() {
  speechActive = false;
  if (speechRecog) speechRecog.stop();
  var btn = document.getElementById('speech-btn');
  btn.classList.remove('recording');
  btn.textContent = '🎤 Speak';
  document.getElementById('speech-status').textContent = '';
}

// ─── Palette ──────────────────────────────────────────────────────────────────
function initPalette() {
  document.querySelectorAll('.block-btn').forEach(function(btn) {
    btn.addEventListener('dragstart', function(e) {
      dragSrcType = btn.dataset.type;
      dragSrcId   = null;
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    btn.addEventListener('dragend', function() { btn.classList.remove('dragging'); });
    btn.addEventListener('click', function() {
      addBlock(btn.dataset.type);
      document.getElementById('drop-area').scrollTop = 99999;
    });
  });
}

// ─── Drop area ────────────────────────────────────────────────────────────────
function initDropArea() {
  var area = document.getElementById('drop-area');
  area.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    area.classList.add('drag-over');
  });
  area.addEventListener('dragleave', function(e) {
    if (!area.contains(e.relatedTarget)) area.classList.remove('drag-over');
  });
  area.addEventListener('drop', function(e) {
    e.preventDefault();
    area.classList.remove('drag-over');
    if (dragSrcType && !dragSrcId) addBlock(dragSrcType);
    dragSrcType = null;
  });
}

// ─── Block management ─────────────────────────────────────────────────────────
function addBlock(type, defaultData) {
  var id   = 'block-' + (blockIdCtr++);
  var data = (defaultData !== undefined) ? defaultData : getDefaultData(type);
  blocks.push({ id: id, type: type, data: data });

  var hint = document.getElementById('drop-hint');
  if (hint) hint.style.display = 'none';

  var el = createBlockEl(id, type, data);
  document.getElementById('drop-area').appendChild(el);

  var ta = el.querySelector('textarea, input[type="text"], input:not([type])');
  if (ta) { ta.focus(); if (ta.tagName === 'TEXTAREA') ta.select(); }

  refreshPreview();
  updateWordCount();
  triggerAutoSave();
  return id;
}

function getDefaultData(type) {
  var defaults = {
    markdown:  '## New Section\n\nWrite your content here...',
    heading:   'Section Title',
    math:      'E = mc^2',
    code:      '// Your code here\nconsole.log("Hello, world!");',
    viz:       '',
    image:     '',
    callout:   'Important note: add your callout text here.',
    divider:   '',
    table:     JSON.stringify({ rows: 3, cols: 3, headers: ['Column 1','Column 2','Column 3'], cells: [['','',''],['','','']] }),
    tweet:     '',
    toc:       ''
  };
  return defaults[type] || '';
}

function removeBlock(id) {
  blocks = blocks.filter(function(b){ return b.id !== id; });
  var el = document.getElementById(id);
  if (el) el.remove();
  if (!blocks.length) { var h = document.getElementById('drop-hint'); if(h) h.style.display=''; }
  refreshPreview(); updateWordCount(); triggerAutoSave();
}

function duplicateBlock(id) {
  var b = blocks.find(function(b){ return b.id === id; });
  if (!b) return;
  var data = getBlockData(id);
  var newId = addBlock(b.type, data);
  // Move new block right after current
  var curIdx = blocks.findIndex(function(b){ return b.id === id; });
  var newIdx = blocks.findIndex(function(b){ return b.id === newId; });
  if (curIdx >= 0 && newIdx >= 0) {
    var moved = blocks.splice(newIdx, 1)[0];
    blocks.splice(curIdx + 1, 0, moved);
    reRenderBlockOrder();
  }
  showToast('Block duplicated');
}

function moveBlock(id, dir) {
  var idx = blocks.findIndex(function(b){ return b.id === id; });
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= blocks.length) return;
  var tmp = blocks[idx]; blocks[idx] = blocks[newIdx]; blocks[newIdx] = tmp;
  reRenderBlockOrder();
  refreshPreview();
}

function reRenderBlockOrder() {
  var area = document.getElementById('drop-area');
  area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
  blocks.forEach(function(b) {
    var el = document.getElementById(b.id) || createBlockEl(b.id, b.type, b.data);
    area.appendChild(el);
  });
}

function getBlockData(id) {
  var b = blocks.find(function(b){ return b.id === id; });
  if (!b) return '';
  var el = document.getElementById(id);
  if (!el) return b.data;

  if (b.type === 'markdown') {
    var ta = el.querySelector('.markdown-editor'); return ta ? ta.value : b.data;
  } else if (b.type === 'heading') {
    var sel = el.querySelector('.heading-level'); var inp = el.querySelector('.heading-editor');
    return JSON.stringify({ level: sel ? sel.value : '2', text: inp ? inp.value : b.data });
  } else if (b.type === 'math') {
    var ta = el.querySelector('.math-editor'); return ta ? ta.value : b.data;
  } else if (b.type === 'code') {
    var ta = el.querySelector('.code-editor'); var sel = el.querySelector('.code-lang-select');
    return JSON.stringify({ lang: sel ? sel.value : 'javascript', code: ta ? ta.value : '' });
  } else if (b.type === 'viz') {
    var inp = el.querySelector('.viz-filename-input'); return inp ? inp.value : b.data;
  } else if (b.type === 'image') {
    var url = el.querySelector('.image-url-input'); var alt = el.querySelector('.image-alt-input');
    var cap = el.querySelector('.image-caption-input');
    return JSON.stringify({ url: url?url.value:'', alt: alt?alt.value:'', caption: cap?cap.value:'' });
  } else if (b.type === 'callout') {
    var ta = el.querySelector('.callout-textarea'); var sel = el.querySelector('.callout-type');
    return JSON.stringify({ type: sel?sel.value:'info', text: ta?ta.value:'' });
  } else if (b.type === 'divider') {
    return '';
  } else if (b.type === 'table') {
    return collectTableData(id);
  } else if (b.type === 'tweet') {
    var ta = el.querySelector('.tweet-textarea'); return ta ? ta.value : b.data;
  } else if (b.type === 'toc') {
    return 'toc';
  }
  return b.data;
}

function syncBlockData(id, val) {
  var b = blocks.find(function(b){ return b.id === id; });
  if (b) b.data = val;
}

// ─── Block element creation ───────────────────────────────────────────────────
function createBlockEl(id, type, data) {
  var el = document.createElement('div');
  el.className = 'editor-block';
  el.id = id;
  el.setAttribute('draggable', 'true');

  el.addEventListener('dragstart', function(e) {
    dragSrcId = id; dragSrcType = null;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(function(){ el.style.opacity='0.4'; }, 0);
  });
  el.addEventListener('dragend', function() {
    el.style.opacity='';
    dragSrcId = null;
    document.querySelectorAll('.editor-block').forEach(function(b){ b.classList.remove('drag-target'); });
  });
  el.addEventListener('dragover', function(e) {
    if (!dragSrcId || dragSrcId===id) return;
    e.preventDefault(); el.classList.add('drag-target');
  });
  el.addEventListener('dragleave', function() { el.classList.remove('drag-target'); });
  el.addEventListener('drop', function(e) {
    if (!dragSrcId || dragSrcId===id) return;
    e.preventDefault(); el.classList.remove('drag-target');
    var si = blocks.findIndex(function(b){ return b.id===dragSrcId; });
    var ti = blocks.findIndex(function(b){ return b.id===id; });
    if (si<0||ti<0) return;
    var moved = blocks.splice(si,1)[0];
    blocks.splice(ti>si?ti-1:ti, 0, moved);
    reRenderBlockOrder(); refreshPreview();
  });

  var typeLabels = {
    markdown:'Markdown', heading:'Heading', math:'Math', code:'Code',
    viz:'Visualization', image:'Image', callout:'Callout', divider:'Divider',
    table:'Table', tweet:'Quote / Tweet', toc:'Table of Contents'
  };

  var handle = document.createElement('div');
  handle.className = 'block-handle';
  handle.innerHTML =
    '<div class="block-handle-left">' +
      '<span class="handle-dots" title="Drag to reorder">::</span>' +
      '<span class="block-type-label">'+(typeLabels[type]||type)+'</span>' +
    '</div>' +
    '<div class="block-actions">' +
      '<button class="block-action-btn" title="Move up" onclick="moveBlock(\''+id+'\',-1)">↑</button>' +
      '<button class="block-action-btn" title="Move down" onclick="moveBlock(\''+id+'\',1)">↓</button>' +
      '<button class="block-action-btn" title="Duplicate" onclick="duplicateBlock(\''+id+'\')">⧉</button>' +
      '<button class="block-action-btn danger" title="Delete" onclick="removeBlock(\''+id+'\')">✕</button>' +
    '</div>';
  el.appendChild(handle);

  var content = buildBlockContent(id, type, data);
  el.appendChild(content);
  return el;
}

function buildBlockContent(id, type, data) {
  var wrap = document.createElement('div');

  // ── Markdown ──
  if (type === 'markdown') {
    var ta = document.createElement('textarea');
    ta.className = 'markdown-editor';
    ta.placeholder = 'Write Markdown here... (Ctrl+B bold, Ctrl+I italic, Ctrl+K link)';
    ta.value = data;
    ta.addEventListener('input', function(){ autoResize(ta); syncBlockData(id,ta.value); refreshPreview(); updateWordCount(); triggerAutoSave(); });
    ta.addEventListener('focus', function(){ activeTextarea=ta; });
    autoResize(ta);
    wrap.appendChild(ta);

  // ── Heading ──
  } else if (type === 'heading') {
    var parsed = {}; try { parsed = JSON.parse(data); } catch(_){ parsed={level:'2',text:data}; }
    var row = document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:0;';
    var sel = document.createElement('select');
    sel.className = 'heading-level';
    sel.style.cssText='background:var(--cream);border:none;border-right:1px solid var(--border);padding:0.75rem 0.5rem;font-family:var(--font-mono);font-size:0.75rem;color:var(--ink-light);outline:none;cursor:pointer;flex-shrink:0;';
    ['1','2','3','4'].forEach(function(l){
      var o=document.createElement('option'); o.value=l; o.textContent='H'+l;
      if(l===(parsed.level||'2')) o.selected=true; sel.appendChild(o);
    });
    var inp = document.createElement('input');
    inp.type='text'; inp.className='heading-editor';
    inp.placeholder='Section heading...'; inp.value=parsed.text||'';
    inp.style.flex='1';
    function syncH(){ syncBlockData(id,JSON.stringify({level:sel.value,text:inp.value})); refreshPreview(); updateWordCount(); triggerAutoSave(); }
    inp.addEventListener('input', syncH); sel.addEventListener('change', syncH);
    inp.addEventListener('focus', function(){ activeTextarea=inp; });
    row.appendChild(sel); row.appendChild(inp); wrap.appendChild(row);

  // ── Math ──
  } else if (type === 'math') {
    var ta = document.createElement('textarea');
    ta.className = 'math-editor';
    ta.placeholder = 'LaTeX equation, e.g.  \\frac{a}{b} = c';
    ta.value = data;
    var prev = document.createElement('div'); prev.className='math-preview';
    function renderMath(){
      syncBlockData(id,ta.value);
      try { if(typeof katex!=='undefined') katex.render(ta.value,prev,{displayMode:true,throwOnError:false}); }
      catch(e){ prev.textContent=ta.value; }
      refreshPreview(); triggerAutoSave();
    }
    ta.addEventListener('input', renderMath);
    ta.addEventListener('focus', function(){ activeTextarea=ta; });
    wrap.appendChild(ta); wrap.appendChild(prev); renderMath();

  // ── Code ──
  } else if (type === 'code') {
    var parsed={}; try{parsed=JSON.parse(data);}catch(_){parsed={lang:'javascript',code:data};}
    var header = document.createElement('div');
    header.style.cssText='display:flex;align-items:center;background:#0f0f1a;border-bottom:1px solid #2a2a3a;padding:0 0.5rem;gap:0.5rem;';
    var sel = document.createElement('select'); sel.className='code-lang-select';
    sel.style.cssText='flex:1;';
    ['javascript','typescript','python','bash','html','css','json','rust','go','java','cpp','sql','markdown','yaml'].forEach(function(l){
      var o=document.createElement('option'); o.value=l; o.textContent=l;
      if(l===(parsed.lang||'javascript')) o.selected=true; sel.appendChild(o);
    });
    var copyBtn = document.createElement('button');
    copyBtn.textContent='Copy'; copyBtn.style.cssText='background:none;border:1px solid #3a3a5a;color:#7070a0;border-radius:3px;padding:0.2rem 0.5rem;font-size:0.7rem;cursor:pointer;font-family:inherit;';
    header.appendChild(sel); header.appendChild(copyBtn);
    var ta = document.createElement('textarea'); ta.className='code-editor';
    ta.placeholder='// Your code here'; ta.value=parsed.code||'';
    function syncCode(){ syncBlockData(id,JSON.stringify({lang:sel.value,code:ta.value})); refreshPreview(); triggerAutoSave(); }
    ta.addEventListener('input', syncCode); sel.addEventListener('change', syncCode);
    ta.addEventListener('focus', function(){ activeTextarea=ta; });
    copyBtn.addEventListener('click', function(){
      navigator.clipboard.writeText(ta.value).then(function(){
        copyBtn.textContent='Copied!'; setTimeout(function(){copyBtn.textContent='Copy';},1500);
      });
    });
    // Tab key support in code blocks
    ta.addEventListener('keydown', function(e){
      if(e.key==='Tab'){e.preventDefault();var s=ta.selectionStart;ta.value=ta.value.substring(0,s)+'  '+ta.value.substring(ta.selectionEnd);ta.selectionStart=ta.selectionEnd=s+2;}
    });
    wrap.appendChild(header); wrap.appendChild(ta);

  // ── Visualization ──
  } else if (type === 'viz') {
    var inner=document.createElement('div'); inner.className='viz-block-inner';
    var lbl=document.createElement('label'); lbl.textContent='Visualization filename (in visualizations/ folder)';
    var inp=document.createElement('input'); inp.type='text'; inp.className='viz-filename-input';
    inp.placeholder='e.g.  my-chart.html  or  mandelbrot.html'; inp.value=data;
    inp.addEventListener('input',function(){ syncBlockData(id,inp.value); refreshPreview(); triggerAutoSave(); });
    var note=document.createElement('p'); note.className='viz-note';
    note.textContent='The file will be embedded as an interactive iframe. Put your HTML file in the visualizations/ folder.';
    // Quick suggestions
    var suggestions = document.createElement('div');
    suggestions.style.cssText='display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;';
    ['mandelbrot.html','wave-explorer.html','sample-chart.html'].forEach(function(f){
      var chip=document.createElement('button');
      chip.textContent=f; chip.style.cssText='font-size:0.68rem;background:var(--cream-dk);border:1px solid var(--border);border-radius:3px;padding:0.15rem 0.4rem;cursor:pointer;font-family:var(--font-mono);color:var(--ink-mid);';
      chip.addEventListener('click',function(){ inp.value=f; inp.dispatchEvent(new Event('input')); });
      suggestions.appendChild(chip);
    });
    inner.appendChild(lbl); inner.appendChild(inp); inner.appendChild(note); inner.appendChild(suggestions);
    wrap.appendChild(inner);

  // ── Image ──
  } else if (type === 'image') {
    var parsed={}; try{parsed=JSON.parse(data);}catch(_){parsed={url:data||'',alt:'',caption:''};}
    var inner=document.createElement('div'); inner.className='image-block-inner';
    var urlInp=document.createElement('input'); urlInp.type='text'; urlInp.className='image-url-input';
    urlInp.placeholder='Image URL, e.g. https://... or assets/images/photo.jpg'; urlInp.value=parsed.url||'';
    var altInp=document.createElement('input'); altInp.type='text'; altInp.className='image-alt-input';
    altInp.placeholder='Alt text (describe the image for accessibility)'; altInp.value=parsed.alt||'';
    var capInp=document.createElement('input'); capInp.type='text'; capInp.className='image-caption-input';
    capInp.placeholder='Caption (optional — shown below image)'; capInp.value=parsed.caption||'';
    capInp.style.cssText='width:100%;padding:0.4rem 0.6rem;font-family:var(--font-sans);font-size:0.78rem;border:1px solid var(--border);border-radius:4px;background:var(--cream);color:var(--ink);outline:none;margin-top:0.4rem;font-style:italic;';
    var prev=document.createElement('div'); prev.className='image-preview';
    function updateImg(){
      syncBlockData(id,JSON.stringify({url:urlInp.value,alt:altInp.value,caption:capInp.value}));
      refreshPreview(); triggerAutoSave();
      prev.innerHTML = urlInp.value ? '<img src="'+urlInp.value+'" alt="'+altInp.value+'" style="max-height:160px;border-radius:4px;border:1px solid var(--border);">' : '';
    }
    urlInp.addEventListener('input',updateImg); altInp.addEventListener('input',updateImg); capInp.addEventListener('input',updateImg);
    inner.appendChild(urlInp); inner.appendChild(altInp); inner.appendChild(capInp); inner.appendChild(prev);
    wrap.appendChild(inner); updateImg();

  // ── Callout ──
  } else if (type === 'callout') {
    var parsed={}; try{parsed=JSON.parse(data);}catch(_){parsed={type:'info',text:data||''};}
    var calloutColors={info:'#2a6496',warning:'#c87820',success:'#3a8a3a',danger:'#c84b20'};
    var calloutIcons={info:'ℹ',warning:'⚠',success:'✓',danger:'✕'};
    var outer=document.createElement('div'); outer.className='callout-block';
    outer.style.borderLeftColor=calloutColors[parsed.type||'info']||calloutColors.info;
    var typeRow=document.createElement('div');
    typeRow.style.cssText='display:flex;gap:0.4rem;margin-bottom:0.5rem;';
    ['info','warning','success','danger'].forEach(function(t){
      var tb=document.createElement('button');
      tb.textContent=calloutIcons[t]+' '+t;
      tb.style.cssText='font-size:0.68rem;padding:0.2rem 0.5rem;border-radius:3px;cursor:pointer;font-family:var(--font-mono);border:1px solid var(--border);background:'+(parsed.type===t?calloutColors[t]:'var(--cream)')+';color:'+(parsed.type===t?'#fff':'var(--ink-mid)')+';';
      tb.addEventListener('click',function(){
        parsed.type=t; outer.style.borderLeftColor=calloutColors[t];
        typeRow.querySelectorAll('button').forEach(function(b,_){b.style.background='var(--cream)';b.style.color='var(--ink-mid)';});
        tb.style.background=calloutColors[t]; tb.style.color='#fff';
        syncBlockData(id,JSON.stringify({type:parsed.type,text:ta.value})); refreshPreview();
      });
      typeRow.appendChild(tb);
    });
    var ta=document.createElement('textarea'); ta.className='callout-textarea';
    ta.placeholder='Callout text...'; ta.value=parsed.text||'';
    ta.addEventListener('input',function(){ autoResize(ta); syncBlockData(id,JSON.stringify({type:parsed.type||'info',text:ta.value})); refreshPreview(); triggerAutoSave(); });
    ta.addEventListener('focus',function(){ activeTextarea=ta; });
    outer.appendChild(typeRow); outer.appendChild(ta);
    wrap.appendChild(outer);

  // ── Divider ──
  } else if (type === 'divider') {
    var d=document.createElement('div'); d.className='divider-block';
    d.innerHTML='<hr><span>section break</span><hr>'; wrap.appendChild(d);

  // ── Table ──
  } else if (type === 'table') {
    var parsed={}; try{parsed=JSON.parse(data);}catch(_){parsed={rows:3,cols:3,headers:['Col 1','Col 2','Col 3'],cells:[['','',''],['','','']]};}
    wrap.appendChild(buildTableBlock(id, parsed));

  // ── Tweet / Quote ──
  } else if (type === 'tweet') {
    var inner=document.createElement('div');
    inner.style.cssText='padding:1rem;border-left:3px solid #1da1f2;background:rgba(29,161,242,0.05);';
    var label=document.createElement('div');
    label.textContent='Quote / Tweet Block'; label.style.cssText='font-family:var(--font-mono);font-size:0.65rem;color:#1da1f2;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.5rem;';
    var ta=document.createElement('textarea'); ta.className='tweet-textarea';
    ta.style.cssText='width:100%;border:none;background:transparent;font-family:var(--font-serif);font-size:1rem;color:var(--ink);outline:none;resize:vertical;min-height:80px;line-height:1.6;font-style:italic;';
    ta.placeholder='Enter a quote or tweet text...'; ta.value=data;
    var authorInp=document.createElement('input'); authorInp.type='text';
    authorInp.style.cssText='width:100%;border:none;border-top:1px solid var(--border);background:transparent;font-family:var(--font-mono);font-size:0.75rem;color:var(--ink-light);outline:none;padding:0.4rem 0;margin-top:0.4rem;';
    authorInp.placeholder='— Author name or @handle (optional)';
    // Store combined
    function syncTweet(){ syncBlockData(id, ta.value + (authorInp.value ? '\n—' + authorInp.value : '')); refreshPreview(); triggerAutoSave(); }
    ta.addEventListener('input', function(){ autoResize(ta); syncTweet(); });
    ta.addEventListener('focus',function(){ activeTextarea=ta; });
    authorInp.addEventListener('input', syncTweet);
    // Pre-fill
    var lines = (data||'').split('\n—');
    ta.value = lines[0]||''; if(lines[1]) authorInp.value = lines[1];
    inner.appendChild(label); inner.appendChild(ta); inner.appendChild(authorInp);
    wrap.appendChild(inner);

  // ── Table of Contents ──
  } else if (type === 'toc') {
    var inner=document.createElement('div');
    inner.style.cssText='padding:1rem;background:var(--cream);border:1px dashed var(--border);border-radius:4px;text-align:center;';
    inner.innerHTML='<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--ink-light);letter-spacing:0.06em;text-transform:uppercase;">Table of Contents</div><div style="font-size:0.8rem;color:var(--ink-light);margin-top:0.4rem;">Auto-generated from headings in your post</div>';
    wrap.appendChild(inner);
  }

  return wrap;
}

// ─── Table block builder ──────────────────────────────────────────────────────
function buildTableBlock(id, parsed) {
  var container = document.createElement('div');
  container.style.cssText='padding:1rem;overflow-x:auto;';

  function rebuildTable() {
    container.innerHTML='';
    var rows=parsed.rows||3, cols=parsed.cols||3;
    var headers=parsed.headers||[], cells=parsed.cells||[];

    // Controls
    var controls=document.createElement('div');
    controls.style.cssText='display:flex;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap;align-items:center;';
    controls.innerHTML='<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--ink-light);text-transform:uppercase;letter-spacing:0.06em;">Table</span>';

    function makeCtrlBtn(label, fn) {
      var b=document.createElement('button');
      b.textContent=label;
      b.style.cssText='font-size:0.7rem;padding:0.2rem 0.5rem;border:1px solid var(--border);border-radius:3px;background:var(--cream);cursor:pointer;font-family:var(--font-mono);color:var(--ink-mid);';
      b.addEventListener('click',fn); return b;
    }
    controls.appendChild(makeCtrlBtn('+ Col', function(){
      parsed.cols++; parsed.headers.push('Col '+(parsed.cols));
      parsed.cells.forEach(function(r){ r.push(''); });
      syncBlockData(id, JSON.stringify(parsed)); rebuildTable(); refreshPreview();
    }));
    controls.appendChild(makeCtrlBtn('- Col', function(){
      if(parsed.cols<=1) return; parsed.cols--;
      parsed.headers.pop(); parsed.cells.forEach(function(r){ r.pop(); });
      syncBlockData(id, JSON.stringify(parsed)); rebuildTable(); refreshPreview();
    }));
    controls.appendChild(makeCtrlBtn('+ Row', function(){
      parsed.rows++; parsed.cells.push(new Array(parsed.cols).fill(''));
      syncBlockData(id, JSON.stringify(parsed)); rebuildTable(); refreshPreview();
    }));
    controls.appendChild(makeCtrlBtn('- Row', function(){
      if(parsed.rows<=1) return; parsed.rows--; parsed.cells.pop();
      syncBlockData(id, JSON.stringify(parsed)); rebuildTable(); refreshPreview();
    }));
    container.appendChild(controls);

    // Table element
    var tbl=document.createElement('table');
    tbl.style.cssText='width:100%;border-collapse:collapse;font-size:0.85rem;';
    // Header row
    var thead=document.createElement('thead'), hrow=document.createElement('tr');
    for(var c=0;c<cols;c++){
      var th=document.createElement('th');
      th.style.cssText='border:1px solid var(--border);background:var(--cream);padding:0;';
      var inp=document.createElement('input'); inp.type='text';
      inp.style.cssText='width:100%;padding:0.4rem 0.5rem;border:none;background:transparent;font-family:var(--font-mono);font-size:0.72rem;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:var(--ink-light);outline:none;box-sizing:border-box;';
      inp.value=headers[c]||'Column '+(c+1);
      inp.setAttribute('data-col',c);
      inp.addEventListener('input',function(e){
        var ci=parseInt(e.target.getAttribute('data-col'));
        parsed.headers[ci]=e.target.value;
        syncBlockData(id,JSON.stringify(parsed)); refreshPreview();
      });
      th.appendChild(inp); hrow.appendChild(th);
    }
    thead.appendChild(hrow); tbl.appendChild(thead);
    // Body rows
    var tbody=document.createElement('tbody');
    for(var r=0;r<rows;r++){
      var row=document.createElement('tr');
      if(!cells[r]) cells[r]=new Array(cols).fill('');
      for(var c=0;c<cols;c++){
        var td=document.createElement('td');
        td.style.cssText='border:1px solid var(--border);padding:0;';
        var inp=document.createElement('input'); inp.type='text';
        inp.style.cssText='width:100%;padding:0.4rem 0.5rem;border:none;background:transparent;font-family:var(--font-sans);font-size:0.82rem;color:var(--ink);outline:none;box-sizing:border-box;';
        inp.value=cells[r][c]||'';
        inp.setAttribute('data-row',r); inp.setAttribute('data-col',c);
        inp.addEventListener('input',function(e){
          var ri=parseInt(e.target.getAttribute('data-row'));
          var ci=parseInt(e.target.getAttribute('data-col'));
          if(!parsed.cells[ri]) parsed.cells[ri]=[];
          parsed.cells[ri][ci]=e.target.value;
          syncBlockData(id,JSON.stringify(parsed)); refreshPreview();
        });
        // Tab between cells
        inp.addEventListener('keydown',function(e){
          if(e.key==='Tab'){e.preventDefault();var next=e.target.closest('td').nextElementSibling||e.target.closest('tr').nextElementSibling?.querySelector('td');if(next){var ni=next.querySelector('input');if(ni)ni.focus();}}
        });
        td.appendChild(inp); row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    tbl.appendChild(tbody); container.appendChild(tbl);
    parsed.cells=cells; // keep updated
  }

  rebuildTable();
  return container;
}

function collectTableData(id) {
  var b = blocks.find(function(b){ return b.id===id; });
  return b ? b.data : '';
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────
function wrapActive(before, after) {
  var ta=activeTextarea; if(!ta||ta.tagName!=='TEXTAREA') return;
  var s=ta.selectionStart, e=ta.selectionEnd, sel=ta.value.substring(s,e);
  ta.value=ta.value.substring(0,s)+before+sel+after+ta.value.substring(e);
  ta.selectionStart=s+before.length; ta.selectionEnd=s+before.length+sel.length;
  ta.dispatchEvent(new Event('input')); ta.focus();
}
function insertLinkActive() {
  var ta=activeTextarea; if(!ta||ta.tagName!=='TEXTAREA') return;
  var url=prompt('URL:'); if(!url) return;
  var text=ta.value.substring(ta.selectionStart,ta.selectionEnd)||'link text';
  var ins='['+text+']('+url+')'; var s=ta.selectionStart;
  ta.value=ta.value.substring(0,s)+ins+ta.value.substring(ta.selectionEnd);
  ta.dispatchEvent(new Event('input')); ta.focus();
}
function lineStartActive(prefix) {
  var ta=activeTextarea; if(!ta||ta.tagName!=='TEXTAREA') return;
  var s=ta.selectionStart; var ls=ta.value.lastIndexOf('\n',s-1)+1;
  ta.value=ta.value.substring(0,ls)+prefix+ta.value.substring(ls);
  ta.dispatchEvent(new Event('input')); ta.focus();
}
function insertEmoji(emoji) {
  var ta=activeTextarea; if(!ta||ta.tagName!=='TEXTAREA') return;
  var s=ta.selectionStart;
  ta.value=ta.value.substring(0,s)+emoji+ta.value.substring(s);
  ta.selectionStart=ta.selectionEnd=s+emoji.length;
  ta.dispatchEvent(new Event('input')); ta.focus();
  toggleEmojiPicker(false);
}
function toggleEmojiPicker(forceClose) {
  var picker=document.getElementById('emoji-picker');
  if(!picker) return;
  picker.style.display=(forceClose||picker.style.display==='block')?'none':'block';
}

// ─── Auto-resize ──────────────────────────────────────────────────────────────
function autoResize(ta) {
  ta.style.height='auto'; ta.style.height=(ta.scrollHeight+4)+'px';
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab=tab;
  var editArea=document.getElementById('drop-area');
  var prevPane=document.getElementById('preview-pane');
  ['edit','split','preview'].forEach(function(t){
    document.getElementById('tab-'+t).classList.remove('active');
  });
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='edit'){
    editArea.style.display=''; prevPane.classList.remove('visible'); editArea.style.flex='1';
  } else if(tab==='split'){
    editArea.style.display=''; prevPane.classList.add('visible'); editArea.style.flex='1'; prevPane.style.flex='1'; refreshPreview();
  } else {
    editArea.style.display='none'; prevPane.classList.add('visible'); prevPane.style.flex='1'; refreshPreview();
  }
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function refreshPreview() {
  if(currentTab==='edit') return;
  var md=buildMarkdown();
  var html='';
  if(typeof marked!=='undefined'){
    marked.setOptions({gfm:true,breaks:false});
    html=marked.parse(md);
  } else { html='<pre>'+md+'</pre>'; }

  html=html.replace(/\[viz:\s*([^\]]+)\]/g,function(_,f){
    return '<div style="border:1px dashed var(--border);border-radius:6px;padding:1rem;text-align:center;color:var(--ink-light);font-family:var(--font-mono);font-size:0.75rem;margin:1rem 0;">◈ Visualization: '+f.trim()+'</div>';
  });
  html=html.replace(/<p>VIZ_PLACEHOLDER_\d+<\/p>/g,function(){
    return '<div style="border:1px dashed var(--border);border-radius:6px;padding:1rem;text-align:center;color:var(--ink-light);font-size:0.75rem;">[visualization]</div>';
  });

  // Cover image in preview
  var coverUrl=document.getElementById('cover-url')?document.getElementById('cover-url').value:'';
  var coverHtml=coverUrl?'<div style="margin-bottom:2rem;"><img src="'+coverUrl+'" style="width:100%;max-height:280px;object-fit:cover;border-radius:6px;"></div>':'';

  var content=document.getElementById('preview-content');
  content.className='preview-pane-inner post-body';
  content.innerHTML=coverHtml+html;

  if(typeof renderMathInElement!=='undefined'){
    renderMathInElement(content,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false});
  }
}

// ─── Markdown generation ──────────────────────────────────────────────────────
function buildMarkdown() {
  var parts=[];

  // TOC — collect headings first
  var hasToc=blocks.some(function(b){ return b.type==='toc'; });

  blocks.forEach(function(b) {
    var data=getBlockData(b.id);
    if(b.type==='markdown'){
      parts.push(data);
    } else if(b.type==='heading'){
      var p={}; try{p=JSON.parse(data);}catch(_){p={level:'2',text:data};}
      parts.push(new Array(parseInt(p.level||2)+1).join('#')+' '+(p.text||''));
    } else if(b.type==='math'){
      parts.push('\n$$\n'+data+'\n$$\n');
    } else if(b.type==='code'){
      var p={}; try{p=JSON.parse(data);}catch(_){p={lang:'javascript',code:data};}
      parts.push('```'+(p.lang||'javascript')+'\n'+(p.code||'')+'\n```');
    } else if(b.type==='viz'){
      if(data.trim()) parts.push('[viz: '+data.trim()+']');
    } else if(b.type==='image'){
      var p={}; try{p=JSON.parse(data);}catch(_){p={url:data,alt:'',caption:''};}
      if(p.url){
        parts.push('![' +(p.alt||'image')+']('+p.url+')');
        if(p.caption) parts.push('*'+p.caption+'*');
      }
    } else if(b.type==='callout'){
      var p={}; try{p=JSON.parse(data);}catch(_){p={type:'info',text:data};}
      var icon={info:'ℹ️',warning:'⚠️',success:'✅',danger:'🚨'}[p.type||'info']||'ℹ️';
      parts.push('> '+icon+' **'+( p.type||'Note').charAt(0).toUpperCase()+(p.type||'note').slice(1)+'**: '+(p.text||'').split('\n').join('\n> '));
    } else if(b.type==='divider'){
      parts.push('\n---\n');
    } else if(b.type==='table'){
      var p={}; try{p=JSON.parse(data);}catch(_){p={headers:[],cells:[]};}
      var headers=p.headers||[]; var cells=p.cells||[]; var cols=headers.length||1;
      var mdTable='| '+headers.join(' | ')+' |\n';
      mdTable+='| '+headers.map(function(){return'---';}).join(' | ')+' |\n';
      cells.forEach(function(row){
        while(row.length<cols) row.push('');
        mdTable+='| '+row.slice(0,cols).join(' | ')+' |\n';
      });
      parts.push(mdTable);
    } else if(b.type==='tweet'){
      var lines=data.split('\n—');
      var txt=lines[0]||''; var author=lines[1]||'';
      parts.push('> *"'+txt.trim()+'"*'+(author?'\n>\n> — '+author.trim():''));
    } else if(b.type==='toc'){
      parts.push('<!-- TOC -->\n\n*Table of contents auto-generated from headings.*');
    }
  });
  return parts.join('\n\n');
}

// ─── File generation ──────────────────────────────────────────────────────────
function generateFiles() {
  var title   =document.getElementById('meta-title').value||'Untitled Post';
  var date    =document.getElementById('meta-date').value||new Date().toISOString().slice(0,10);
  var excerpt =document.getElementById('meta-excerpt').value.trim();
  var featured=document.getElementById('opt-featured').checked;
  var coverUrl=document.getElementById('cover-url')?document.getElementById('cover-url').value.trim():'';
  var slug    =updateSlug();
  var body    =buildMarkdown();

  var tagList =tags.length?'['+tags.join(', ')+']':'[]';
  var frontMatter='---\ntitle: '+title+'\ndate: '+date+'\ntags: '+tagList+(coverUrl?'\ncover: '+coverUrl:'')+'\n---\n\n';
  var mdContent=frontMatter+body;

  var jsonEntry={slug:slug,title:title,date:date,tags:tags,excerpt:excerpt||title,featured:featured};
  if(coverUrl) jsonEntry.cover=coverUrl;

  document.getElementById('modal-md-filename').textContent='posts/'+slug+'.md';
  document.getElementById('modal-step-fn').textContent='posts/'+slug+'.md';
  document.getElementById('modal-md-output').textContent=mdContent;
  document.getElementById('modal-json-output').textContent=JSON.stringify(jsonEntry,null,2);
  document.getElementById('modal').classList.add('open');
}

function closeModal(){ document.getElementById('modal').classList.remove('open'); }

document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('modal').addEventListener('click',function(e){ if(e.target===this) closeModal(); });
});

function copyOut(elId,btn){
  var text=document.getElementById(elId).textContent;
  navigator.clipboard.writeText(text).then(function(){
    var orig=btn.textContent; btn.textContent='Copied!';
    setTimeout(function(){btn.textContent=orig;},1800);
  }).catch(function(){
    var ta=document.createElement('textarea'); ta.value=text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    btn.textContent='Copied!'; setTimeout(function(){btn.textContent='Copy';},1800);
  });
}
