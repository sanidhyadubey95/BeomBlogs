/**
 * editor.js — Unified rich writing editor
 * Single textarea approach with floating toolbar, slash commands,
 * emoji picker, table picker, speech-to-text.
 */

// ─── State ────────────────────────────────────────────────────────────────────
var tags        = [];
var currentTab  = 'edit';
var lastFocused = null;
var speechRec   = null;
var speechOn    = false;
var previewTimer= null;
var slashStart  = -1; // cursor position where / was typed

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Set today's date
  var d = new Date();
  document.getElementById('meta-date').value =
    d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

  // Auto-resize all textareas on load
  ['post-title','post-subtitle','main-editor'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { autoResize(el); el.addEventListener('focus', function(){ lastFocused = el; }); }
  });

  buildTableGrid();
  buildEmojiPicker();
  initSpeech();
  updateSlug();

  // Close popups on outside click
  document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('#slash-menu'))   closeSlash();
    if (!e.target.closest('#emoji-picker') && !e.target.closest('.ib-btn')) closeEmoji();
    if (!e.target.closest('#table-picker') && !e.target.closest('.ib-btn')) closeTablePicker();
    if (!e.target.closest('#float-toolbar')) {
      setTimeout(function(){ if (!window.getSelection().toString()) hideFloatToolbar(); }, 100);
    }
  });

  document.getElementById('main-editor').focus();
  lastFocused = document.getElementById('main-editor');
});

// ─── Auto-resize textarea ─────────────────────────────────────────────────────
function autoResize(el) {
  // Lock the scroll container so the page doesn't jump when height changes
  var scroller = document.getElementById('editor-scroll');
  var scrollTop = scroller ? scroller.scrollTop : window.scrollY;

  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';

  // Restore scroll position immediately after resize
  if (scroller) {
    scroller.scrollTop = scrollTop;
  } else {
    window.scrollTo(0, scrollTop);
  }
}

// ─── Word count ───────────────────────────────────────────────────────────────
function updateWC() {
  var title = document.getElementById('post-title').value;
  var body  = document.getElementById('main-editor').value;
  var words = (title + ' ' + body).trim().split(/\s+/).filter(function(w){ return w.length > 0; }).length;
  document.getElementById('word-count').textContent = words + ' word' + (words === 1 ? '' : 's');
}

// ─── Slug ─────────────────────────────────────────────────────────────────────
function updateSlug() {
  var title = document.getElementById('post-title').value;
  var slug  = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'').trim()
    .replace(/\s+/g,'-').replace(/-+/g,'-') || 'my-post';
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
  } else if (e.key === 'Backspace' && !e.target.value && tags.length) {
    tags.pop(); renderTags();
  }
}
function renderTags() {
  var wrap = document.getElementById('tags-wrap');
  var inp  = document.getElementById('tag-input');
  wrap.querySelectorAll('.tag-chip').forEach(function(c){ c.remove(); });
  tags.forEach(function(tag, i) {
    var chip = document.createElement('span'); chip.className = 'tag-chip';
    chip.innerHTML = tag + '<button class="tag-chip-rm" onclick="removeTag('+i+')">×</button>';
    wrap.insertBefore(chip, inp);
  });
}
function removeTag(i) { tags.splice(i,1); renderTags(); }

// ─── Insert helpers ───────────────────────────────────────────────────────────
function getTA() {
  // Use lastFocused, defaulting to main editor
  var ta = lastFocused;
  if (!ta || (ta.tagName !== 'TEXTAREA' && ta.tagName !== 'INPUT')) {
    ta = document.getElementById('main-editor');
  }
  return ta;
}

