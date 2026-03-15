/**
 * editor.js — Full drag-and-drop blog editor logic
 * Includes: new post + load/edit existing post
 */

// ─── State ───────────────────────────────────────────────────────────────────
var blocks         = [];
var blockIdCtr     = 0;
var tags           = [];
var dragSrcType    = null;
var dragSrcId      = null;
var activeTextarea = null;
var currentTab     = 'edit';
var editingSlug    = null; // set when editing an existing post

var BASE = '/BeomBlogs';

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var today = new Date();
  document.getElementById('meta-date').value =
    today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2,'0') + '-' +
    String(today.getDate()).padStart(2,'0');

  initPalette();
  initDropArea();
  updateSlug();
  loadPostList();

  // Check if ?edit=slug was passed in URL
  var params = new URLSearchParams(window.location.search);
  var editSlug = params.get('edit');
  if (editSlug) {
    loadPostForEditing(editSlug);
  } else {
    addBlock('markdown', 'Write your post here...\n\nYou can use **bold**, _italic_, and `code`.\n\nAdd more blocks from the left panel.');
  }
});

// ─── Load post list into the "Edit Existing" dropdown ────────────────────────
async function loadPostList() {
  try {
    var res  = await fetch(BASE + '/posts/index.json');
    var list = await res.json();
    var sel  = document.getElementById('existing-post-select');
    sel.innerHTML = '<option value="">— choose a post —</option>';
    list.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.slug;
      opt.textContent = p.title + ' (' + p.date + ')';
      sel.appendChild(opt);
    });
  } catch(e) {
    console.error('Could not load post list:', e);
  }
}

// ─── Load a post into the editor ─────────────────────────────────────────────
async function loadPostForEditing(slug) {
  var statusEl = document.getElementById('load-status');
  statusEl.textContent = 'Loading...';
  statusEl.style.color = 'var(--ink-light)';

  try {
    // Fetch the raw markdown
    var res = await fetch(BASE + '/posts/' + slug + '.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var raw = await res.text();

    // Parse front-matter
    var fm = {};
    var body = raw;
    var fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      fmMatch[1].split('\n').forEach(function(line) {
        var m = line.match(/^(\w+):\s*(.+)$/);
        if (m) fm[m[1].trim()] = m[2].trim();
      });
      body = fmMatch[2].trim();
    }

    // Populate metadata fields
    document.getElementById('meta-title').value   = fm.title   || slug;
    document.getElementById('meta-date').value    = fm.date    || '';
    document.getElementById('meta-excerpt').value = fm.excerpt || '';

    // Parse tags from front-matter like: [tag1, tag2] or tag1, tag2
    tags = [];
    if (fm.tags) {
      var rawTags = fm.tags.replace(/[\[\]]/g, '').split(',');
      rawTags.forEach(function(t) {
        var trimmed = t.trim();
        if (trimmed) tags.push(trimmed);
      });
    }
    renderTags();
    updateSlug();

    // Clear existing blocks
    clearAllBlocks();

    // Parse markdown body into blocks
    parseMarkdownIntoBlocks(body);

    editingSlug = slug;
    document.getElementById('load-status').textContent = 'Loaded: ' + (fm.title || slug);
    document.getElementById('load-status').style.color = 'var(--accent-3, #5a8a3a)';
    document.getElementById('edit-mode-banner').style.display = 'flex';
    document.getElementById('edit-mode-slug').textContent = slug + '.md';

    // Close the load panel
    setLoadPanelOpen(false);

  } catch(e) {
    statusEl.textContent = 'Failed to load post. Check slug.';
    statusEl.style.color = '#c84b20';
    console.error(e);
  }
}

