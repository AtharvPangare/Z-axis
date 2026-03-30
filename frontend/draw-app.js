/**
 * Z-AXIS Draw Studio Application
 * Ported from ArchAI (Draw/frontend1)
 * Themed for Z-Axis Platform
 */

/* ═══════════════════════════════════════════
   STATE
   Removed upload-related states
═══════════════════════════════════════════ */
const state = {
  mode: 'draw',           // 'draw' | '3d' | 'report'
  tool: 'wall',           // 'wall' | 'window' | 'door' | 'select'
  drawing: false,
  walls: [],              // [{x1,y1,x2,y2,type:'wall'|'window'|'door'}]
  drawStart: null,
  snapGrid: 20,
  apiKey: '',
  analysisData: null,     // {walls, windows, doors, totalArea, totalWallLen}
  threeScene: null,
};

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  loadKey();
  checkBackendHealth();
  
  // Icon replacement
  if (window.feather) feather.replace();
});

/* ═══════════════════════════════════════════
   BACKEND
═══════════════════════════════════════════ */
const BACKEND = 'http://localhost:5000';

async function checkBackendHealth() {
  try {
    const r = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) showToast('✅ AI Backend connected', 2500);
  } catch {
    showToast('⚠️ AI Backend offline — using core engine', 4000);
  }
}

/* ═══════════════════════════════════════════
   MODE SWITCHING
═══════════════════════════════════════════ */
function switchMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
  
  const tab = document.getElementById(`tab-${m}`);
  const panel = document.getElementById(`panel-${m}`);
  
  if (tab) tab.classList.add('active');
  if (panel) panel.classList.add('active');

  if (m === '3d' && state.threeScene) {
    setTimeout(() => state.threeScene.handleResize(), 100);
  }
}

/* ═══════════════════════════════════════════
   2D CANVAS FLOOR PLANNER
═══════════════════════════════════════════ */
let ctx, canvas;
const COLORS = {
  bg: '#fdfdfd',
  grid: '#E8E1D9',
  gridMaj: 'rgba(139, 111, 71, 0.1)',
  wall: '#8B6F47',         // Brown-primary
  wallFill: 'rgba(139, 111, 71, 0.2)',
  window: '#0891B2',       // Cyan-600
  windowFill: 'rgba(8, 145, 178, 0.15)',
  door: '#EA580C',         // Orange-600
  doorFill: 'rgba(234, 88, 12, 0.2)',
  snapDot: '#EA580C',
  drawingLine: 'rgba(234, 88, 12, 0.6)',
};

function initCanvas() {
  canvas = document.getElementById('floor-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('mousedown', onCanvasMouseDown);
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('mouseup', onCanvasMouseUp);
  canvas.addEventListener('dblclick', onCanvasDblClick);
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); cancelDraw(); });
  drawCanvas();
}

function resizeCanvas() {
  const area = canvas.parentElement;
  const r = area.getBoundingClientRect();
  canvas.width = Math.floor(r.width);
  canvas.height = Math.floor(r.height) || 700;
  drawCanvas();
}

function snap(v) {
  const g = state.snapGrid;
  return Math.round(v / g) * g;
}

function screenToCanvas(x, y) {
  const r = canvas.getBoundingClientRect();
  return { x: x - r.left, y: y - r.top };
}

function onCanvasMouseDown(e) {
  if (state.tool === 'select') return;
  if (e.button !== 0) return;
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  const sx = snap(x), sy = snap(y);
  state.drawing = true;
  state.drawStart = { x: sx, y: sy };
  document.getElementById('canvas-hint').style.opacity = '0';
}

let mousePt = null;
function onCanvasMouseMove(e) {
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  mousePt = { x: snap(x), y: snap(y) };
  drawCanvas();
}

function onCanvasMouseUp(e) {
  if (!state.drawing || !state.drawStart) return;
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  const ex = snap(x), ey = snap(y);
  if (Math.abs(ex - state.drawStart.x) > 4 || Math.abs(ey - state.drawStart.y) > 4) {
    state.walls.push({ x1: state.drawStart.x, y1: state.drawStart.y, x2: ex, y2: ey, type: state.tool });
    updateStats();
  }
  state.drawing = false;
  state.drawStart = null;
  drawCanvas();
}