function insertSnippet(before, after) {
  var ta  = getTA();
  var s   = ta.selectionStart, e = ta.selectionEnd;
  var sel = ta.value.substring(s, e);
  // Fix escaped newlines in string literals
  before = before.replace(/\\n/g, '\n');
  after  = after.replace(/\\n/g, '\n');
  ta.value = ta.value.substring(0,s) + before + sel + after + ta.value.substring(e);
  var cur = s + before.length + sel.length;
  ta.selectionStart = ta.selectionEnd = cur;
  ta.focus(); lastFocused = ta;
  autoResize(ta); updateWC(); schedulePreview();
}

function insertLink() {
  var ta  = getTA();
  var sel = ta.value.substring(ta.selectionStart, ta.selectionEnd) || 'link text';
  var url = prompt('URL:'); if (!url) return;
  insertSnippet('[' + sel + '](', url + ')');
}

// ─── Editor key handler (slash menu + tab indent) ─────────────────────────────
function handleEditorKey(e) {
  var ta  = e.target;
  var pos = ta.selectionStart;

  // Tab → indent with 2 spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    ta.value = ta.value.substring(0,pos) + '  ' + ta.value.substring(pos);
    ta.selectionStart = ta.selectionEnd = pos + 2;
    return;
  }

  // Slash at line start → show slash menu
  if (e.key === '/') {
    var lineStart = ta.value.lastIndexOf('\n', pos-1) + 1;
    var lineContent = ta.value.substring(lineStart, pos).trim();
    if (lineContent === '') {
      slashStart = pos;
      setTimeout(function(){ positionSlashMenu(ta); }, 10);
    }
    return;
  }

  // Close slash menu on Escape or Enter (if not navigating menu)
  if (e.key === 'Escape') { closeSlash(); return; }

  // If slash menu open and user keeps typing, filter it
  if (slashStart >= 0 && e.key !== 'Enter') {
    setTimeout(function(){
      var typed = ta.value.substring(slashStart + 1, ta.selectionStart).toLowerCase();
      filterSlashMenu(typed);
    }, 10);
  }
}

// ─── Slash menu ───────────────────────────────────────────────────────────────
function positionSlashMenu(ta) {
  var menu  = document.getElementById('slash-menu');
  var rect  = ta.getBoundingClientRect();
  // Approximate caret position using line height
  var lines = ta.value.substring(0, ta.selectionStart).split('\n');
  var lineH = 28; // approx line height in px
  var top   = rect.top + (lines.length * lineH) - ta.scrollTop + 10;
  var left  = rect.left + 16;
  if (top + 280 > window.innerHeight) top = top - 280;
  menu.style.top  = top + 'px';
  menu.style.left = left + 'px';
  menu.classList.add('visible');
}

function filterSlashMenu(query) {
  var items = document.querySelectorAll('.slash-item');
  items.forEach(function(item) {
    var label = item.querySelector('.slash-label').textContent.toLowerCase();
    item.style.display = (!query || label.includes(query)) ? '' : 'none';
  });
}

function doSlash(btn) {
  var ta     = document.getElementById('main-editor');
  var before = btn.dataset.insert.replace(/\\n/g, '\n');
  var after  = (btn.dataset.after || '').replace(/\\n/g, '\n');
  // Remove the slash character that triggered the menu
  if (slashStart >= 0) {
    var typed = ta.value.substring(slashStart, ta.selectionStart);
    ta.value  = ta.value.substring(0, slashStart) + ta.value.substring(slashStart + typed.length);
    ta.selectionStart = ta.selectionEnd = slashStart;
  }
  insertSnippet(before, after);
  closeSlash();
}

function closeSlash() {
  document.getElementById('slash-menu').classList.remove('visible');
  slashStart = -1;
}

// ─── Float toolbar ────────────────────────────────────────────────────────────
function showFloatToolbar() {
  var sel  = window.getSelection();
  var text = sel.toString();
  var tb   = document.getElementById('float-toolbar');
  if (!text || text.length < 1) { hideFloatToolbar(); return; }
  var range = sel.getRangeAt(0);
  var rect  = range.getBoundingClientRect();
  tb.style.top  = (rect.top + window.scrollY - 44) + 'px';
  tb.style.left = (rect.left + rect.width/2 - 120) + 'px';
  tb.classList.add('visible');
}