// ─── Parse markdown body into editor blocks ──────────────────────────────────
function parseMarkdownIntoBlocks(md) {
  // Split on double-newlines to get rough segments, then re-join intelligently
  // Strategy: scan line by line, group into chunks by type

  var lines  = md.split('\n');
  var chunks = []; // { type, lines[] }
  var cur    = null;

  function flush() {
    if (cur && cur.lines.length) chunks.push(cur);
    cur = null;
  }

  var i = 0;
  while (i < lines.length) {
    var line = lines[i];

    // Math block: $$
    if (line.trim() === '$$') {
      flush();
      var mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      chunks.push({ type: 'math', lines: mathLines });
      i++; // skip closing $$
      continue;
    }

    // Fenced code block: ```lang
    if (line.trim().startsWith('```')) {
      flush();
      var lang = line.trim().replace(/^```/, '').trim() || 'javascript';
      var codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      chunks.push({ type: 'code', lang: lang, lines: codeLines });
      i++; // skip closing ```
      continue;
    }

    // Viz embed: [viz: filename.html]
    if (line.trim().match(/^\[viz:\s*[^\]]+\]$/)) {
      flush();
      var fname = line.trim().replace(/^\[viz:\s*/, '').replace(/\]$/, '').trim();
      chunks.push({ type: 'viz', lines: [fname] });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      flush();
      chunks.push({ type: 'divider', lines: [] });
      i++;
      continue;
    }

    // Heading line (## or #)
    if (line.match(/^#{1,6}\s/) && !cur) {
      flush();
      var headingText = line.replace(/^#{1,6}\s/, '').trim();
      chunks.push({ type: 'heading', lines: [headingText] });
      i++;
      continue;
    }

    // Blockquote → callout
    if (line.startsWith('> ')) {
      if (cur && cur.type === 'callout') {
        cur.lines.push(line.replace(/^> ?/, ''));
      } else {
        flush();
        cur = { type: 'callout', lines: [line.replace(/^> ?/, '')] };
      }
      i++;
      continue;
    }

    // Image: ![alt](url)
    if (line.trim().match(/^!\[.*\]\(.*\)$/) && (!cur || cur.type !== 'markdown')) {
      flush();
      var imgMatch = line.trim().match(/^!\[(.*)\]\((.*)\)$/);
      if (imgMatch) {
        chunks.push({ type: 'image', alt: imgMatch[1], url: imgMatch[2], lines: [] });
      }
      i++;
      continue;
    }

    // Everything else → markdown
    if (!cur || cur.type !== 'markdown') {
      flush();
      cur = { type: 'markdown', lines: [] };
    }
    cur.lines.push(line);
    i++;
  }
  flush();

  // Now create blocks from chunks
  chunks.forEach(function(chunk) {
    if (chunk.type === 'math') {
      addBlock('math', chunk.lines.join('\n').trim());
    } else if (chunk.type === 'code') {
      addBlock('code', JSON.stringify({ lang: chunk.lang, code: chunk.lines.join('\n') }));
    } else if (chunk.type === 'viz') {
      addBlock('viz', chunk.lines[0]);
    } else if (chunk.type === 'divider') {
      addBlock('divider', '');
    } else if (chunk.type === 'heading') {
      addBlock('heading', chunk.lines[0]);
    } else if (chunk.type === 'callout') {
      addBlock('callout', chunk.lines.join('\n'));
    } else if (chunk.type === 'image') {
      addBlock('image', JSON.stringify({ url: chunk.url, alt: chunk.alt }));
    } else if (chunk.type === 'markdown') {
      var text = chunk.lines.join('\n').trim();
      if (text) addBlock('markdown', text);
    }
  });
}

function clearAllBlocks() {
  blocks = [];
  blockIdCtr = 0;
  var area = document.getElementById('drop-area');
  area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
  var hint = document.getElementById('drop-hint');
  if (hint) hint.style.display = '';
}

// ─── Load panel toggle ────────────────────────────────────────────────────────
function setLoadPanelOpen(open) {
  var panel = document.getElementById('load-panel');
  panel.style.display = open ? 'flex' : 'none';
}

function toggleLoadPanel() {
  var panel = document.getElementById('load-panel');
  setLoadPanelOpen(panel.style.display === 'none' || panel.style.display === '');
}

function loadSelectedPost() {
  var sel  = document.getElementById('existing-post-select');
  var slug = sel.value;
  if (!slug) return;
  loadPostForEditing(slug);
}

function clearEditor() {
  if (!confirm('Clear editor and start a new post?')) return;
  clearAllBlocks();
  editingSlug = null;
  document.getElementById('meta-title').value   = '';
  document.getElementById('meta-date').value    = new Date().toISOString().slice(0,10);
  document.getElementById('meta-excerpt').value = '';
  tags = [];
  renderTags();
  updateSlug();
  document.getElementById('edit-mode-banner').style.display = 'none';
  setLoadPanelOpen(false);
  addBlock('markdown', 'Write your post here...\n\nYou can use **bold**, _italic_, and `code`.\n\nAdd more blocks from the left panel.');
}

// ─── Slug ─────────────────────────────────────────────────────────────────────
function updateSlug() {
  var title = document.getElementById('meta-title').value;
  var slug  = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'my-post';
  document.getElementById('slug-display').textContent = slug;
  return slug;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────
function handleTagInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    var val = e.target.value.replace(/,/g, '').trim();
    if (val && !tags.includes(val)) {
      tags.push(val);
      renderTags();
    }
    e.target.value = '';
  } else if (e.key === 'Backspace' && e.target.value === '' && tags.length) {
    tags.pop();
    renderTags();
  }
}

function renderTags() {
  var wrap  = document.getElementById('tags-wrap');
  var input = document.getElementById('tag-input');
  wrap.querySelectorAll('.tag-chip').forEach(function(c){ c.remove(); });
  tags.forEach(function(tag, i) {
    var chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = tag + '<button class="tag-chip-remove" onclick="removeTag(' + i + ')">x</button>';
    wrap.insertBefore(chip, input);
  });
}

function removeTag(i) {
  tags.splice(i, 1);
  renderTags();
}

// ─── Palette drag ─────────────────────────────────────────────────────────────
function initPalette() {
  document.querySelectorAll('.block-btn').forEach(function(btn) {
    btn.addEventListener('dragstart', function(e) {
      dragSrcType = btn.dataset.type;
      dragSrcId   = null;
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    btn.addEventListener('dragend', function() {
      btn.classList.remove('dragging');
    });
    btn.addEventListener('click', function() {
      addBlock(btn.dataset.type);
      var area = document.getElementById('drop-area');
      area.scrollTop = area.scrollHeight;
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
  return id;
}

function getDefaultData(type) {
  var defaults = {
    markdown: '## New Section\n\nWrite your content here...',
    heading:  'Section Title',
    math:     'E = mc^2',
    code:     '// Your code here\nconsole.log("Hello, world!");',
    viz:      '',
    image:    '',
    callout:  'Important note: add your callout text here.',
    divider:  ''
  };
  return defaults[type] || '';
}

function removeBlock(id) {
  blocks = blocks.filter(function(b){ return b.id !== id; });
  var el = document.getElementById(id);
  if (el) el.remove();
  if (!blocks.length) {
    var hint = document.getElementById('drop-hint');
    if (hint) hint.style.display = '';
  }
  refreshPreview();
}

function moveBlock(id, dir) {
  var idx = blocks.findIndex(function(b){ return b.id === id; });
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= blocks.length) return;
  var tmp = blocks[idx];
  blocks[idx] = blocks[newIdx];
  blocks[newIdx] = tmp;
  var area = document.getElementById('drop-area');
  area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
  blocks.forEach(function(b) {
    var el = document.getElementById(b.id) || createBlockEl(b.id, b.type, b.data);
    area.appendChild(el);
  });
  refreshPreview();
}

function getBlockData(id) {
  var b = blocks.find(function(b){ return b.id === id; });
  if (!b) return '';
  var el = document.getElementById(id);
  if (!el) return b.data;
  if (b.type === 'markdown') {
    var ta = el.querySelector('.markdown-editor');
    return ta ? ta.value : b.data;
  } else if (b.type === 'heading') {
    var inp = el.querySelector('.heading-editor');
    return inp ? inp.value : b.data;
  } else if (b.type === 'math') {
    var ta = el.querySelector('.math-editor');
    return ta ? ta.value : b.data;
  } else if (b.type === 'code') {
    var ta  = el.querySelector('.code-editor');
    var sel = el.querySelector('.code-lang-select');
    return JSON.stringify({ lang: sel ? sel.value : 'javascript', code: ta ? ta.value : b.data });
  } else if (b.type === 'viz') {
    var inp = el.querySelector('.viz-filename-input');
    return inp ? inp.value : b.data;
  } else if (b.type === 'image') {
    var url = el.querySelector('.image-url-input');
    var alt = el.querySelector('.image-alt-input');
    return JSON.stringify({ url: url ? url.value : '', alt: alt ? alt.value : '' });
  } else if (b.type === 'callout') {
    var ta = el.querySelector('.callout-textarea');
    return ta ? ta.value : b.data;
  } else if (b.type === 'divider') {
    return '';
  }
  return b.data;
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
    setTimeout(function(){ el.style.opacity = '0.4'; }, 0);
  });
  el.addEventListener('dragend', function() {
    el.style.opacity = '';
    dragSrcId = null;
    document.querySelectorAll('.editor-block').forEach(function(b){ b.classList.remove('drag-target'); });
  });
  el.addEventListener('dragover', function(e) {
    if (!dragSrcId || dragSrcId === id) return;
    e.preventDefault();
    el.classList.add('drag-target');
  });
  el.addEventListener('dragleave', function() { el.classList.remove('drag-target'); });
  el.addEventListener('drop', function(e) {
    if (!dragSrcId || dragSrcId === id) return;
    e.preventDefault();
    el.classList.remove('drag-target');
    var srcIdx = blocks.findIndex(function(b){ return b.id === dragSrcId; });
    var tgtIdx = blocks.findIndex(function(b){ return b.id === id; });
    if (srcIdx < 0 || tgtIdx < 0) return;
    var moved = blocks.splice(srcIdx, 1)[0];
    blocks.splice(tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx, 0, moved);
    var area = document.getElementById('drop-area');
    area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
    blocks.forEach(function(b) {
      area.appendChild(document.getElementById(b.id) || createBlockEl(b.id, b.type, b.data));
    });
    refreshPreview();
  });

  var typeLabels = {
    markdown:'Markdown', heading:'Heading', math:'LaTeX Math',
    code:'Code', viz:'Visualization', image:'Image',
    callout:'Callout', divider:'Divider'
  };
  var handle = document.createElement('div');
  handle.className = 'block-handle';
  handle.innerHTML =
    '<div class="block-handle-left">' +
      '<span class="handle-dots" title="Drag to reorder">::::</span>' +
      '<span class="block-type-label">' + (typeLabels[type] || type) + '</span>' +
    '</div>' +
    '<div class="block-actions">' +
      '<button class="block-action-btn" title="Move up" onclick="moveBlock(\'' + id + '\',-1)">up</button>' +
      '<button class="block-action-btn" title="Move down" onclick="moveBlock(\'' + id + '\',1)">dn</button>' +
      '<button class="block-action-btn" title="Delete" onclick="removeBlock(\'' + id + '\')">rm</button>' +
    '</div>';
  el.appendChild(handle);
  el.appendChild(buildBlockContent(id, type, data));
  return el;
}

function buildBlockContent(id, type, data) {
  var wrap = document.createElement('div');

  if (type === 'markdown') {
    var ta = document.createElement('textarea');
    ta.className = 'markdown-editor';
    ta.placeholder = 'Write Markdown here...';
    ta.value = data;
    ta.addEventListener('input', function() { autoResize(ta); syncBlockData(id, ta.value); refreshPreview(); });
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    autoResize(ta);
    wrap.appendChild(ta);

  } else if (type === 'heading') {
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'heading-editor';
    inp.placeholder = 'Section heading...'; inp.value = data;
    inp.addEventListener('input', function() { syncBlockData(id, inp.value); refreshPreview(); });
    inp.addEventListener('focus', function(){ activeTextarea = inp; });
    wrap.appendChild(inp);

  } else if (type === 'math') {
    var ta = document.createElement('textarea');
    ta.className = 'math-editor';
    ta.placeholder = 'LaTeX here, e.g. \\frac{a}{b} = c';
    ta.value = data;
    var preview = document.createElement('div');
    preview.className = 'math-preview';
    function renderMath() {
      syncBlockData(id, ta.value);
      try { katex.render(ta.value, preview, { displayMode: true, throwOnError: false }); }
      catch(e) { preview.textContent = ta.value; }
      refreshPreview();
    }
    ta.addEventListener('input', renderMath);
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    wrap.appendChild(ta); wrap.appendChild(preview);
    setTimeout(renderMath, 0);

  } else if (type === 'code') {
    var parsed = {};
    try { parsed = JSON.parse(data); } catch(_) { parsed = { lang: 'javascript', code: data }; }
    var sel = document.createElement('select');
    sel.className = 'code-lang-select';
    ['javascript','python','bash','html','css','json','typescript','rust','go','java','cpp','markdown'].forEach(function(l){
      var opt = document.createElement('option');
      opt.value = l; opt.textContent = l;
      if (l === (parsed.lang || 'javascript')) opt.selected = true;
      sel.appendChild(opt);
    });
    var ta = document.createElement('textarea');
    ta.className = 'code-editor'; ta.placeholder = '// Your code here';
    ta.value = parsed.code || '';
    ta.addEventListener('input', function() { syncBlockData(id, JSON.stringify({ lang: sel.value, code: ta.value })); refreshPreview(); });
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    sel.addEventListener('change', function() { syncBlockData(id, JSON.stringify({ lang: sel.value, code: ta.value })); });
    wrap.appendChild(sel); wrap.appendChild(ta);

  } else if (type === 'viz') {
    var inner = document.createElement('div');
    inner.className = 'viz-block-inner';
    var lbl = document.createElement('label');
    lbl.textContent = 'Visualization filename (in visualizations/ folder)';
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'viz-filename-input';
    inp.placeholder = 'e.g. my-chart.html'; inp.value = data;
    inp.addEventListener('input', function() { syncBlockData(id, inp.value); refreshPreview(); });
    var note = document.createElement('p');
    note.className = 'viz-note';
    note.textContent = 'The file will be embedded as an interactive iframe in the published post.';
    inner.appendChild(lbl); inner.appendChild(inp); inner.appendChild(note);
    wrap.appendChild(inner);

  } else if (type === 'image') {
    var parsed = {};
    try { parsed = JSON.parse(data); } catch(_) { parsed = { url: data || '', alt: '' }; }
    var inner = document.createElement('div');
    inner.className = 'image-block-inner';
    var urlInp = document.createElement('input');
    urlInp.type = 'text'; urlInp.className = 'image-url-input';
    urlInp.placeholder = 'Image URL or path'; urlInp.value = parsed.url || '';
    var altInp = document.createElement('input');
    altInp.type = 'text'; altInp.className = 'image-alt-input';
    altInp.placeholder = 'Alt text'; altInp.value = parsed.alt || '';
    var prev = document.createElement('div');
    prev.className = 'image-preview';
    function updateImg() {
      syncBlockData(id, JSON.stringify({ url: urlInp.value, alt: altInp.value }));
      refreshPreview();
      prev.innerHTML = urlInp.value ? '<img src="' + urlInp.value + '" alt="' + altInp.value + '" style="max-height:160px;border-radius:4px;border:1px solid var(--border);">' : '';
    }
    urlInp.addEventListener('input', updateImg);
    altInp.addEventListener('input', updateImg);
    inner.appendChild(urlInp); inner.appendChild(altInp); inner.appendChild(prev);
    wrap.appendChild(inner);
    setTimeout(updateImg, 0);

  } else if (type === 'callout') {
    var div = document.createElement('div');
    div.className = 'callout-block';
    var ta = document.createElement('textarea');
    ta.className = 'callout-textarea'; ta.placeholder = 'Callout text...'; ta.value = data;
    ta.addEventListener('input', function() { autoResize(ta); syncBlockData(id, ta.value); refreshPreview(); });
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    div.appendChild(ta); wrap.appendChild(div);

  } else if (type === 'divider') {
    var d = document.createElement('div');
    d.className = 'divider-block';
    d.innerHTML = '<hr> divider <hr>';
    wrap.appendChild(d);
  }

  return wrap;
}

function syncBlockData(id, val) {
  var b = blocks.find(function(b){ return b.id === id; });
  if (b) b.data = val;
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────
function wrapActive(before, after) {
  var ta = activeTextarea;
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  var sel = ta.value.substring(start, end);
  ta.value = ta.value.substring(0, start) + before + sel + after + ta.value.substring(end);
  ta.selectionStart = start + before.length;
  ta.selectionEnd   = start + before.length + sel.length;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function insertLinkActive() {
  var ta = activeTextarea;
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  var url = prompt('URL:');
  if (!url) return;
  var text = ta.value.substring(ta.selectionStart, ta.selectionEnd) || 'link text';
  var ins  = '[' + text + '](' + url + ')';
  ta.value = ta.value.substring(0, ta.selectionStart) + ins + ta.value.substring(ta.selectionEnd);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function lineStartActive(prefix) {
  var ta = activeTextarea;
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  var lineStart = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  ta.value = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

// ─── Auto-resize ──────────────────────────────────────────────────────────────
function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = (ta.scrollHeight + 4) + 'px';
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  var editArea = document.getElementById('drop-area');
  var prevPane = document.getElementById('preview-pane');
  ['tab-edit','tab-split','tab-preview'].forEach(function(id){
    document.getElementById(id).classList.remove('active');
  });
  if (tab === 'edit') {
    document.getElementById('tab-edit').classList.add('active');
    editArea.style.display = ''; prevPane.classList.remove('visible');
    editArea.style.flex = '1';
  } else if (tab === 'split') {
    document.getElementById('tab-split').classList.add('active');
    editArea.style.display = ''; prevPane.classList.add('visible');
    editArea.style.flex = '1'; prevPane.style.flex = '1';
    refreshPreview();
  } else {
    document.getElementById('tab-preview').classList.add('active');
    editArea.style.display = 'none'; prevPane.classList.add('visible');
    prevPane.style.flex = '1';
    refreshPreview();
  }
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function refreshPreview() {
  if (currentTab === 'edit') return;
  var md = buildMarkdown();
  var html = typeof marked !== 'undefined'
    ? marked.parse(md)
    : '<pre>' + md + '</pre>';

  html = html.replace(/\[viz:\s*([^\]]+)\]/g, function(_, fname) {
    return '<div style="border:1px dashed var(--border);border-radius:6px;padding:1rem;text-align:center;color:var(--ink-light);font-family:var(--font-mono);font-size:0.75rem;margin:1rem 0;">Visualization: ' + fname.trim() + '</div>';
  });

  var content = document.getElementById('preview-content');
  content.className = 'preview-pane-inner post-body';
  content.innerHTML = html;

  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(content, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false }
      ],
      throwOnError: false
    });
  }
}

// ─── Markdown generation ──────────────────────────────────────────────────────
function buildMarkdown() {
  var parts = [];
  blocks.forEach(function(b) {
    var data = getBlockData(b.id);
    if (b.type === 'markdown') {
      parts.push(data);
    } else if (b.type === 'heading') {
      parts.push('## ' + data);
    } else if (b.type === 'math') {
      parts.push('\n$$\n' + data + '\n$$\n');
    } else if (b.type === 'code') {
      var p = {}; try { p = JSON.parse(data); } catch(_) { p = { lang: 'javascript', code: data }; }
      parts.push('```' + (p.lang || 'javascript') + '\n' + (p.code || '') + '\n```');
    } else if (b.type === 'viz') {
      if (data.trim()) parts.push('[viz: ' + data.trim() + ']');
    } else if (b.type === 'image') {
      var p = {}; try { p = JSON.parse(data); } catch(_) { p = { url: data, alt: '' }; }
      if (p.url) parts.push('![' + (p.alt || 'image') + '](' + p.url + ')');
    } else if (b.type === 'callout') {
      parts.push('> ' + data.split('\n').join('\n> '));
    } else if (b.type === 'divider') {
      parts.push('\n---\n');
    }
  });
  return parts.join('\n\n');
}

// ─── Generate files modal ─────────────────────────────────────────────────────
function generateFiles() {
  var title    = document.getElementById('meta-title').value || 'Untitled Post';
  var date     = document.getElementById('meta-date').value  || new Date().toISOString().slice(0,10);
  var excerpt  = document.getElementById('meta-excerpt').value.trim();
  var featured = document.getElementById('opt-featured').checked;
  var slug     = editingSlug || updateSlug();
  var body     = buildMarkdown();

  var tagList     = tags.length ? '[' + tags.join(', ') + ']' : '[]';
  var frontMatter = '---\ntitle: ' + title + '\ndate: ' + date + '\ntags: ' + tagList + '\n---\n\n';
  var mdContent   = frontMatter + body;

  var jsonEntry = { slug: slug, title: title, date: date, tags: tags, excerpt: excerpt || title, featured: featured };

  var isEditing = !!editingSlug;
  var filename  = slug + '.md';

  document.getElementById('modal-md-filename').textContent = 'posts/' + filename;
  document.getElementById('modal-step-fn').textContent     = 'posts/' + filename;
  document.getElementById('modal-md-output').textContent   = mdContent;
  document.getElementById('modal-json-output').textContent = JSON.stringify(jsonEntry, null, 2);

  // Update modal instructions depending on new vs edit
  var stepsEl = document.getElementById('modal-steps-content');
  if (isEditing) {
    stepsEl.innerHTML =
      '<strong>You are editing an existing post:</strong>' +
      '<ol>' +
        '<li>Copy the Markdown above.</li>' +
        '<li>Go to <code>posts/' + filename + '</code> on GitHub, click the pencil icon, paste over everything, and commit.</li>' +
        '<li><strong>No need to change <code>index.json</code></strong> — the post is already listed there. Only update it if you changed the title, date, tags, or excerpt.</li>' +
      '</ol>';
  } else {
    stepsEl.innerHTML =
      '<strong>Publishing a new post:</strong>' +
      '<ol>' +
        '<li>Save the Markdown as <code>' + filename + '</code> in your <code>posts/</code> folder on GitHub.</li>' +
        '<li>Open <code>posts/index.json</code> and add the JSON entry to the array (add a comma after the previous last entry).</li>' +
        '<li>If you used a visualization, place its HTML file in <code>visualizations/</code>.</li>' +
        '<li>Commit and push — your post goes live automatically!</li>' +
      '</ol>';
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});

function copyOut(elId, btn) {
  var text = document.getElementById(elId).textContent;
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function(){ btn.textContent = orig; }, 1800);
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    setTimeout(function(){ btn.textContent = 'Copy'; }, 1800);
  });
}
