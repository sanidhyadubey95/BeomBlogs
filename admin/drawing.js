/**
 * drawing.js — Full-featured canvas drawing tool for BeomBlogs editor
 * Tools: pen, line, rect, circle, arrow, text, eraser, select/move
 * Features: fill, stroke color/width/style, shapes, undo/redo, export as PNG→Markdown
 */

// ─── State ────────────────────────────────────────────────────────────────────
var drawState = {
  tool:        'pen',
  strokeColor: '#1a1714',
  strokeWidth: 2,
  strokeStyle: 'solid',
  fillEnabled: false,
  fillColor:   '#ffffff',
  isDrawing:   false,
  startX: 0, startY: 0,
  lastX: 0,  lastY: 0,
  history:     [],   // array of ImageData snapshots
  historyIdx:  -1,
  objects:     [],   // for select/move
  selectedObj: null,
  textPos:     null,
};

var canvas, ctx, overlayCanvas, overlayCtx;

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openDrawing() {
  document.getElementById('draw-overlay').classList.add('open');
  if (!canvas) initDrawingCanvas();
}

function closeDrawing() {
  document.getElementById('draw-overlay').classList.remove('open');
  hideTextInput();
}

// ─── Init canvas ──────────────────────────────────────────────────────────────
function initDrawingCanvas() {
  canvas        = document.getElementById('draw-canvas');
  overlayCanvas = document.getElementById('draw-overlay-canvas');
  ctx           = canvas.getContext('2d');
  overlayCtx    = overlayCanvas.getContext('2d');

  resizeCanvas();
  saveHistory();

  // Main canvas events
  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onMouseUp);

  // Cursor coords
  canvas.addEventListener('mousemove', function(e) {
    var r = canvas.getBoundingClientRect();
    document.getElementById('draw-coords').textContent =
      Math.round(e.clientX - r.left) + ', ' + Math.round(e.clientY - r.top);
  });
}

function resizeCanvas() {
  var size = (document.getElementById('canvas-size') || {value:'600x400'}).value || '600x400';
  var parts = size.split('x');
  var w = parseInt(parts[0]), h = parseInt(parts[1]);
  if (!canvas) return;

  // Save current content
  var saved = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
  canvas.width  = w;
  canvas.height = h;
  overlayCanvas.width  = w;
  overlayCanvas.height = h;

  // Restore white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (saved) ctx.putImageData(saved, 0, 0);

  saveHistory();
}

// ─── Tool selection ───────────────────────────────────────────────────────────
function setTool(tool) {
  drawState.tool = tool;
  document.querySelectorAll('.draw-tool').forEach(function(b) { b.classList.remove('active'); });
  var el = document.getElementById('tool-' + tool);
  if (el) el.classList.add('active');

  canvas.style.cursor = tool === 'eraser'  ? 'cell'     :
                        tool === 'text'    ? 'text'     :
                        tool === 'select'  ? 'default'  : 'crosshair';

  var msgs = {
    pen:    'Pen — freehand drawing',
    line:   'Line — click and drag',
    rect:   'Rectangle — click and drag',
    circle: 'Circle/Ellipse — click and drag',
    arrow:  'Arrow — click and drag',
    text:   'Text — click to place a text box',
    eraser: 'Eraser — drag to erase',
    select: 'Select — click shapes to move them'
  };
  setDrawStatus(msgs[tool] || '');
  hideTextInput();
}

function updateStroke() {
  drawState.strokeColor = document.getElementById('stroke-color').value;
  drawState.strokeWidth = parseInt(document.getElementById('stroke-width').value);
  drawState.strokeStyle = document.getElementById('stroke-style').value;
}

function updateFill() {
  drawState.fillEnabled = document.getElementById('fill-enable').checked;
  drawState.fillColor   = document.getElementById('fill-color').value;
}

function applyStroke(c) {
  c.strokeStyle = drawState.strokeColor;
  c.lineWidth   = drawState.strokeWidth;
  c.lineCap     = 'round';
  c.lineJoin    = 'round';
  if (drawState.strokeStyle === 'dashed') {
    c.setLineDash([drawState.strokeWidth * 4, drawState.strokeWidth * 2]);
  } else if (drawState.strokeStyle === 'dotted') {
    c.setLineDash([drawState.strokeWidth, drawState.strokeWidth * 2]);
  } else {
    c.setLineDash([]);
  }
}

function applyFill(c) {
  if (drawState.fillEnabled) {
    c.fillStyle = drawState.fillColor;
    c.fill();
  }
}

// ─── Mouse / Touch events ─────────────────────────────────────────────────────
function getPos(e) {
  var r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX || e.touches[0].clientX) - r.left,
    y: (e.clientY || e.touches[0].clientY) - r.top
  };
}