function hideFloatToolbar() {
  document.getElementById('float-toolbar').classList.remove('visible');
}

function ftWrap(before, after) {
  insertSnippet(before, after);
  hideFloatToolbar();
}

function ftLink() {
  insertLink();
  hideFloatToolbar();
}

function ftHeading() {
  var ta  = getTA();
  var pos = ta.selectionStart;
  var ls  = ta.value.lastIndexOf('\n', pos-1) + 1;
  ta.value = ta.value.substring(0,ls) + '## ' + ta.value.substring(ls);
  ta.focus(); autoResize(ta); schedulePreview();
  hideFloatToolbar();
}

// ─── Table picker ─────────────────────────────────────────────────────────────
function buildTableGrid() {
  var grid  = document.getElementById('table-grid');
  var ROWS  = 5, COLS = 6;
  for (var r = 1; r <= ROWS; r++) {
    for (var c = 1; c <= COLS; c++) {
      var cell = document.createElement('div');
      cell.className = 'table-cell';
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener('mouseover', highlightTable);
      cell.addEventListener('click', insertTable);
      grid.appendChild(cell);
    }
  }
}

function highlightTable(e) {
  var r = +e.target.dataset.r, c = +e.target.dataset.c;
  document.querySelectorAll('.table-cell').forEach(function(cell) {
    cell.classList.toggle('hover', +cell.dataset.r <= r && +cell.dataset.c <= c);
  });
  document.getElementById('table-size-label').textContent = r + ' × ' + c + ' table';
}

function insertTable(e) {
  var rows = +e.target.dataset.r, cols = +e.target.dataset.c;
  var header = '| ' + Array(cols).fill('Col').map(function(v,i){ return v+(i+1); }).join(' | ') + ' |';
  var sep    = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  var row    = '| ' + Array(cols).fill('     ').join(' | ') + ' |';
  var rowsArr = [row];
  for (var i = 1; i < rows; i++) rowsArr.push(row);
  var table = '\n' + header + '\n' + sep + '\n' + rowsArr.join('\n') + '\n';
  insertSnippet(table, '');
  closeTablePicker();
}

function showTablePicker(e) {
  var picker = document.getElementById('table-picker');
  var rect   = e.target.getBoundingClientRect();
  picker.style.top  = (rect.bottom + 6) + 'px';
  picker.style.left = rect.left + 'px';
  picker.classList.add('visible');
  e.stopPropagation();
}

function closeTablePicker() {
  document.getElementById('table-picker').classList.remove('visible');
}

// ─── Emoji picker ─────────────────────────────────────────────────────────────
var emojiData = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🫠','🤗','🤔','🫣','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🫥','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  'People': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🫶','🙌','👐','🤲','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','🫦','💋','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵'],
  'Nature': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐟','🐠','🐬','🦭','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'],
  'Food': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🫖','🍵','🧉','🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧊'],
  'Travel': ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🛞','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🛶','🚤','🛳','⛴','🛥','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰','🚀','🛸','🪐','⭐','🌙','☀️','⛅','🌈','🌊','🗻','🏔','⛰','🌋','🗾','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽'],
  'Objects': ['⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','💽','💾','💿','📀','🧮','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯','🪔','🧯','🛢','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌','📍','📎','🖇','📏','📐','✂️','🗃','🗄','🗑','🔒','🔓','🔏','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔️','🛡','🪚','🔧','🪛','🔩','⚙️','🗜','🔗','⛓','🪝','🧲','🪜','⚗️','🧪','🧫','🧬','🔭','🔬'],
  'Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','⏏️','▶️','⏸','⏹','⏺','⏭','⏮','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','♾','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','👁‍🗨','💬','💭','🗯','♠️','♣️','♥️','♦️','🃏','🎴','🀄']
};

var currentEmojiCat = 'Smileys';

