/**
 * editor.js — Unified rich writing editor
 * Fixed: load post for editing, table insert, improved slash menu
 */

var tags        = [];
var currentTab  = 'edit';
var lastFocused = null;
var speechRec   = null;
var speechOn    = false;
var previewTimer= null;
var slashStart  = -1;
var editingSlug = null;

// ─── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var d = new Date();
  document.getElementById('meta-date').value =
    d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

  ['post-title','post-subtitle','main-editor'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) {
      autoResize(el);
      el.addEventListener('focus', function(){ lastFocused = el; });
    }
  });

  buildTableGrid();
  buildEmojiPicker();
  initSpeech();
  updateSlug();

  document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('#slash-menu'))   closeSlash();
    if (!e.target.closest('#emoji-picker') && !e.target.closest('[data-picker="emoji"]')) closeEmoji();
    if (!e.target.closest('#table-picker') && !e.target.closest('[data-picker="table"]')) closeTablePicker();
    if (!e.target.closest('#float-toolbar')) {
      setTimeout(function(){ if (!window.getSelection().toString()) hideFloatToolbar(); }, 120);
    }
  });

  document.getElementById('modal').addEventListener('click', function(e){
    if (e.target === this) closeModal();
  });

  document.getElementById('main-editor').focus();
  lastFocused = document.getElementById('main-editor');

  // Check for ?edit=slug
  var params = new URLSearchParams(window.location.search);
  var slug   = params.get('edit');
  if (slug) loadPostForEditing(slug);
});

// ─── Load existing post ────────────────────────────────────────────────────────
async function loadPostForEditing(slug) {
  var BASE = '/BeomBlogs';
  editingSlug = slug;

  var bar = document.getElementById('editing-bar');
  if (bar) { bar.style.display = ''; bar.querySelector('.editing-slug').textContent = slug + '.md'; }
  document.querySelector('.topbar-mode').textContent = 'editing';

  // Load metadata
  try {
    var r    = await fetch(BASE + '/posts/index.json');
    var list = await r.json();
    var meta = list.find(function(p){ return p.slug === slug; });
    if (meta) {
      document.getElementById('post-title').value   = meta.title   || '';
      document.getElementById('meta-date').value    = meta.date    || '';
      document.getElementById('meta-excerpt').value = meta.excerpt || '';
      document.getElementById('opt-featured').checked = !!meta.featured;
      tags = (meta.tags || []).slice();
      renderTags();
      autoResize(document.getElementById('post-title'));
    }
  } catch(e) { console.warn('Could not load index.json', e); }

  // Load markdown body
  try {
    var r2 = await fetch(BASE + '/posts/' + slug + '.md');
    if (!r2.ok) throw new Error('HTTP ' + r2.status);
    var md  = await r2.text();
    // Strip front-matter
    var body = md.replace(/^---[\s\S]*?---\n?/, '').trim();
    // If first line is a blockquote (subtitle), split it out
    var lines = body.split('\n');
    if (lines[0] && lines[0].startsWith('> ')) {
      document.getElementById('post-subtitle').value = lines[0].replace(/^>\s?/, '');
      body = lines.slice(1).join('\n').trimStart();
      autoResize(document.getElementById('post-subtitle'));
    }
    document.getElementById('main-editor').value = body;
    autoResize(document.getElementById('main-editor'));
    updateSlug();
    updateWC();
  } catch(e) {
    alert('Could not load post "' + slug + '". Check it exists in posts/ folder.');
  }
}

// ─── Auto-resize ───────────────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';
}

// ─── Word count ────────────────────────────────────────────────────────────────
function updateWC() {
  var t = (document.getElementById('post-title').value + ' ' + document.getElementById('main-editor').value).trim();
  var w = t ? t.split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('word-count').textContent = w + ' word' + (w===1?'':'s');
}

// ─── Slug ──────────────────────────────────────────────────────────────────────
function updateSlug() {
  var title = document.getElementById('post-title').value;
  var slug  = title.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim()
                   .replace(/\s+/g,'-').replace(/-+/g,'-') || 'my-post';
  document.getElementById('slug-display').textContent = slug;
  return slug;
}