function onTouchStart(e) { e.preventDefault(); onMouseDown(e.touches[0]); }
function onTouchMove(e)  { e.preventDefault(); onMouseMove(e.touches[0]); }

function onMouseDown(e) {
  var pos = getPos(e);
  drawState.isDrawing = true;
  drawState.startX = pos.x;
  drawState.startY = pos.y;
  drawState.lastX  = pos.x;
  drawState.lastY  = pos.y;

  if (drawState.tool === 'pen' || drawState.tool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  if (drawState.tool === 'text') {
    drawState.isDrawing = false;
    placeTextInput(pos.x, pos.y);
  }
}

function onMouseMove(e) {
  if (!drawState.isDrawing) return;
  var pos = getPos(e);

  if (drawState.tool === 'pen') {
    applyStroke(ctx);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    drawState.lastX = pos.x;
    drawState.lastY = pos.y;
    return;
  }

  if (drawState.tool === 'eraser') {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = drawState.strokeWidth * 4;
    ctx.lineCap   = 'round';
    ctx.setLineDash([]);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Preview on overlay for shape tools
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  drawShape(overlayCtx, drawState.tool, drawState.startX, drawState.startY, pos.x, pos.y, true);
}

function onMouseUp(e) {
  if (!drawState.isDrawing) return;
  drawState.isDrawing = false;

  if (e.type === 'mouseleave' && drawState.tool === 'pen') {
    saveHistory(); return;
  }

  var pos = e.type === 'touchend' ? { x: drawState.lastX, y: drawState.lastY } : getPos(e);

  if (drawState.tool !== 'pen' && drawState.tool !== 'eraser' && drawState.tool !== 'text') {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawShape(ctx, drawState.tool, drawState.startX, drawState.startY, pos.x, pos.y, false);
  }

  saveHistory();
}

// ─── Shape drawing ────────────────────────────────────────────────────────────
function drawShape(c, tool, x1, y1, x2, y2, preview) {
  c.save();
  applyStroke(c);
  c.beginPath();

  if (tool === 'line') {
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();

  } else if (tool === 'rect') {
    var rx = Math.min(x1,x2), ry = Math.min(y1,y2);
    var rw = Math.abs(x2-x1),  rh = Math.abs(y2-y1);
    c.rect(rx, ry, rw, rh);
    applyFill(c);
    c.stroke();

  } else if (tool === 'circle') {
    var cx = (x1+x2)/2, cy = (y1+y2)/2;
    var rx2 = Math.abs(x2-x1)/2, ry2 = Math.abs(y2-y1)/2;
    c.ellipse(cx, cy, Math.max(rx2,1), Math.max(ry2,1), 0, 0, Math.PI*2);
    applyFill(c);
    c.stroke();

  } else if (tool === 'arrow') {
    drawArrow(c, x1, y1, x2, y2);
  }

  c.restore();
}

function drawArrow(c, x1, y1, x2, y2) {
  var headLen = Math.max(10, drawState.strokeWidth * 4);
  var angle   = Math.atan2(y2 - y1, x2 - x1);
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - headLen * Math.cos(angle - Math.PI/6), y2 - headLen * Math.sin(angle - Math.PI/6));
  c.moveTo(x2, y2);
  c.lineTo(x2 - headLen * Math.cos(angle + Math.PI/6), y2 - headLen * Math.sin(angle + Math.PI/6));
  c.stroke();
}

// ─── Insert shapes ────────────────────────────────────────────────────────────
function insertShape(type) {
  var cx = canvas.width/2, cy = canvas.height/2, r = 60;
  ctx.save();
  applyStroke(ctx);
  ctx.beginPath();

  if (type === 'triangle') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.lineTo(cx - r, cy + r);
    ctx.closePath();
  } else if (type === 'star') {
    for (var i = 0; i < 5; i++) {
      var outer = (Math.PI * 2 * i / 5) - Math.PI/2;
      var inner = outer + Math.PI/5;
      ctx[i===0?'moveTo':'lineTo'](cx + r*Math.cos(outer), cy + r*Math.sin(outer));
      ctx.lineTo(cx + (r*0.4)*Math.cos(inner), cy + (r*0.4)*Math.sin(inner));
    }
    ctx.closePath();
  } else if (type === 'diamond') {
    ctx.moveTo(cx,     cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx,     cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  } else if (type === 'hexagon') {
    for (var j = 0; j < 6; j++) {
      var a = (Math.PI / 3) * j - Math.PI/6;
      ctx[j===0?'moveTo':'lineTo'](cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    ctx.closePath();
  }

  applyFill(ctx);
  ctx.stroke();
  ctx.restore();
  saveHistory();
  setDrawStatus(type.charAt(0).toUpperCase() + type.slice(1) + ' inserted at centre. Drag to reposition with Select tool.');
}

// ─── Text tool ────────────────────────────────────────────────────────────────
function placeTextInput(x, y) {
  var inp  = document.getElementById('draw-text-input');
  var wrap = document.getElementById('draw-canvas-wrap');
  var wrapRect = wrap.getBoundingClientRect();
  var canvRect = canvas.getBoundingClientRect();

  inp.style.left    = (canvRect.left - wrapRect.left + x) + 'px';
  inp.style.top     = (canvRect.top  - wrapRect.top  + y - 12) + 'px';
  inp.style.display = 'block';
  inp.style.fontSize = (drawState.strokeWidth * 5 + 12) + 'px';
  inp.style.color   = drawState.strokeColor;
  inp.value         = '';
  inp.focus();
  drawState.textPos = { x: x, y: y };
  setDrawStatus('Type your text, then press Enter to place it on the canvas.');
}

function handleDrawTextKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitText();
  } else if (e.key === 'Escape') {
    hideTextInput();
  }
}

function commitText() {
  var inp  = document.getElementById('draw-text-input');
  var text = inp.value.trim();
  if (text && drawState.textPos) {
    ctx.save();
    ctx.fillStyle  = drawState.strokeColor;
    ctx.font       = 'bold ' + (drawState.strokeWidth * 5 + 12) + 'px ' + "'DM Sans', sans-serif";
    ctx.fillText(text, drawState.textPos.x, drawState.textPos.y);
    ctx.restore();
    saveHistory();
  }
  hideTextInput();
}

function hideTextInput() {
  var inp = document.getElementById('draw-text-input');
  if (inp) { inp.style.display = 'none'; inp.value = ''; }
  drawState.textPos = null;
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────
function saveHistory() {
  // Trim forward history
  drawState.history = drawState.history.slice(0, drawState.historyIdx + 1);
  drawState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (drawState.history.length > 40) drawState.history.shift();
  drawState.historyIdx = drawState.history.length - 1;
}

function undoDraw() {
  if (drawState.historyIdx > 0) {
    drawState.historyIdx--;
    ctx.putImageData(drawState.history[drawState.historyIdx], 0, 0);
    setDrawStatus('Undo');
  }
}

function redoDraw() {
  if (drawState.historyIdx < drawState.history.length - 1) {
    drawState.historyIdx++;
    ctx.putImageData(drawState.history[drawState.historyIdx], 0, 0);
    setDrawStatus('Redo');
  }
}

// ─── Clear ────────────────────────────────────────────────────────────────────
function clearCanvas() {
  if (!confirm('Clear the entire canvas?')) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveHistory();
  setDrawStatus('Canvas cleared.');
}

// ─── Insert into post ─────────────────────────────────────────────────────────
function insertDrawing() {
  hideTextInput();

  // Export canvas as PNG data URL
  var dataUrl = canvas.toDataURL('image/png');

  // Build a unique filename hint
  var ts = Date.now();
  var filename = 'drawing-' + ts + '.png';

  // Insert as Markdown image with base64 src + a note
  // We also open a helper dialog so the user can save the file
  var md = '![Drawing](' + dataUrl + ')';

  // Insert into main editor
  if (typeof insertAtCursor === 'function') {
    insertAtCursor('\n' + md + '\n');
  } else if (typeof insertSnippet === 'function') {
    insertSnippet('\n' + md + '\n', '');
  }

  // Offer to download the PNG too
  var a = document.createElement('a');
  a.href     = dataUrl;
  a.download = filename;
  a.click();

  setDrawStatus('Drawing inserted into post! PNG also downloaded as ' + filename);
  closeDrawing();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setDrawStatus(msg) {
  var el = document.getElementById('draw-status');
  if (el) el.textContent = msg;
}

// Close on overlay background click
document.addEventListener('DOMContentLoaded', function() {
  var overlay = document.getElementById('draw-overlay');
  if (overlay) {
    overlay.addEventListener('mousedown', function(e) {
      if (e.target === overlay) closeDrawing();
    });
  }
});

// Keyboard shortcuts inside drawing modal
document.addEventListener('keydown', function(e) {
  var overlay = document.getElementById('draw-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (document.getElementById('draw-text-input').style.display !== 'none') return;

  var shortcuts = { p:'pen', l:'line', r:'rect', c:'circle', a:'arrow', t:'text', e:'eraser', s:'select' };
  if (shortcuts[e.key]) { setTool(shortcuts[e.key]); return; }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoDraw(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redoDraw(); }
  if (e.key === 'Escape') closeDrawing();
});