function buildEmojiPicker() {
  var catsEl  = document.getElementById('emoji-cats');
  var gridEl  = document.getElementById('emoji-grid');
  Object.keys(emojiData).forEach(function(cat) {
    var btn = document.createElement('button'); btn.className = 'emoji-cat-btn'; btn.textContent = cat;
    if (cat === currentEmojiCat) btn.classList.add('active');
    btn.addEventListener('click', function() {
      currentEmojiCat = cat;
      catsEl.querySelectorAll('.emoji-cat-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      renderEmojiGrid(emojiData[cat]);
    });
    catsEl.appendChild(btn);
  });
  renderEmojiGrid(emojiData[currentEmojiCat]);
}

function renderEmojiGrid(list) {
  var grid = document.getElementById('emoji-grid'); grid.innerHTML = '';
  list.forEach(function(em) {
    var btn = document.createElement('button'); btn.className = 'emoji-btn'; btn.textContent = em;
    btn.title = em;
    btn.addEventListener('click', function() { insertSnippet(em,''); closeEmoji(); });
    grid.appendChild(btn);
  });
}

function filterEmoji() {
  var q = document.getElementById('emoji-search').value.toLowerCase();
  if (!q) { renderEmojiGrid(emojiData[currentEmojiCat]); return; }
  var all = [].concat.apply([], Object.values(emojiData));
  renderEmojiGrid(all.filter(function(e){ return e.toLowerCase().includes(q); }).slice(0,64));
}

function showEmojiPicker(e) {
  var picker = document.getElementById('emoji-picker');
  var rect   = e.target.getBoundingClientRect();
  var top    = rect.bottom + 6;
  var left   = rect.left;
  if (left + 310 > window.innerWidth) left = window.innerWidth - 316;
  if (top + 310 > window.innerHeight) top = rect.top - 320;
  picker.style.top  = top + 'px';
  picker.style.left = left + 'px';
  picker.classList.add('visible');
  document.getElementById('emoji-search').focus();
  e.stopPropagation();
}

function closeEmoji() { document.getElementById('emoji-picker').classList.remove('visible'); }

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  ['edit','split','preview'].forEach(function(t){
    document.getElementById('tab-'+t).classList.remove('active');
  });
  document.getElementById('tab-'+tab).classList.add('active');

  var wa   = document.getElementById('writing-area');
  var prev = document.getElementById('preview-pane');

  if (tab === 'edit') {
    wa.style.display = ''; prev.classList.remove('visible');
  } else if (tab === 'split') {
    wa.style.display = ''; wa.style.flex = '1';
    prev.classList.add('visible'); prev.style.flex = '1';
    renderPreview();
  } else {
    wa.style.display = 'none';
    prev.classList.add('visible'); prev.style.flex = '1';
    renderPreview();
  }
}

// ─── Preview ─────────────────────────────────────────────────────────────────
function schedulePreview() {
  if (currentTab === 'edit') return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 300);
}

function renderPreview() {
  var title = document.getElementById('post-title').value;
  var body  = document.getElementById('main-editor').value;
  var md    = (title ? '# ' + title + '\n\n' : '') + body;

  // Handle [viz: file] as placeholder in preview
  md = md.replace(/\[viz:\s*([^\]]+)\]/g, function(_, f) {
    return '\n> **Visualization:** `' + f.trim() + '`\n';
  });

  var html = typeof marked !== 'undefined' ? marked.parse(md) : '<pre>' + md + '</pre>';
  var el   = document.getElementById('preview-content');
  el.innerHTML = html;

  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false }
      ],
      throwOnError: false
    });
  }
}