// ─── Tags ──────────────────────────────────────────────────────────────────────
function handleTagInput(e) {
  if (e.key==='Enter'||e.key===',') {
    e.preventDefault();
    var v = e.target.value.replace(/,/g,'').trim();
    if (v && !tags.includes(v)) { tags.push(v); renderTags(); }
    e.target.value = '';
  } else if (e.key==='Backspace' && !e.target.value && tags.length) {
    tags.pop(); renderTags();
  }
}
function renderTags() {
  var wrap = document.getElementById('tags-wrap');
  var inp  = document.getElementById('tag-input');
  wrap.querySelectorAll('.tag-chip').forEach(function(c){ c.remove(); });
  tags.forEach(function(tag,i){
    var chip = document.createElement('span'); chip.className='tag-chip';
    chip.innerHTML = tag+'<button class="tag-chip-rm" onclick="removeTag('+i+')">×</button>';
    wrap.insertBefore(chip,inp);
  });
}
function removeTag(i){ tags.splice(i,1); renderTags(); }

// ─── Insert helpers ────────────────────────────────────────────────────────────
function getTA() {
  var ta = lastFocused;
  if (!ta || ta.tagName!=='TEXTAREA') ta = document.getElementById('main-editor');
  return ta;
}

function insertSnippet(before, after) {
  var ta  = getTA();
  before  = before.replace(/\\n/g,'\n');
  after   = after.replace(/\\n/g,'\n');
  var s   = ta.selectionStart, e = ta.selectionEnd;
  var sel = ta.value.substring(s,e);
  ta.value = ta.value.substring(0,s) + before + sel + after + ta.value.substring(e);
  var cur  = s + before.length + (sel ? sel.length : 0);
  ta.selectionStart = ta.selectionEnd = cur;
  ta.focus(); lastFocused = ta;
  autoResize(ta); updateWC(); schedulePreview();
}

function insertAtCursor(text) {
  var ta = getTA();
  var s  = ta.selectionStart;
  ta.value = ta.value.substring(0,s) + text + ta.value.substring(s);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.focus(); lastFocused = ta;
  autoResize(ta); updateWC(); schedulePreview();
}

function insertLink() {
  var ta  = getTA();
  var sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
  var url = prompt('Enter URL:'); if (!url) return;
  var txt = sel || prompt('Link text:') || 'link';
  insertSnippet('['+txt+'](',''+url+')');
}

// ─── Key handler ───────────────────────────────────────────────────────────────
function handleEditorKey(e) {
  var ta  = e.target;
  var pos = ta.selectionStart;

  if (e.key==='Tab') {
    e.preventDefault();
    ta.value = ta.value.substring(0,pos)+'  '+ta.value.substring(pos);
    ta.selectionStart = ta.selectionEnd = pos+2;
    return;
  }

  if (e.key==='/' && !e.ctrlKey && !e.metaKey) {
    var ls      = ta.value.lastIndexOf('\n', pos-1)+1;
    var content = ta.value.substring(ls,pos).trim();
    if (content==='') {
      slashStart = pos;
      setTimeout(function(){ positionSlashMenu(ta); }, 10);
    }
    return;
  }

  if (e.key==='Escape') { closeSlash(); return; }

  if (slashStart>=0 && e.key!=='Enter' && e.key!=='ArrowUp' && e.key!=='ArrowDown') {
    setTimeout(function(){
      var typed = ta.value.substring(slashStart+1, ta.selectionStart).toLowerCase();
      if (typed.includes('\n')) { closeSlash(); return; }
      filterSlashMenu(typed);
    },10);
  }

  // Enter on new line: auto-continue list
  if (e.key==='Enter') {
    var lineStart = ta.value.lastIndexOf('\n',pos-1)+1;
    var line      = ta.value.substring(lineStart,pos);
    var bulletM   = line.match(/^(\s*)([-*+])\s/);
    var numM      = line.match(/^(\s*)(\d+)\.\s/);
    if (bulletM) {
      e.preventDefault();
      insertAtCursor('\n'+bulletM[1]+bulletM[2]+' ');
    } else if (numM) {
      e.preventDefault();
      insertAtCursor('\n'+numM[1]+(parseInt(numM[2])+1)+'. ');
    }
  }
}