function onCanvasDblClick(e) { cancelDraw(); }

function cancelDraw() {
  state.drawing = false;
  state.drawStart = null;
  drawCanvas();
}

function drawCanvas() {
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // BG
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  const g = state.snapGrid;
  ctx.beginPath();
  for (let x = 0; x <= W; x += g) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += g) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Major grid
  ctx.beginPath();
  const mg = g * 5;
  for (let x = 0; x <= W; x += mg) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += mg) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.strokeStyle = COLORS.gridMaj;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Existing walls
  state.walls.forEach(seg => drawSegment(seg));

  // Preview line while drawing
  if (state.drawing && state.drawStart && mousePt) {
    drawSegmentPreview(state.drawStart.x, state.drawStart.y, mousePt.x, mousePt.y, state.tool);
  }

  // Snap dot
  if (mousePt) {
    ctx.beginPath();
    ctx.arc(mousePt.x, mousePt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.snapDot;
    ctx.fill();
  }
}

function drawSegment(seg) {
  const { x1, y1, x2, y2, type } = seg;
  const color = COLORS[type];
  const fill = COLORS[type + 'Fill'];
  const w = type === 'wall' ? 8 : 5;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (fill) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = fill;
    ctx.lineWidth = w - 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x1, y1, 4, 0, Math.PI * 2);
  ctx.arc(x2, y2, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSegmentPreview(x1, y1, x2, y2, type) {
  const color = COLORS[type];
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = type === 'wall' ? COLORS.drawingLine : color;
  ctx.lineWidth = type === 'wall' ? 6 : 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  const scale = parseFloat(document.getElementById('scale-meters').value) || 1;
  const len = Math.round(Math.hypot(x2 - x1, y2 - y1) / state.snapGrid * scale * 10) / 10;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  ctx.fillStyle = '#1A1A1A';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${len}m`, mx, my - 12);
}

function setTool(t) {
  state.tool = t;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tool-${t}`)?.classList.add('active');
  canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
}

function undoLast() {
  if (state.walls.length > 0) { state.walls.pop(); updateStats(); drawCanvas(); }
}

function clearCanvas() {
  if (state.walls.length === 0) return;
  if (confirm('Clear the entire floor plan?')) { state.walls = []; updateStats(); drawCanvas(); }
}

function updateStats() {
  const walls = state.walls.filter(s => s.type === 'wall').length;
  const wins = state.walls.filter(s => s.type === 'window').length;
  const doors = state.walls.filter(s => s.type === 'door').length;
  document.getElementById('d-walls').textContent = walls;
  document.getElementById('d-windows').textContent = wins;
  document.getElementById('d-doors').textContent = doors;
}

/* ═══════════════════════════════════════════
   DEMO PLAN
═══════════════════════════════════════════ */
function loadDemo() {
  state.walls = [];
  const g = 20;
  const ox = 100, oy = 80, rw = 18 * g, rh = 13 * g;
  state.walls.push({ x1: ox, y1: oy, x2: ox + rw, y2: oy, type: 'wall' });
  state.walls.push({ x1: ox + rw, y1: oy, x2: ox + rw, y2: oy + rh, type: 'wall' });
  state.walls.push({ x1: ox + rw, y1: oy + rh, x2: ox, y2: oy + rh, type: 'wall' });
  state.walls.push({ x1: ox, y1: oy + rh, x2: ox, y2: oy, type: 'wall' });
  state.walls.push({ x1: ox + 8 * g, y1: oy, x2: ox + 8 * g, y2: oy + rh * 0.6, type: 'wall' });
  state.walls.push({ x1: ox + rw, y1: oy + 3 * g, x2: ox + rw, y2: oy + 6 * g, type: 'window' });
  state.walls.push({ x1: ox + 2 * g, y1: oy, x2: ox + 5 * g, y2: oy, type: 'window' });
  state.walls.push({ x1: ox, y1: oy + 5 * g, x2: ox, y2: oy + 8 * g, type: 'door' });
  state.walls.push({ x1: ox + 8 * g, y1: oy + 5 * g, x2: ox + 11 * g, y2: oy + 5 * g, type: 'door' });
  updateStats();
  drawCanvas();
  showToast('Demo layout loaded!');
}

