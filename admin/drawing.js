/**
 * drawing.js — Canvas drawing tool with resizable shape objects
 *
 * Architecture:
 *  - Freehand strokes are rasterised directly onto the main canvas
 *  - Shapes are stored as objects in drawState.shapes[]
 *  - On every frame, main canvas = base raster + all shape objects rendered on top
 *  - Selected shape shows 8 resize handles (corners + midpoints); stars show only move handle
 *  - Pen / Line / Arrow / Eraser / Text work on the raster layer as before
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
  lastX:  0, lastY:  0,

  // Raster history (pen/eraser/line/arrow/text burns into this)
  rasterHistory: [],
  rasterIdx:     -1,

  // Shape objects
  shapes:      [],
  selectedIdx: -1,     // index into shapes[]
  dragMode:    null,   // 'move' | 'resize-nw' | 'resize-n' | ... | null
  dragOffX:    0,
  dragOffY:    0,

  // Text
  textPos: null,
};

var canvas, ctx, overlayCanvas, overlayCtx;
var HANDLE_R = 6; // resize handle radius px

// ─── Shape object factory ─────────────────────────────────────────────────────
function makeShape(type, x, y, w, h) {
  return {
    type:         type,
    x: x, y: y,   // top-left (bounding box)
    w: w, h: h,
    strokeColor:  drawState.strokeColor,
    strokeWidth:  drawState.strokeWidth,
    strokeStyle:  drawState.strokeStyle,
    fillEnabled:  drawState.fillEnabled,
    fillColor:    drawState.fillColor,
    resizable:    true,   // all shapes resizable
  };
}

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openDrawing() {
  document.getElementById('draw-overlay').classList.add('open');
  if (!canvas) initDrawingCanvas();
}
function closeDrawing() {
  document.getElementById('draw-overlay').classList.remove('open');
  hideTextInput();
}

// ─── Canvas init ──────────────────────────────────────────────────────────────
function initDrawingCanvas() {
  canvas        = document.getElementById('draw-canvas');
  overlayCanvas = document.getElementById('draw-overlay-canvas');
  ctx           = canvas.getContext('2d');
  overlayCtx    = overlayCanvas.getContext('2d');

  resizeCanvas();

  canvas.addEventListener('mousedown',  onMD);
  canvas.addEventListener('mousemove',  onMM);
  canvas.addEventListener('mouseup',    onMU);
  canvas.addEventListener('mouseleave', onMU);
  canvas.addEventListener('touchstart', function(e){ e.preventDefault(); onMD(e.touches[0]); }, { passive:false });
  canvas.addEventListener('touchmove',  function(e){ e.preventDefault(); onMM(e.touches[0]); }, { passive:false });
  canvas.addEventListener('touchend',   onMU);
  canvas.addEventListener('mousemove', function(e){
    var r = canvas.getBoundingClientRect();
    var el = document.getElementById('draw-coords');
    if (el) el.textContent = Math.round(e.clientX-r.left)+', '+Math.round(e.clientY-r.top);
  });
}

function resizeCanvas() {
  if (!canvas) return;
  var val = (document.getElementById('canvas-size')||{value:'600x400'}).value||'600x400';
  var p   = val.split('x');
  var w   = parseInt(p[0]), h = parseInt(p[1]);

  // Save raster
  var saved = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
  canvas.width  = overlayCanvas.width  = w;
  canvas.height = overlayCanvas.height = h;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (saved) ctx.putImageData(saved, 0, 0);

  saveRaster();
  redraw();
}

// ─── Raster history ───────────────────────────────────────────────────────────
function saveRaster() {
  if (!ctx) return;
  drawState.rasterHistory = drawState.rasterHistory.slice(0, drawState.rasterIdx + 1);
  // Save only the raster (without shapes) — take snapshot before redraw writes shapes
  drawState.rasterHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (drawState.rasterHistory.length > 40) drawState.rasterHistory.shift();
  drawState.rasterIdx = drawState.rasterHistory.length - 1;
}

// ─── Full redraw ─────────────────────────────────────────────────────────────
// Restores raster layer then paints all shape objects on top
function redraw() {
  if (!ctx || !overlayCtx) return;
  // Restore current raster snapshot
  if (drawState.rasterHistory.length > 0 && drawState.rasterIdx >= 0) {
    ctx.putImageData(drawState.rasterHistory[drawState.rasterIdx], 0, 0);
  }
  // Paint all shapes
  drawState.shapes.forEach(function(sh, i) {
    renderShapeObj(ctx, sh, false);
  });
  // Overlay: selection handles
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (drawState.selectedIdx >= 0 && drawState.selectedIdx < drawState.shapes.length) {
    drawHandles(overlayCtx, drawState.shapes[drawState.selectedIdx]);
  }
}

// ─── Render a shape object ────────────────────────────────────────────────────
function renderShapeObj(c, sh, preview) {
  c.save();
  c.strokeStyle = sh.strokeColor;
  c.lineWidth   = sh.strokeWidth;
  c.lineCap     = 'round';
  c.lineJoin    = 'round';
  setDash(c, sh.strokeStyle, sh.strokeWidth);

  var cx = sh.x + sh.w/2, cy = sh.y + sh.h/2;
  var rx = Math.abs(sh.w/2), ry = Math.abs(sh.h/2);
  var r  = Math.min(rx, ry);

  c.beginPath();

  if (sh.type === 'rect') {
    c.rect(sh.x, sh.y, sh.w, sh.h);

  } else if (sh.type === 'circle') {
    c.ellipse(cx, cy, Math.max(rx,1), Math.max(ry,1), 0, 0, Math.PI*2);

  } else if (sh.type === 'triangle') {
    c.moveTo(cx,        sh.y);
    c.lineTo(sh.x+sh.w, sh.y+sh.h);
    c.lineTo(sh.x,      sh.y+sh.h);
    c.closePath();

  } else if (sh.type === 'diamond') {
    c.moveTo(cx,        sh.y);
    c.lineTo(sh.x+sh.w, cy);
    c.lineTo(cx,        sh.y+sh.h);
    c.lineTo(sh.x,      cy);
    c.closePath();

  } else if (sh.type === 'hexagon') {
    for (var j=0; j<6; j++) {
      var a = (Math.PI/3)*j - Math.PI/6;
      c[j===0?'moveTo':'lineTo'](cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    c.closePath();

  } else if (sh.type === 'star') {
    var outerR = r, innerR = r*0.4;
    for (var k=0; k<5; k++) {
      var ao = (Math.PI*2*k/5) - Math.PI/2;
      var ai = ao + Math.PI/5;
      c[k===0?'moveTo':'lineTo'](cx+outerR*Math.cos(ao), cy+outerR*Math.sin(ao));
      c.lineTo(cx+innerR*Math.cos(ai), cy+innerR*Math.sin(ai));
    }
    c.closePath();
  }

  if (sh.fillEnabled) { c.fillStyle = sh.fillColor; c.fill(); }
  c.stroke();
  c.restore();
}

function setDash(c, style, w) {
  if (style === 'dashed')      c.setLineDash([w*4, w*2]);
  else if (style === 'dotted') c.setLineDash([w, w*2]);
  else                         c.setLineDash([]);
}

// ─── Resize handles ───────────────────────────────────────────────────────────
var HANDLE_NAMES = ['nw','n','ne','e','se','s','sw','w'];

function getHandles(sh) {
  var x=sh.x, y=sh.y, w=sh.w, h=sh.h;
  return [
    {name:'nw', x:x,       y:y      },
    {name:'n',  x:x+w/2,   y:y      },
    {name:'ne', x:x+w,     y:y      },
    {name:'e',  x:x+w,     y:y+h/2  },
    {name:'se', x:x+w,     y:y+h    },
    {name:'s',  x:x+w/2,   y:y+h    },
    {name:'sw', x:x,       y:y+h    },
    {name:'w',  x:x,       y:y+h/2  },
  ];
}

function drawHandles(c, sh) {
  c.save();
  // Dashed selection bounding box
  c.strokeStyle = '#4a90e2';
  c.lineWidth   = 1.5;
  c.setLineDash([5, 3]);
  c.strokeRect(sh.x - 2, sh.y - 2, sh.w + 4, sh.h + 4);
  c.setLineDash([]); // reset before drawing handles

  // 8 white resize handles
  getHandles(sh).forEach(function(hnd) {
    drawHandle(c, hnd.x, hnd.y, '#ffffff', HANDLE_R);
  });
  c.restore();
}

function drawHandle(c, x, y, fill, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI*2);
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = '#4a90e2';
  c.lineWidth = 1.5;
  c.stroke();
}

function hitHandle(sh, px, py) {
  var handles = getHandles(sh);
  for (var i=0; i<handles.length; i++) {
    if (Math.hypot(px-handles[i].x, py-handles[i].y) <= HANDLE_R+3)
      return 'resize-'+handles[i].name;
  }
  return null;
}

function hitShape(sh, px, py) {
  return px >= sh.x-4 && px <= sh.x+sh.w+4 && py >= sh.y-4 && py <= sh.y+sh.h+4;
}

function getCursorForHandle(h) {
  var map = { 'nw':'nw-resize','n':'n-resize','ne':'ne-resize','e':'e-resize',
               'se':'se-resize','s':'s-resize','sw':'sw-resize','w':'w-resize','move':'move' };
  if (!h) return null;
  var key = h.replace('resize-','');
  return map[key] || 'move';
}

// ─── Mouse events ─────────────────────────────────────────────────────────────
function getPos(e) {
  var r = canvas.getBoundingClientRect();
  return { x:(e.clientX||e.touches[0].clientX)-r.left, y:(e.clientY||e.touches[0].clientY)-r.top };
}

function onMD(e) {
  var pos = getPos(e);
  drawState.isDrawing = true;
  drawState.startX = pos.x; drawState.startY = pos.y;
  drawState.lastX  = pos.x; drawState.lastY  = pos.y;

  if (drawState.tool === 'select') {
    // Check selected shape handles first
    if (drawState.selectedIdx >= 0) {
      var sh  = drawState.shapes[drawState.selectedIdx];
      var hit = hitHandle(sh, pos.x, pos.y);
      if (hit) {
        drawState.dragMode  = hit;
        drawState.dragOffX  = pos.x - sh.x;
        drawState.dragOffY  = pos.y - sh.y;
        return;
      }
    }
    // Hit test all shapes (top-most first)
    drawState.selectedIdx = -1;
    for (var i=drawState.shapes.length-1; i>=0; i--) {
      if (hitShape(drawState.shapes[i], pos.x, pos.y)) {
        drawState.selectedIdx = i;
        drawState.dragMode    = 'move';
        drawState.dragOffX    = pos.x - drawState.shapes[i].x;
        drawState.dragOffY    = pos.y - drawState.shapes[i].y;
        break;
      }
    }
    redraw();
    return;
  }

  if (drawState.tool === 'pen' || drawState.tool === 'eraser') {
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    return;
  }
  if (drawState.tool === 'text') {
    drawState.isDrawing = false;
    placeTextInput(pos.x, pos.y);
    return;
  }
}

function onMM(e) {
  var pos = getPos(e);

  // Update cursor hint
  if (drawState.tool === 'select') {
    var cur = 'default';
    if (drawState.selectedIdx >= 0) {
      var sh  = drawState.shapes[drawState.selectedIdx];
      var hit = hitHandle(sh, pos.x, pos.y);
      if (hit) cur = getCursorForHandle(hit) || 'move';
      else if (hitShape(sh, pos.x, pos.y)) cur = 'move';
    } else {
      for (var i=drawState.shapes.length-1; i>=0; i--) {
        if (hitShape(drawState.shapes[i], pos.x, pos.y)) { cur='move'; break; }
      }
    }
    canvas.style.cursor = cur;
  }

  if (!drawState.isDrawing) return;

  if (drawState.tool === 'select' && drawState.dragMode) {
    var sh2 = drawState.shapes[drawState.selectedIdx];
    if (!sh2) return;
    applyDrag(sh2, pos.x, pos.y);
    redraw();
    return;
  }

  if (drawState.tool === 'pen') {
    ctx.save();
    ctx.strokeStyle = drawState.strokeColor;
    ctx.lineWidth   = drawState.strokeWidth;
    ctx.lineCap='round'; ctx.lineJoin='round';
    setDash(ctx, drawState.strokeStyle, drawState.strokeWidth);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ctx.restore();
    return;
  }

  if (drawState.tool === 'eraser') {
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.lineWidth = drawState.strokeWidth*5;
    ctx.lineCap='round'; ctx.setLineDash([]);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ctx.restore();
    return;
  }

  // Preview shapes / lines / arrows on overlay
  if (['line','rect','circle','arrow'].indexOf(drawState.tool) >= 0) {
    // Restore raster + shapes, then draw preview on overlay
    if (drawState.rasterHistory.length > 0) ctx.putImageData(drawState.rasterHistory[drawState.rasterIdx], 0, 0);
    drawState.shapes.forEach(function(s){ renderShapeObj(ctx, s, false); });
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawPreview(overlayCtx, drawState.tool, drawState.startX, drawState.startY, pos.x, pos.y);
  }
}

function onMU(e) {
  if (!drawState.isDrawing && drawState.dragMode === null) return;

  var pos = (e.type==='touchend') ? {x:drawState.lastX,y:drawState.lastY} : (e.clientX ? getPos(e) : {x:drawState.lastX,y:drawState.lastY});

  if (drawState.dragMode) {
    drawState.dragMode = null;
    saveShapeState();
    redraw();
    drawState.isDrawing = false;
    return;
  }

  drawState.isDrawing = false;

  if (drawState.tool === 'pen' || drawState.tool === 'eraser') {
    // Burn pen/eraser strokes: save raster (already on canvas)
    saveRaster();
    return;
  }

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (drawState.tool === 'line' || drawState.tool === 'arrow') {
    // Burn line/arrow to raster
    ctx.save();
    ctx.strokeStyle = drawState.strokeColor;
    ctx.lineWidth   = drawState.strokeWidth;
    ctx.lineCap='round'; ctx.lineJoin='round';
    setDash(ctx, drawState.strokeStyle, drawState.strokeWidth);
    ctx.beginPath();
    if (drawState.tool === 'line') {
      ctx.moveTo(drawState.startX, drawState.startY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      drawArrow(ctx, drawState.startX, drawState.startY, pos.x, pos.y);
    }
    ctx.restore();
    saveRaster();
    return;
  }

  // Shape tools: create shape object
  if (['rect','circle'].indexOf(drawState.tool) >= 0) {
    var x = Math.min(drawState.startX, pos.x);
    var y = Math.min(drawState.startY, pos.y);
    var w = Math.abs(pos.x - drawState.startX)||2;
    var h = Math.abs(pos.y - drawState.startY)||2;
    drawState.shapes.push(makeShape(drawState.tool, x, y, w, h));
    drawState.selectedIdx = drawState.shapes.length - 1;
    saveShapeState();
    redraw();
  }
}

function applyDrag(sh, px, py) {
  var dm = drawState.dragMode;
  if (dm === 'move') {
    sh.x = px - drawState.dragOffX;
    sh.y = py - drawState.dragOffY;
    return;
  }
  // Resize
  var dir = dm.replace('resize-','');
  var ox = sh.x, oy = sh.y, ow = sh.w, oh = sh.h;
  if (dir.indexOf('e') >= 0) sh.w = Math.max(10, px - ox);
  if (dir.indexOf('s') >= 0) sh.h = Math.max(10, py - oy);
  if (dir.indexOf('w') >= 0) { sh.w = Math.max(10, ox+ow-px); sh.x = px; }
  if (dir.indexOf('n') >= 0) { sh.h = Math.max(10, oy+oh-py); sh.y = py; }
}

// ─── Preview overlay drawing ──────────────────────────────────────────────────
function drawPreview(c, tool, x1, y1, x2, y2) {
  c.save();
  c.strokeStyle = drawState.strokeColor;
  c.lineWidth   = drawState.strokeWidth;
  c.lineCap='round'; c.lineJoin='round';
  setDash(c, drawState.strokeStyle, drawState.strokeWidth);
  c.globalAlpha = 0.75;
  c.beginPath();

  if (tool === 'line') {
    c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
  } else if (tool === 'rect') {
    var rx=Math.min(x1,x2),ry=Math.min(y1,y2);
    c.rect(rx,ry,Math.abs(x2-x1),Math.abs(y2-y1));
    if (drawState.fillEnabled){c.fillStyle=drawState.fillColor;c.fill();}
    c.stroke();
  } else if (tool === 'circle') {
    var cx=(x1+x2)/2,cy=(y1+y2)/2;
    c.ellipse(cx,cy,Math.max(Math.abs(x2-x1)/2,1),Math.max(Math.abs(y2-y1)/2,1),0,0,Math.PI*2);
    if (drawState.fillEnabled){c.fillStyle=drawState.fillColor;c.fill();}
    c.stroke();
  } else if (tool === 'arrow') {
    drawArrow(c, x1, y1, x2, y2);
  }
  c.restore();
}

// ─── Arrow ────────────────────────────────────────────────────────────────────
function drawArrow(c, x1, y1, x2, y2) {
  var hl  = Math.max(10, drawState.strokeWidth*4);
  var ang = Math.atan2(y2-y1, x2-x1);
  c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
  c.beginPath();
  c.moveTo(x2,y2);
  c.lineTo(x2-hl*Math.cos(ang-Math.PI/6), y2-hl*Math.sin(ang-Math.PI/6));
  c.moveTo(x2,y2);
  c.lineTo(x2-hl*Math.cos(ang+Math.PI/6), y2-hl*Math.sin(ang+Math.PI/6));
  c.stroke();
}

// ─── Insert shapes (stamp at centre, then select) ─────────────────────────────
function insertShape(type) {
  // Init canvas if not yet open (first time)
  if (!canvas) initDrawingCanvas();

  var cw = canvas.width;
  var ch = canvas.height;
  var r  = Math.min(cw, ch) * 0.15;
  var sx = cw/2 - r, sy = ch/2 - r;

  drawState.shapes.push(makeShape(type, sx, sy, r*2, r*2));
  drawState.selectedIdx = drawState.shapes.length - 1; // set BEFORE setTool

  // Switch to select tool but preserve the selectedIdx we just set
  drawState.tool = 'select';
  document.querySelectorAll('.draw-tool[id^="tool-"]').forEach(function(b){ b.classList.remove('active'); });
  var selBtn = document.getElementById('tool-select');
  if (selBtn) selBtn.classList.add('active');
  if (canvas) canvas.style.cursor = 'default';

  saveShapeState();
  redraw(); // redraw AFTER selectedIdx is set — handles will appear
  setDrawStatus(type + ' placed — drag white handles to resize, drag body to move.');
}

// ─── Shape undo/redo (separate from raster) ───────────────────────────────────
var shapeHistory = [[]];
var shapeHistIdx = 0;

function saveShapeState() {
  shapeHistory = shapeHistory.slice(0, shapeHistIdx+1);
  shapeHistory.push(JSON.parse(JSON.stringify(drawState.shapes)));
  if (shapeHistory.length > 40) shapeHistory.shift();
  shapeHistIdx = shapeHistory.length - 1;
}

function undoDraw() {
  // Undo shape layer first if possible, otherwise undo raster
  if (shapeHistIdx > 0) {
    shapeHistIdx--;
    drawState.shapes = JSON.parse(JSON.stringify(shapeHistory[shapeHistIdx]));
    drawState.selectedIdx = -1;
    redraw();
    setDrawStatus('Undo');
    return;
  }
  if (drawState.rasterIdx > 0) {
    drawState.rasterIdx--;
    redraw();
    setDrawStatus('Undo');
  }
}

function redoDraw() {
  if (shapeHistIdx < shapeHistory.length-1) {
    shapeHistIdx++;
    drawState.shapes = JSON.parse(JSON.stringify(shapeHistory[shapeHistIdx]));
    drawState.selectedIdx = -1;
    redraw();
    setDrawStatus('Redo');
    return;
  }
  if (drawState.rasterIdx < drawState.rasterHistory.length-1) {
    drawState.rasterIdx++;
    redraw();
    setDrawStatus('Redo');
  }
}

// ─── Tool selection ───────────────────────────────────────────────────────────
function setTool(tool, keepSelection) {
  drawState.tool = tool;
  document.querySelectorAll('.draw-tool[id^="tool-"]').forEach(function(b){ b.classList.remove('active'); });
  var el = document.getElementById('tool-'+tool);
  if (el) el.classList.add('active');

  // Only clear selection when explicitly switching away, not when called from insertShape
  if (tool !== 'select' && !keepSelection) drawState.selectedIdx = -1;

  if (canvas) {
    canvas.style.cursor =
      tool==='eraser' ? 'cell' :
      tool==='text'   ? 'text' :
      tool==='select' ? 'default' : 'crosshair';
    redraw();
  }

  var msgs = {
    pen:'Pen — freehand', line:'Line — drag', rect:'Rectangle — drag to size',
    circle:'Circle/Ellipse — drag to size', arrow:'Arrow — drag',
    text:'Text — click to place', eraser:'Eraser — drag to erase',
    select:'Select — click a shape to select, drag handles to resize'
  };
  setDrawStatus(msgs[tool]||'');
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

// ─── Text tool ────────────────────────────────────────────────────────────────
function placeTextInput(x, y) {
  var inp  = document.getElementById('draw-text-input');
  var wrap = document.getElementById('draw-canvas-wrap');
  var wr   = wrap.getBoundingClientRect();
  var cr   = canvas.getBoundingClientRect();
  inp.style.left    = (cr.left-wr.left+x)+'px';
  inp.style.top     = (cr.top -wr.top +y-14)+'px';
  inp.style.display = 'block';
  inp.style.fontSize= (drawState.strokeWidth*5+12)+'px';
  inp.style.color   = drawState.strokeColor;
  inp.value=''; inp.focus();
  drawState.textPos = {x,y};
  setDrawStatus('Type then press Enter to place on canvas.');
}
function handleDrawTextKey(e) {
  if (e.key==='Enter'){e.preventDefault();commitText();}
  else if (e.key==='Escape') hideTextInput();
}
function commitText() {
  var inp=document.getElementById('draw-text-input'), text=inp.value.trim();
  if (text && drawState.textPos) {
    ctx.save();
    ctx.fillStyle = drawState.strokeColor;
    ctx.font = 'bold '+(drawState.strokeWidth*5+12)+'px Inter,sans-serif';
    ctx.fillText(text, drawState.textPos.x, drawState.textPos.y);
    ctx.restore();
    saveRaster();
  }
  hideTextInput();
}
function hideTextInput(){
  var inp=document.getElementById('draw-text-input');
  if(inp){inp.style.display='none';inp.value='';}
  drawState.textPos=null;
}

// ─── Clear ────────────────────────────────────────────────────────────────────
function clearCanvas() {
  if (!confirm('Clear everything?')) return;
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  drawState.shapes=[]; drawState.selectedIdx=-1;
  saveRaster(); saveShapeState(); redraw();
  setDrawStatus('Cleared.');
}

// ─── Export to post ───────────────────────────────────────────────────────────
function insertDrawing() {
  hideTextInput();
  drawState.selectedIdx = -1;
  redraw();

  var dataUrl  = canvas.toDataURL('image/png');
  var filename = 'drawing-' + Date.now() + '.png';

  // Download the PNG file
  var a = document.createElement('a');
  a.href = dataUrl; a.download = filename; a.click();

  // Insert clean short tag — no base64 blob in markdown
  var tag = '[drawing: ' + filename + ']';
  if (typeof insertAtCursor === 'function')     insertAtCursor('\n' + tag + '\n');
  else if (typeof insertSnippet === 'function') insertSnippet('\n' + tag + '\n', '');

  closeDrawing();
  showDrawingInsertModal(filename);
}

function showDrawingInsertModal(filename) {
  var old = document.getElementById('draw-insert-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'draw-insert-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:700;display:flex;align-items:center;justify-content:center';
  var cs = 'background:#ede9e2;padding:.1em .35em;border-radius:3px;font-size:.85em;color:#c84b20;font-family:DM Mono,monospace';
  m.innerHTML =
    '<div style="background:#faf8f5;border:1px solid #d8d2c8;border-radius:10px;padding:2rem 2.2rem;max-width:480px;width:94vw;font-family:DM Sans,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
    '<h3 style="font-size:1rem;font-weight:600;margin-bottom:.6rem;color:#1a1714">Drawing inserted ✓</h3>' +
    '<p style="font-size:.82rem;color:#4a4540;line-height:1.65;margin-bottom:1.1rem">' +
      'Downloaded as <code style="'+cs+'">'+filename+'</code>. Follow these steps:' +
    '</p>' +
    '<ol style="font-size:.82rem;color:#4a4540;line-height:2;padding-left:1.4rem;margin-bottom:1.4rem">' +
      '<li>In your repo, create a <code style="'+cs+'">drawings/</code> folder at the root (same level as <code style="'+cs+'">posts/</code>).</li>' +
      '<li>Upload <code style="'+cs+'">'+filename+'</code> into that <code style="'+cs+'">drawings/</code> folder and commit.</li>' +
      '<li>The tag <code style="'+cs+'">[drawing: '+filename+']</code> is already in your post. No other changes needed.</li>' +
      '<li>Publish as usual — it renders automatically.</li>' +
    '</ol>' +
    '<button onclick="document.getElementById('draw-insert-modal').remove()" ' +
      'style="background:#c84b20;color:#fff;border:none;border-radius:4px;padding:.38rem 1.1rem;font-size:.8rem;cursor:pointer;font-family:inherit">Got it</button>' +
    '</div>';
  document.body.appendChild(m);
  m.addEventListener('mousedown', function(e){ if(e.target===m) m.remove(); });
}


// ─── Status & misc ────────────────────────────────────────────────────────────
function setDrawStatus(msg){var el=document.getElementById('draw-status');if(el)el.textContent=msg;}

document.addEventListener('DOMContentLoaded', function(){
  var ov=document.getElementById('draw-overlay');
  if(ov) ov.addEventListener('mousedown',function(e){if(e.target===ov)closeDrawing();});
});

document.addEventListener('keydown', function(e){
  var ov=document.getElementById('draw-overlay');
  if(!ov||!ov.classList.contains('open'))return;
  if(document.getElementById('draw-text-input').style.display!=='none')return;
  var sc={p:'pen',l:'line',r:'rect',c:'circle',a:'arrow',t:'text',e:'eraser',s:'select'};
  if(sc[e.key]){setTool(sc[e.key]);return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undoDraw();}
  if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redoDraw();}
  if(e.key==='Delete'||e.key==='Backspace'){
    if(drawState.selectedIdx>=0){
      drawState.shapes.splice(drawState.selectedIdx,1);
      drawState.selectedIdx=-1;
      saveShapeState();redraw();
    }
  }
  if(e.key==='Escape') closeDrawing();
});
