/**
 * editor.js — Full drag-and-drop blog editor logic
 */

// ─── State ──────────────────────────────────────────────────────────────────
var blocks       = [];   // Array of { id, type, data }
var blockIdCtr   = 0;
var tags         = [];
var dragSrcType  = null; // block type being dragged from palette
var dragSrcId    = null; // block id being reordered
var activeTextarea = null; // currently focused textarea/input in editor
var currentTab   = 'edit';

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Set today's date
  var today = new Date();
  var yyyy  = today.getFullYear();
  var mm    = String(today.getMonth() + 1).padStart(2, '0');
  var dd    = String(today.getDate()).padStart(2, '0');
  document.getElementById('meta-date').value = yyyy + '-' + mm + '-' + dd;

  initPalette();
  initDropArea();
  updateSlug();

  // Check if editing an existing post (?edit=slug)
  var params   = new URLSearchParams(window.location.search);
  var editSlug = params.get('edit');
  if (editSlug) {
    loadPostForEditing(editSlug);
  } else {
    addBlock('markdown', 'Write your post here...\n\nUse **bold**, _italic_, `inline code`, and the toolbar above.\n\nDrag more blocks from the left panel.');
  }
});

// ─── Slug ────────────────────────────────────────────────────────────────────
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

// ─── Tags ────────────────────────────────────────────────────────────────────
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
  // Remove existing chips
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

// ─── Palette drag ────────────────────────────────────────────────────────────
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
    // Click to add
    btn.addEventListener('click', function() {
      addBlock(btn.dataset.type);
      // Scroll to bottom
      var area = document.getElementById('drop-area');
      area.scrollTop = area.scrollHeight;
    });
  });
}

// ─── Drop area ───────────────────────────────────────────────────────────────
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
    if (dragSrcType && !dragSrcId) {
      addBlock(dragSrcType);
    }
    dragSrcType = null;
  });
}