/* ═══════════════════════════════════════════
   MAIN ANALYSIS PIPELINE
═══════════════════════════════════════════ */
async function analyzeFloorPlan() {
  console.log("Analyze clicked! Elements:", state.walls.length);
  if (state.walls.length === 0) {
    showToast('Add some structural elements first.', 3500);
    return;
  }
  
  try {
    // 1. Process canvas data
    const data = analyzeFromCanvas();
    state.analysisData = data;
    
    // 2. IMPORTANT: Switch mode first so the 3D container is visible and has dimensions
    enableTabs();
    switchMode('3d');
    
    // 3. Build 3D Scene
    setTimeout(() => {
      console.log("Building 3D Scene...");
      buildThreeScene(data);
      showToast('3D Model Generated! 🏗️', 2000);
    }, 100);
    
    // 4. Run detailed material analysis in background
    generateMaterialReport(data);
    
  } catch (err) {
    console.error("Critical error in analyzeFloorPlan:", err);
    showToast('Analysis Error: ' + err.message, 5000);
  }
}

function analyzeFromCanvas() {
  const walls = state.walls.filter(s => s.type === 'wall');
  const windows = state.walls.filter(s => s.type === 'window');
  const doors = state.walls.filter(s => s.type === 'door');
  const scale = parseFloat(document.getElementById('scale-meters').value) || 1;
  const g = state.snapGrid;
  let totalWallLen = 0;
  walls.forEach(w => { totalWallLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / g * scale; });
  totalWallLen = Math.round(totalWallLen * 10) / 10;
  const totalArea = Math.round(totalWallLen * totalWallLen * 0.08 * 10) / 10;
  setStage('ps-parse', 'ps-parse-sub', `Processed ${state.walls.length} segments`, 20);
  setStage('ps-detect', 'ps-detect-sub', `${walls.length} Walls · ${windows.length} Windows`, 50);
  return { walls: walls.length, windows: windows.length, doors: doors.length, totalArea, totalWallLen, segments: state.walls };
}

/* ═══════════════════════════════════════════
   THREE.JS 3D SCENE
═══════════════════════════════════════════ */
let threeRenderer, threeScene, threeCamera;
let autoRotate = true, wireframe = false;
const meshes = [];
let threeControls;

function buildThreeScene(data) {
  const container = document.getElementById('three-canvas');
  const W = container.parentElement.clientWidth;
  const H = container.parentElement.clientHeight;

  if (threeRenderer) {
    threeScene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
    threeRenderer.dispose();
  }

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0xFAF7F2);
  threeScene.fog = new THREE.FogExp2(0xF5F1EB, 0.015);

  threeCamera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
  threeCamera.position.set(12, 16, 24);
  threeCamera.lookAt(0, 0, 0);

  threeRenderer = new THREE.WebGLRenderer({ canvas: container, antialias: true });
  threeRenderer.setSize(W, H);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
  threeControls.enableDamping = true;
  threeControls.dampingFactor = 0.05;
  threeControls.autoRotate = autoRotate;

  // Lighting
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 0.4);
  hemiLight.position.set(0, 50, 0);
  threeScene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  threeScene.add(sun);

  // Materials
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 0.7 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x0891B2, transparent: true, opacity: 0.4 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xEA580C, roughness: 0.5 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xE8E1D9, roughness: 0.8 });

  const segs = data.segments || [];
  const g = state.snapGrid;
  const scale = parseFloat(document.getElementById('scale-meters').value) || 1;
  const OFFSET_X = 15, OFFSET_Z = 10;

  meshes.length = 0;
  segs.forEach(seg => {
    const sx = (seg.x1 / g) * scale - OFFSET_X;
    const sz = (seg.y1 / g) * scale - OFFSET_Z;
    const ex = (seg.x2 / g) * scale - OFFSET_X;
    const ez = (seg.y2 / g) * scale - OFFSET_Z;
    const len = Math.hypot(ex - sx, ez - sz);
    if (len < 0.01) return;
    const angle = Math.atan2(ez - sz, ex - sx);
    const h = seg.type === 'wall' ? 3.1 : (seg.type === 'window' ? 1.0 : 2.5);
    const thk = seg.type === 'wall' ? 0.35 : 0.2;
    const geo = new THREE.BoxGeometry(len, h, thk);
    const mat = seg.type === 'window' ? windowMat : (seg.type === 'door' ? doorMat : wallMat);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set((sx + ex) / 2, h / 2, (sz + ez) / 2);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    threeScene.add(mesh);
    meshes.push(mesh);
  });

  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  threeScene.add(floorMesh);

  setupSimpleControls();
  animate3D();
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if (threeControls) {
    threeControls.autoRotate = autoRotate;
    threeControls.update();
  }
  if (threeRenderer) threeRenderer.render(threeScene, threeCamera);
}