// ─── Slash menu ────────────────────────────────────────────────────────────────
function positionSlashMenu(ta) {
  var menu   = document.getElementById('slash-menu');
  var rect   = ta.getBoundingClientRect();
  var lines  = ta.value.substring(0, ta.selectionStart).split('\n');
  var lineH  = parseFloat(getComputedStyle(ta).lineHeight) || 26;
  var top    = rect.top + (lines.length * lineH) - ta.scrollTop + 4;
  var left   = rect.left + 14;
  if (top + 320 > window.innerHeight) top = top - 320;
  if (left + 260 > window.innerWidth) left = window.innerWidth - 265;
  menu.style.top  = Math.max(8, top)  + 'px';
  menu.style.left = Math.max(8, left) + 'px';
  menu.classList.add('visible');
  filterSlashMenu('');
}

function filterSlashMenu(q) {
  document.querySelectorAll('.slash-item').forEach(function(item){
    var label = item.querySelector('.slash-label').textContent.toLowerCase();
    item.style.display = (!q || label.includes(q)) ? '' : 'none';
  });
}

function doSlash(btn) {
  var ta     = document.getElementById('main-editor');
  var before = btn.dataset.insert.replace(/\\n/g,'\n');
  var after  = (btn.dataset.after||'').replace(/\\n/g,'\n');
  if (slashStart>=0) {
    var typed = ta.value.substring(slashStart, ta.selectionStart);
    ta.value  = ta.value.substring(0,slashStart) + ta.value.substring(slashStart+typed.length);
    ta.selectionStart = ta.selectionEnd = slashStart;
  }
  lastFocused = ta;
  insertSnippet(before, after);
  closeSlash();
  ta.focus();
}

function closeSlash() {
  document.getElementById('slash-menu').classList.remove('visible');
  slashStart = -1;
}

// ─── Float toolbar ─────────────────────────────────────────────────────────────
function showFloatToolbar() {
  var sel  = window.getSelection();
  var text = sel.toString();
  var tb   = document.getElementById('float-toolbar');
  if (!text || text.length<1) { hideFloatToolbar(); return; }
  var range = sel.getRangeAt(0);
  var rect  = range.getBoundingClientRect();
  var tbW   = 260;
  var left  = rect.left + rect.width/2 - tbW/2;
  if (left < 8) left = 8;
  if (left + tbW > window.innerWidth) left = window.innerWidth - tbW - 8;
  tb.style.top  = (rect.top + window.scrollY - 48) + 'px';
  tb.style.left = left + 'px';
  tb.classList.add('visible');
}
function hideFloatToolbar() {
  document.getElementById('float-toolbar').classList.remove('visible');
}
function ftWrap(b,a){ insertSnippet(b,a); hideFloatToolbar(); }
function ftLink()    { insertLink();      hideFloatToolbar(); }
function ftHeading() {
  var ta=getTA(), pos=ta.selectionStart, ls=ta.value.lastIndexOf('\n',pos-1)+1;
  ta.value=ta.value.substring(0,ls)+'## '+ta.value.substring(ls);
  ta.focus(); autoResize(ta); schedulePreview(); hideFloatToolbar();
}

// ─── Table picker (FIXED) ──────────────────────────────────────────────────────
function buildTableGrid() {
  var grid = document.getElementById('table-grid');
  if (!grid) return;
  grid.innerHTML = '';
  var ROWS=5, COLS=6;
  for (var r=1;r<=ROWS;r++) {
    for (var c=1;c<=COLS;c++) {
      var cell      = document.createElement('div');
      cell.className= 'table-cell';
      cell.dataset.r= r;
      cell.dataset.c= c;
      (function(row,col){
        cell.addEventListener('mouseover', function(){
          document.querySelectorAll('.table-cell').forEach(function(cl){
            cl.classList.toggle('hover', +cl.dataset.r<=row && +cl.dataset.c<=col);
          });
          var lbl = document.getElementById('table-size-label');
          if (lbl) lbl.textContent = row+' × '+col+' table — click to insert';
        });
        cell.addEventListener('click', function(e){
          e.stopPropagation();
          doInsertTable(row, col);
        });
      })(r,c);
      grid.appendChild(cell);
    }
  }
}