// ─── Block management ────────────────────────────────────────────────────────
function addBlock(type, defaultData) {
  var id = 'block-' + (blockIdCtr++);
  var data = defaultData || getDefaultData(type);
  blocks.push({ id: id, type: type, data: data });

  var hint = document.getElementById('drop-hint');
  if (hint) hint.style.display = 'none';

  var el = createBlockEl(id, type, data);
  document.getElementById('drop-area').appendChild(el);

  // Focus first textarea/input
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

  // Swap in array
  var tmp = blocks[idx];
  blocks[idx] = blocks[newIdx];
  blocks[newIdx] = tmp;

  // Re-render all blocks in correct order
  var area = document.getElementById('drop-area');
  var hint = document.getElementById('drop-hint');
  // Remove all block elements
  area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
  // Re-append in order
  blocks.forEach(function(b) {
    var el = document.getElementById(b.id);
    if (!el) {
      el = createBlockEl(b.id, b.type, b.data);
    }
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
    var lang = sel ? sel.value : 'javascript';
    return JSON.stringify({ lang: lang, code: ta ? ta.value : b.data });
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

// ─── Block element creation ──────────────────────────────────────────────────
function createBlockEl(id, type, data) {
  var el = document.createElement('div');
  el.className = 'editor-block';
  el.id = id;
  el.setAttribute('draggable', 'true');

  // Drag-to-reorder
  el.addEventListener('dragstart', function(e) {
    dragSrcId   = id;
    dragSrcType = null;
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
    // Move dragSrcId block before this block
    var srcIdx  = blocks.findIndex(function(b){ return b.id === dragSrcId; });
    var tgtIdx  = blocks.findIndex(function(b){ return b.id === id; });
    if (srcIdx < 0 || tgtIdx < 0) return;
    var moved = blocks.splice(srcIdx, 1)[0];
    var insertAt = tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx;
    blocks.splice(insertAt, 0, moved);
    // Re-render order
    var area = document.getElementById('drop-area');
    area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
    blocks.forEach(function(b) {
      var bel = document.getElementById(b.id) || createBlockEl(b.id, b.type, b.data);
      area.appendChild(bel);
    });
    refreshPreview();
  });

  // Handle bar
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

  // Content
  var content = buildBlockContent(id, type, data);
  el.appendChild(content);

  return el;
}

function buildBlockContent(id, type, data) {
  var wrap = document.createElement('div');

  if (type === 'markdown') {
    var ta = document.createElement('textarea');
    ta.className = 'markdown-editor';
    ta.placeholder = 'Write Markdown here...';
    ta.value = data;
    ta.addEventListener('input', function() {
      autoResize(ta);
      syncBlockData(id, ta.value);
      refreshPreview();
    });
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    autoResize(ta);
    wrap.appendChild(ta);

  } else if (type === 'heading') {
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'heading-editor';
    inp.placeholder = 'Section heading...';
    inp.value = data;
    inp.addEventListener('input', function() {
      syncBlockData(id, inp.value);
      refreshPreview();
    });
    inp.addEventListener('focus', function(){ activeTextarea = inp; });
    wrap.appendChild(inp);

  } else if (type === 'math') {
    var ta = document.createElement('textarea');
    ta.className = 'math-editor';
    ta.placeholder = 'LaTeX here, e.g.  \\frac{a}{b} = c';
    ta.value = data;
    var preview = document.createElement('div');
    preview.className = 'math-preview';

    function renderMath() {
      syncBlockData(id, ta.value);
      try {
        katex.render(ta.value, preview, { displayMode: true, throwOnError: false });
      } catch(e) {
        preview.textContent = ta.value;
      }
      refreshPreview();
    }
    ta.addEventListener('input', renderMath);
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    wrap.appendChild(ta);
    wrap.appendChild(preview);
    renderMath();

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
    ta.className = 'code-editor';
    ta.placeholder = '// Your code here';
    ta.value = parsed.code || '';
    ta.addEventListener('input', function() {
      syncBlockData(id, JSON.stringify({ lang: sel.value, code: ta.value }));
      refreshPreview();
    });
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    sel.addEventListener('change', function() {
      syncBlockData(id, JSON.stringify({ lang: sel.value, code: ta.value }));
    });
    wrap.appendChild(sel);
    wrap.appendChild(ta);

  } else if (type === 'viz') {
    var inner = document.createElement('div');
    inner.className = 'viz-block-inner';
    var lbl = document.createElement('label');
    lbl.textContent = 'Visualization filename (in visualizations/ folder)';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'viz-filename-input';
    inp.placeholder = 'e.g.  my-chart.html';
    inp.value = data;
    inp.addEventListener('input', function() {
      syncBlockData(id, inp.value);
      refreshPreview();
    });
    var note = document.createElement('p');
    note.className = 'viz-note';
    note.textContent = 'The file will be embedded as an interactive iframe in the published post.';
    inner.appendChild(lbl);
    inner.appendChild(inp);
    inner.appendChild(note);
    wrap.appendChild(inner);

  } else if (type === 'image') {
    var parsed = {};
    try { parsed = JSON.parse(data); } catch(_) { parsed = { url: data || '', alt: '' }; }
    var inner = document.createElement('div');
    inner.className = 'image-block-inner';
    var urlInp = document.createElement('input');
    urlInp.type = 'text';
    urlInp.className = 'image-url-input';
    urlInp.placeholder = 'Image URL or path, e.g. assets/images/photo.jpg';
    urlInp.value = parsed.url || '';
    var altInp = document.createElement('input');
    altInp.type = 'text';
    altInp.className = 'image-alt-input';
    altInp.placeholder = 'Alt text (describe the image)';
    altInp.value = parsed.alt || '';
    var prev = document.createElement('div');
    prev.className = 'image-preview';

    function updateImg() {
      var val = JSON.stringify({ url: urlInp.value, alt: altInp.value });
      syncBlockData(id, val);
      refreshPreview();
      if (urlInp.value) {
        prev.innerHTML = '<img src="' + urlInp.value + '" alt="' + altInp.value + '" style="max-height:160px;border-radius:4px;border:1px solid var(--border);">';
      } else {
        prev.innerHTML = '';
      }
    }
    urlInp.addEventListener('input', updateImg);
    altInp.addEventListener('input', updateImg);
    inner.appendChild(urlInp);
    inner.appendChild(altInp);
    inner.appendChild(prev);
    wrap.appendChild(inner);
    updateImg();

  } else if (type === 'callout') {
    var div = document.createElement('div');
    div.className = 'callout-block';
    var ta = document.createElement('textarea');
    ta.className = 'callout-textarea';
    ta.placeholder = 'Callout text...';
    ta.value = data;
    ta.addEventListener('input', function() {
      autoResize(ta);
      syncBlockData(id, ta.value);
      refreshPreview();
    });
    ta.addEventListener('focus', function(){ activeTextarea = ta; });
    div.appendChild(ta);
    wrap.appendChild(div);

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

// ─── Toolbar helpers ─────────────────────────────────────────────────────────
function wrapActive(before, after) {
  var ta = activeTextarea;
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  var sel   = ta.value.substring(start, end);
  ta.value  = ta.value.substring(0, start) + before + sel + after + ta.value.substring(end);
  ta.selectionStart = start + before.length;
  ta.selectionEnd   = start + before.length + sel.length;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function insertLinkActive() {
  var ta = activeTextarea;
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  var url  = prompt('URL:');
  if (!url) return;
  var text = ta.value.substring(ta.selectionStart, ta.selectionEnd) || 'link text';
  var ins  = '[' + text + '](' + url + ')';
  var s    = ta.selectionStart;
  ta.value = ta.value.substring(0, s) + ins + ta.value.substring(ta.selectionEnd);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function lineStartActive(prefix) {
  var ta = activeTextarea;
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  var s    = ta.selectionStart;
  var lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
  ta.value = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart);
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

// ─── Auto-resize textareas ───────────────────────────────────────────────────
function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = (ta.scrollHeight + 4) + 'px';
}

// ─── Tab switching ───────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  var editArea  = document.getElementById('drop-area');
  var prevPane  = document.getElementById('preview-pane');
  var tabEdit   = document.getElementById('tab-edit');
  var tabSplit  = document.getElementById('tab-split');
  var tabPrev   = document.getElementById('tab-preview');

  tabEdit.classList.remove('active');
  tabSplit.classList.remove('active');
  tabPrev.classList.remove('active');

  if (tab === 'edit') {
    tabEdit.classList.add('active');
    editArea.style.display = '';
    prevPane.classList.remove('visible');
    editArea.style.flex = '1';
  } else if (tab === 'split') {
    tabSplit.classList.add('active');
    editArea.style.display = '';
    prevPane.classList.add('visible');
    editArea.style.flex = '1';
    prevPane.style.flex = '1';
    refreshPreview();
  } else {
    tabPrev.classList.add('active');
    editArea.style.display = 'none';
    prevPane.classList.add('visible');
    prevPane.style.flex = '1';
    refreshPreview();
  }
}

// ─── Preview ─────────────────────────────────────────────────────────────────
function refreshPreview() {
  if (currentTab === 'edit') return;
  var md   = buildMarkdown();
  var html = '';
  if (typeof marked !== 'undefined') {
    marked.setOptions({ gfm: true, breaks: false });
    html = marked.parse(md);
  } else {
    html = '<pre>' + md + '</pre>';
  }

  // Swap viz placeholders
  html = html.replace(/\[viz:\s*([^\]]+)\]/g, function(_, fname) {
    return '<div style="border:1px dashed var(--border);border-radius:6px;padding:1rem;text-align:center;color:var(--ink-light);font-family:var(--font-mono);font-size:0.75rem;margin:1rem 0;">Visualization: ' + fname.trim() + '</div>';
  });
  // Handle VIZ_PLACEHOLDER_ in html
  html = html.replace(/<p>VIZ_PLACEHOLDER_\d+<\/p>/g, function(m) {
    return '<div style="border:1px dashed var(--border);border-radius:6px;padding:1rem;text-align:center;color:var(--ink-light);font-family:var(--font-mono);font-size:0.75rem;margin:1rem 0;">[visualization placeholder]</div>';
  });

  var content = document.getElementById('preview-content');
  content.className = 'preview-pane-inner post-body';
  content.innerHTML = html;

  // Render math in preview
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

// ─── Markdown generation ─────────────────────────────────────────────────────
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
      var parsed = {};
      try { parsed = JSON.parse(data); } catch(_) { parsed = { lang: 'javascript', code: data }; }
      parts.push('```' + (parsed.lang || 'javascript') + '\n' + (parsed.code || '') + '\n```');
    } else if (b.type === 'viz') {
      if (data.trim()) parts.push('[viz: ' + data.trim() + ']');
    } else if (b.type === 'image') {
      var parsed = {};
      try { parsed = JSON.parse(data); } catch(_) { parsed = { url: data, alt: '' }; }
      if (parsed.url) parts.push('![' + (parsed.alt || 'image') + '](' + parsed.url + ')');
    } else if (b.type === 'callout') {
      parts.push('> ' + data.split('\n').join('\n> '));
    } else if (b.type === 'divider') {
      parts.push('\n---\n');
    }
  });
  return parts.join('\n\n');
}

// ─── File generation / modal ─────────────────────────────────────────────────
function generateFiles() {
  var title   = document.getElementById('meta-title').value || 'Untitled Post';
  var date    = document.getElementById('meta-date').value  || new Date().toISOString().slice(0,10);
  var excerpt = document.getElementById('meta-excerpt').value.trim();
  var featured= document.getElementById('opt-featured').checked;
  var slug    = updateSlug();
  var body    = buildMarkdown();

  // Build front-matter
  var tagList = tags.length ? '[' + tags.map(function(t){ return t; }).join(', ') + ']' : '[]';
  var frontMatter = '---\ntitle: ' + title + '\ndate: ' + date + '\ntags: ' + tagList + '\n---\n\n';
  var mdContent = frontMatter + body;

  // JSON entry
  var jsonEntry = {
    slug:     slug,
    title:    title,
    date:     date,
    tags:     tags,
    excerpt:  excerpt || title,
    featured: featured
  };

  var filename = slug + '.md';
  document.getElementById('modal-md-filename').textContent   = 'posts/' + filename;
  document.getElementById('modal-step-fn').textContent        = 'posts/' + filename;
  document.getElementById('modal-md-output').textContent      = mdContent;
  document.getElementById('modal-json-output').textContent    = JSON.stringify(jsonEntry, null, 2);

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// Close modal on overlay click
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function copyOut(elId, btn) {
  var text = document.getElementById(elId).textContent;
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function(){ btn.textContent = orig; }, 1800);
  }).catch(function() {
    // Fallback
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

// ─── Load existing post for editing ──────────────────────────────────────────
async function loadPostForEditing(slug) {
  var BASE = '/BeomBlogs';

  // Show loading state
  var hint = document.getElementById('drop-hint');
  if (hint) hint.textContent = 'Loading post...';

  // Update topbar to show we're editing
  var titleEl = document.querySelector('.topbar-title');
  if (titleEl) titleEl.textContent = '/ editing: ' + slug;

  // 1. Load metadata from index.json
  var meta = null;
  try {
    var res  = await fetch(BASE + '/posts/index.json');
    var list = await res.json();
    meta = list.find(function(p){ return p.slug === slug; });
  } catch(e) {
    console.error('Could not load index.json', e);
  }

  // 2. Populate metadata fields
  if (meta) {
    document.getElementById('meta-title').value   = meta.title   || '';
    document.getElementById('meta-date').value    = meta.date    || '';
    document.getElementById('meta-excerpt').value = meta.excerpt || '';
    document.getElementById('opt-featured').checked = !!meta.featured;
    if (meta.cover && document.getElementById('meta-cover')) {
      document.getElementById('meta-cover').value = meta.cover;
      if (typeof updateCoverPreview === 'function') updateCoverPreview();
    }
    // Load tags
    tags = (meta.tags || []).slice();
    renderTags();
    updateSlug();
  }

  // 3. Load the .md file
  var markdown = '';
  try {
    var res2 = await fetch(BASE + '/posts/' + slug + '.md');
    if (!res2.ok) throw new Error('HTTP ' + res2.status);
    markdown = await res2.text();
  } catch(e) {
    if (hint) hint.textContent = 'Could not load post file: ' + slug + '.md';
    if (hint) hint.style.display = '';
    alert('Could not load post "' + slug + '". Make sure the .md file exists in your posts/ folder.');
    return;
  }

  // 4. Strip front-matter
  var body = markdown.replace(/^---[\s\S]*?---\n?/, '').trim();

  // 5. Parse body into blocks
  //    Strategy: split on fenced code, math blocks, viz tags, headings, dividers.
  //    Everything else becomes a markdown block.
  var lines  = body.split('\n');
  var i      = 0;
  var parsed = []; // array of { type, content }

  while (i < lines.length) {
    var line = lines[i];

    // Fenced code block
    if (line.match(/^```(\w*)$/)) {
      var lang    = line.replace('```','').trim() || 'javascript';
      var codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]); i++;
      }
      i++; // skip closing ```
      parsed.push({ type:'code', content: JSON.stringify({ lang:lang, code:codeLines.join('\n') }) });
      continue;
    }

    // Display math block $$
    if (line.trim() === '$$') {
      var mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]); i++;
      }
      i++; // skip closing $$
      parsed.push({ type:'math', content: mathLines.join('\n').trim() });
      continue;
    }

    // Visualization tag [viz: filename]
    var vizMatch = line.match(/^\[viz:\s*([^\]]+)\]$/);
    if (vizMatch) {
      parsed.push({ type:'viz', content: vizMatch[1].trim() });
      i++; continue;
    }

    // Heading lines (# ## ###)
    var hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      var level = hMatch[1].length === 1 ? 'H1' : hMatch[1].length === 3 ? 'H3' : 'H2';
      parsed.push({ type:'heading', content: JSON.stringify({ level:level, text:hMatch[2] }) });
      i++; continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/) || line.match(/^___+$/)) {
      parsed.push({ type:'divider', content:'' });
      i++; continue;
    }

    // Blockquote → callout
    if (line.match(/^>\s/)) {
      var qLines = [];
      while (i < lines.length && (lines[i].match(/^>\s/) || lines[i].match(/^>$/))) {
        qLines.push(lines[i].replace(/^>\s?/,'')); i++;
      }
      parsed.push({ type:'callout', content: qLines.join('\n') });
      continue;
    }

    // Image line
    var imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      parsed.push({ type:'image', content: JSON.stringify({ alt:imgMatch[1], url:imgMatch[2] }) });
      i++; continue;
    }

    // Everything else: accumulate into a markdown block
    var mdLines = [];
    while (i < lines.length) {
      var l = lines[i];
      // Stop if we hit a special block start
      if (l.match(/^```(\w*)$/) || l.trim()==='$$' || l.match(/^\[viz:/) ||
          l.match(/^(#{1,3})\s/) || l.match(/^---+$/) || l.match(/^!\[[^\]]*\]\([^)]+\)\s*$/)) break;
      mdLines.push(l); i++;
    }
    var mdText = mdLines.join('\n').trim();
    if (mdText) parsed.push({ type:'markdown', content: mdText });
  }

  // 6. Clear the drop area and add parsed blocks
  var area = document.getElementById('drop-area');
  area.querySelectorAll('.editor-block').forEach(function(el){ el.remove(); });
  blocks = []; blockIdCtr = 0;
  if (hint) hint.style.display = 'none';

  parsed.forEach(function(p) {
    addBlock(p.type, p.content);
  });

  // If nothing parsed, add a blank markdown block
  if (!parsed.length) {
    addBlock('markdown', body || 'Write your post here...');
  }

  // Scroll to top
  area.scrollTop = 0;
  console.log('Loaded ' + parsed.length + ' blocks from "' + slug + '"');
}