// ─── Speech to text ───────────────────────────────────────────────────────────
function initSpeech() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    var btn = document.getElementById('mic-btn');
    btn.style.opacity = '0.35'; btn.title = 'Speech needs Chrome/Edge';
    return;
  }
  speechRec = new SR();
  speechRec.continuous = true; speechRec.interimResults = true; speechRec.lang = 'en-US';

  speechRec.addEventListener('result', function(e) {
    var final = '', interim = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (final) {
      var ta = lastFocused || document.getElementById('main-editor');
      if (ta && ta.tagName === 'TEXTAREA') {
        var s = ta.selectionStart;
        ta.value = ta.value.substring(0,s) + final + ' ' + ta.value.substring(s);
        ta.selectionStart = ta.selectionEnd = s + final.length + 1;
        ta.dispatchEvent(new Event('input')); autoResize(ta);
      }
    }
    setSpeechStatus(interim ? '🎤 ' + interim.substring(0,60) + '…' : '🎤 Listening…');
  });
  speechRec.addEventListener('error', function(e){ setSpeechStatus('Error: ' + e.error); stopSpeech(); });
  speechRec.addEventListener('end',   function(){  if (speechOn) speechRec.start(); });
}

function toggleSpeech() {
  if (!speechRec) { alert('Speech recognition requires Chrome or Edge.'); return; }
  speechOn ? stopSpeech() : startSpeech();
}
function startSpeech() {
  speechOn = true; speechRec.start();
  document.getElementById('mic-btn').classList.add('active');
  setSpeechStatus('🎤 Listening…');
}
function stopSpeech() {
  speechOn = false; try { speechRec.stop(); } catch(_) {}
  document.getElementById('mic-btn').classList.remove('active');
  setSpeechStatus('Stopped.');
}
function setSpeechStatus(msg) {
  var el = document.getElementById('speech-status');
  if (el) el.textContent = msg;
}

// ─── Generate files modal ─────────────────────────────────────────────────────
function generateFiles() {
  var title    = document.getElementById('post-title').value || 'Untitled Post';
  var subtitle = document.getElementById('post-subtitle').value.trim();
  var body     = document.getElementById('main-editor').value;
  var date     = document.getElementById('meta-date').value || new Date().toISOString().slice(0,10);
  var excerpt  = document.getElementById('meta-excerpt').value.trim() || subtitle || title;
  var featured = document.getElementById('opt-featured').checked;
  var slug     = updateSlug();

  // Build front-matter
  var tagList   = tags.length ? '[' + tags.join(', ') + ']' : '[]';
  var fm        = '---\ntitle: ' + title + '\ndate: ' + date + '\ntags: ' + tagList + '\n---\n\n';
  // Include subtitle as first paragraph if present
  var fullBody  = subtitle ? '> ' + subtitle + '\n\n' + body : body;
  var mdContent = fm + fullBody;

  var entry = { slug: slug, title: title, date: date, tags: tags.slice(), excerpt: excerpt, featured: featured };
  var filename = slug + '.md';

  document.getElementById('modal-filename').textContent = 'posts/' + filename;
  document.getElementById('modal-step-fn').textContent  = 'posts/' + filename;
  document.getElementById('modal-md').textContent       = mdContent;
  document.getElementById('modal-json').textContent     = JSON.stringify(entry, null, 2);
  document.getElementById('modal').classList.add('open');

  window._mdContent = mdContent;
  window._mdFilename = filename;
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('modal').addEventListener('click', function(e){ if (e.target === this) closeModal(); });
});

function copyOut(elId, btn) {
  var text = document.getElementById(elId).textContent;
  navigator.clipboard.writeText(text).then(function() {
    var o = btn.textContent; btn.textContent = '✓ Copied!';
    setTimeout(function(){ btn.textContent = o; }, 1800);
  }).catch(function() {
    var ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    var o = btn.textContent; btn.textContent = '✓ Copied!';
    setTimeout(function(){ btn.textContent = o; }, 1800);
  });
}

function downloadMd() {
  if (!window._mdContent) return;
  var blob = new Blob([window._mdContent], { type: 'text/markdown' });
  var a    = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = window._mdFilename; a.click(); URL.revokeObjectURL(a.href);
}