function doInsertTable(rows, cols) {
  var header  = '| '+Array.from({length:cols},function(_,i){ return 'Col '+(i+1); }).join(' | ')+' |';
  var sep     = '| '+Array(cols).fill('---').join(' | ')+'  |';
  var dataRow = '| '+Array(cols).fill('      ').join(' | ')+'  |';
  var lines   = ['\n', header, sep];
  for (var i=0;i<rows;i++) lines.push(dataRow);
  lines.push('\n');
  insertAtCursor(lines.join('\n'));
  closeTablePicker();
}

function showTablePicker(e) {
  var picker = document.getElementById('table-picker');
  var rect   = e.target.getBoundingClientRect();
  var top    = rect.bottom + 6;
  var left   = rect.left;
  if (left + 180 > window.innerWidth) left = window.innerWidth - 186;
  if (top  + 180 > window.innerHeight) top = rect.top - 180;
  picker.style.top  = top  + 'px';
  picker.style.left = left + 'px';
  picker.classList.add('visible');
  e.stopPropagation();
  // Reset highlights
  document.querySelectorAll('.table-cell').forEach(function(c){ c.classList.remove('hover'); });
  var lbl = document.getElementById('table-size-label');
  if (lbl) lbl.textContent = 'Hover to pick size';
}

function closeTablePicker() {
  var p = document.getElementById('table-picker');
  if (p) p.classList.remove('visible');
}

// ─── Emoji picker ──────────────────────────────────────────────────────────────
var emojiData = {
  'Smileys':['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😎','🤩','🥳','😏','😔','😟','😢','😭','😤','😠','🤬','🤯','😳','🥵','🥶','😱','😰','🤗','🤔','🤫','🤥','😶','😬','🙄','😮','🥱','😴','🤤','😷','🤒','🤕','🤧','🥴','🤢'],
  'People' :['👋','✋','👌','✌️','👍','👎','✊','👏','🙌','🙏','💪','👀','👁','👅','👄','👶','🧒','👦','👧','🧑','👱','👨','👩','🧓','👴','👵','🧔','👮','🕵️','💂','👷','🤴','👸','🧙','🧝','🧛','🧟','🧞','🧜','🧚','👼','🎅','🤶','🦸','🦹'],
  'Nature' :['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐟','🐠','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🐈','🌸','🌺','🌻','🌹','🌷','🌿','🍀','🌱','🌲','🌳','🌴','🌵','🎋','🎍','🍁','🍂','🍃','🌾','🍄','🌰','🦔','🐿'],
  'Food'   :['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🍤','🍙','🍚','🍘','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧊'],
  'Travel' :['🚗','🚕','🚙','🚌','🏎','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🏍','🛵','🚲','🛴','🛺','✈️','🚀','🛸','🚁','⛵','🚤','🛳','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚞','🚝','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🛻','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏭','🏯','🏰','🏛','⛺','🌍','🌎','🌏','🌐','🗺','🧭','⛰','🌋','🏔','🗻','🏕','🏖','🏜','🏝','🏞','🌅','🌄','🌠','🎇','🎆','🌃','🌆','🌇','🌉','🌌','🌁'],
  'Objects':['⌚','📱','💻','⌨️','🖥','🖨','🖱','💽','💾','💿','📷','📸','📹','🎥','📞','☎️','📺','📻','🧭','⏰','📡','🔋','🔌','💡','🔦','🕯','💰','💳','📈','📉','📊','📋','📌','📍','📎','✂️','🔒','🔓','🔑','🔨','⚔️','🛡','🔧','🔩','⚙️','🔗','🧪','🧫','🧬','🔭','🔬','💊','🩺','🩻','📚','📖','📝','✏️','🖊','🖋','📓','📔','📒','📕','📗','📘','📙','📚','📰','🗞','📄','📃','📑','📊','📈','📉','🗒','🗓','📆','📅','📇','🗃','🗄','🗑','📂','📁','🗂','🗳','📬','📭','📮','📯','📢','📣','🔔','🔕','🎵','🎶','🎙','🎚','🎛','📻','🎤','🎧','📺','🎬','🎭','🎨','🖼','🎪','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎀','🎁','🎊','🎉','🎈','🎋','🎍','🎎','🎏','🎐','🎑','🧧','🎃','🎄','🎆','🎇','🧨','✨','🎠','🎡','🎢','🎪','🎭','🖼','🎨','🎰','🚂'],
  'Symbols':['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','✅','❌','⭕','🛑','⚠️','🔰','♻️','💯','🆘','❗','❓','‼️','⁉️','🔅','🔆','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','➕','➖','➗','✖️','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯','♠️','♣️','♥️','♦️','🃏','🎴']
};
var currentEmojiCat = 'Smileys';