function toggleAutoRotate() {
  autoRotate = !autoRotate;
  document.getElementById('btn-autorotate').classList.toggle('active', autoRotate);
}
function toggleWireframe() {
  wireframe = !wireframe;
  document.getElementById('btn-wireframe').classList.toggle('active', wireframe);
  meshes.forEach(m => { if (m.material) m.material.wireframe = wireframe; });
}
function resetCamera() { autoRotate = true; }

/* ═══════════════════════════════════════════
   MATERIAL REPORT
═══════════════════════════════════════════ */
async function generateMaterialReport(data) {
  const report = [
    { icon:'🧱', cat:'Masonry', name:'Concrete Blocks', qty: Math.ceil(data.totalWallLen * 12), unit:'blocks' },
    { icon:'🏗️', cat:'Foundation', name:'Ready Mix M25', qty: Math.ceil(data.totalArea * 0.15), unit:'m³' },
    { icon:'⚙️', cat:'Steel', name:'TMT Fe500', qty: Math.ceil(data.totalWallLen * 8), unit:'kg' },
    { icon:'🪟', cat:'Glazing', name:'Toughened Glass', qty: data.windows, unit:'sets' },
    { icon:'🚪', cat:'Joinery', name:'Solid Flash Doors', qty: data.doors, unit:'sets' }
  ];
  const grid = document.getElementById('mat-grid');
  grid.innerHTML = '';
  report.forEach(m => {
    grid.innerHTML += `
      <div class="mat-card">
        <div class="mat-icon">${m.icon}</div>
        <div class="mat-name">${m.name}</div>
        <div class="mat-qty">${m.qty}</div>
        <div class="mat-unit">${m.unit}</div>
      </div>`;
  });
  
  document.getElementById('rc-area').textContent = `${data.totalArea} m² Area`;
  document.getElementById('rc-walls').textContent = `${data.walls} Walls`;
  
  if (state.apiKey) {
    try {
      const narrative = await callGemini(data);
      document.getElementById('ai-text').innerText = narrative;
    } catch {
      document.getElementById('ai-text').innerText = "AI summary unavailable.";
    }
  } else {
    document.getElementById('ai-text').innerText = "No API key provided for AI analysis.";
  }
}

async function callGemini(data) {
  const prompt = `Concisely summarize the structural requirements for a ${data.totalArea}m2 floor plan with ${data.walls} walls.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`;
  const r = await fetch(url, { method: 'POST', body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}) });
  const j = await r.json();
  return j.candidates[0].content.parts[0].text;
}

/* ═══════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════ */
function showToast(m, d=3000) {
  const t = document.getElementById('toast');
  t.textContent = m; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), d);
}
function showProcessing() { document.getElementById('processing-overlay').classList.remove('hidden'); }
function hideProcessing() { document.getElementById('processing-overlay').classList.add('hidden'); }
async function setStage(st, sub, msg, pct) {
  document.getElementById(sub).textContent = msg;
  document.getElementById('proc-bar').style.width = pct + '%';
  document.querySelectorAll('.pstage').forEach(s => s.classList.remove('active'));
  document.getElementById(st).classList.add('active');
  await new Promise(r => setTimeout(r, 400));
}
function enableTabs() {
  document.getElementById('tab-3d').removeAttribute('disabled');
  document.getElementById('tab-report').removeAttribute('disabled');
}
function loadKey() { state.apiKey = localStorage.getItem('archai_key') || ''; }
function saveKey() {
  const k = document.getElementById('api-inp').value;
  localStorage.setItem('archai_key', k);
  state.apiKey = k;
  closeApiModal();
}
function openApiModal() { document.getElementById('api-modal').classList.remove('hidden'); }
function closeApiModal() { document.getElementById('api-modal').classList.add('hidden'); }