function buildEmojiPicker() {
  var catsEl = document.getElementById('emoji-cats');
  Object.keys(emojiData).forEach(function(cat){
    var btn = document.createElement('button'); btn.className='emoji-cat-btn'; btn.textContent=cat;
    if (cat===currentEmojiCat) btn.classList.add('active');
    btn.addEventListener('click', function(){
      currentEmojiCat=cat;
      catsEl.querySelectorAll('.emoji-cat-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      renderEmojiGrid(emojiData[cat]);
      document.getElementById('emoji-search').value='';
    });
    catsEl.appendChild(btn);
  });
  renderEmojiGrid(emojiData[currentEmojiCat]);
}

function renderEmojiGrid(list) {
  var grid = document.getElementById('emoji-grid'); grid.innerHTML='';
  list.forEach(function(em){
    var btn=document.createElement('button'); btn.className='emoji-btn'; btn.textContent=em;
    btn.addEventListener('click',function(){ insertAtCursor(em); closeEmoji(); });
    grid.appendChild(btn);
  });
}

function filterEmoji() {
  var q = document.getElementById('emoji-search').value.toLowerCase();
  if (!q) { renderEmojiGrid(emojiData[currentEmojiCat]); return; }
  var all = [].concat.apply([], Object.values(emojiData));
  renderEmojiGrid(all.slice(0,200));
}

function showEmojiPicker(e) {
  var picker = document.getElementById('emoji-picker');
  var rect   = e.currentTarget.getBoundingClientRect();
  var top    = rect.bottom+6, left = rect.left;
  if (left+310>window.innerWidth)  left=window.innerWidth-316;
  if (top+310 >window.innerHeight) top=rect.top-320;
  picker.style.top=Math.max(4,top)+'px'; picker.style.left=Math.max(4,left)+'px';
  picker.classList.add('visible');
  document.getElementById('emoji-search').focus();
  e.stopPropagation();
}
function closeEmoji(){ document.getElementById('emoji-picker').classList.remove('visible'); }

// ─── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab=tab;
  ['edit','split','preview'].forEach(function(t){
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  var wa   = document.getElementById('writing-area');
  var prev = document.getElementById('preview-pane');
  if (tab==='edit') {
    wa.style.display=''; wa.style.flex=''; prev.classList.remove('visible');
  } else if (tab==='split') {
    wa.style.display=''; wa.style.flex='1'; prev.classList.add('visible'); prev.style.flex='1'; renderPreview();
  } else {
    wa.style.display='none'; prev.classList.add('visible'); prev.style.flex='1'; renderPreview();
  }
}

// ─── Preview ───────────────────────────────────────────────────────────────────
function schedulePreview() {
  if (currentTab==='edit') return;
  clearTimeout(previewTimer);
  previewTimer=setTimeout(renderPreview,300);
}
function renderPreview() {
  var title = document.getElementById('post-title').value;
  var sub   = document.getElementById('post-subtitle').value.trim();
  var body  = document.getElementById('main-editor').value;
  var md    = '';
  if (title) md += '# '+title+'\n\n';
  if (sub)   md += '*'+sub+'*\n\n';
  md += body;
  md = md.replace(/\[viz:\s*([^\]]+)\]/g, function(_,f){
    return '\n> 📊 **Visualization:** `'+f.trim()+'`\n';
  });
  var html = typeof marked!=='undefined' ? marked.parse(md) : '<pre>'+md+'</pre>';
  var el   = document.getElementById('preview-content');
  el.innerHTML=html;
  if (typeof renderMathInElement!=='undefined') {
    renderMathInElement(el,{
      delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
      throwOnError:false
    });
  }
}

// ─── Speech ────────────────────────────────────────────────────────────────────
function initSpeech() {
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SR) {
    var btn=document.getElementById('mic-btn');
    if (btn){ btn.style.opacity='0.35'; btn.title='Speech needs Chrome/Edge'; }
    return;
  }
  speechRec=new SR(); speechRec.continuous=true; speechRec.interimResults=true; speechRec.lang='en-US';
  speechRec.addEventListener('result',function(e){
    var final='',interim='';
    for (var i=e.resultIndex;i<e.results.length;i++){
      if (e.results[i].isFinal) final+=e.results[i][0].transcript;
      else interim+=e.results[i][0].transcript;
    }
    if (final) {
      var ta=lastFocused||document.getElementById('main-editor');
      if (ta&&ta.tagName==='TEXTAREA'){
        var s=ta.selectionStart;
        ta.value=ta.value.substring(0,s)+final+' '+ta.value.substring(s);
        ta.selectionStart=ta.selectionEnd=s+final.length+1;
        ta.dispatchEvent(new Event('input')); autoResize(ta);
      }
    }
    setSpeechStatus(interim?'🎤 '+interim.substring(0,60)+'…':'🎤 Listening…');
  });
  speechRec.addEventListener('error',function(e){ setSpeechStatus('Error: '+e.error); stopSpeech(); });
  speechRec.addEventListener('end',  function(){ if(speechOn) speechRec.start(); });
}
function toggleSpeech(){
  if(!speechRec){alert('Speech recognition requires Chrome or Edge.');return;}
  speechOn?stopSpeech():startSpeech();
}
function startSpeech(){
  speechOn=true; speechRec.start();
  document.getElementById('mic-btn').classList.add('active');
  setSpeechStatus('🎤 Listening…');
}
function stopSpeech(){
  speechOn=false; try{speechRec.stop();}catch(_){}
  document.getElementById('mic-btn').classList.remove('active');
  setSpeechStatus('Stopped.');
}
function setSpeechStatus(msg){
  var el=document.getElementById('speech-status'); if(el) el.textContent=msg;
}

// ─── Generate / publish ────────────────────────────────────────────────────────
function generateFiles() {
  var title    = document.getElementById('post-title').value||'Untitled Post';
  var subtitle = document.getElementById('post-subtitle').value.trim();
  var body     = document.getElementById('main-editor').value;
  var date     = document.getElementById('meta-date').value||new Date().toISOString().slice(0,10);
  var excerpt  = document.getElementById('meta-excerpt').value.trim()||subtitle||title;
  var featured = document.getElementById('opt-featured').checked;
  var slug     = editingSlug || updateSlug();

  var tagList  = tags.length?'['+tags.join(', ')+']':'[]';
  var fm       = '---\ntitle: '+title+'\ndate: '+date+'\ntags: '+tagList+'\n---\n\n';
  var fullBody = subtitle?'> '+subtitle+'\n\n'+body:body;
  var mdContent= fm+fullBody;

  var entry    = {slug:slug,title:title,date:date,tags:tags.slice(),excerpt:excerpt,featured:featured};
  var filename = slug+'.md';

  document.getElementById('modal-filename').textContent='posts/'+filename;
  document.getElementById('modal-step-fn').textContent ='posts/'+filename;
  document.getElementById('modal-md').textContent      =mdContent;
  document.getElementById('modal-json').textContent    =JSON.stringify(entry,null,2);

  var isEdit = !!editingSlug;
  document.getElementById('modal-json-label').textContent = isEdit
    ? 'Only needed if title/date/tags/excerpt changed — update the matching entry in posts/index.json'
    : 'Step 2 — Add to posts/index.json';

  document.getElementById('modal').classList.add('open');
  window._mdContent=mdContent; window._mdFilename=filename;
}

function closeModal(){ document.getElementById('modal').classList.remove('open'); }

function copyOut(elId,btn){
  var text=document.getElementById(elId).textContent;
  navigator.clipboard.writeText(text).then(function(){
    var o=btn.textContent; btn.textContent='✓ Copied!';
    setTimeout(function(){btn.textContent=o;},1800);
  }).catch(function(){
    var ta=document.createElement('textarea'); ta.value=text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    var o=btn.textContent; btn.textContent='✓ Copied!';
    setTimeout(function(){btn.textContent=o;},1800);
  });
}

function downloadMd(){
  if(!window._mdContent) return;
  var blob=new Blob([window._mdContent],{type:'text/markdown'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=window._mdFilename; a.click(); URL.revokeObjectURL(a.href);
}
