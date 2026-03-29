// --- GSAP Scroll Animations Setup --- //
document.addEventListener('DOMContentLoaded', () => {
    // Hero Animations
    gsap.from(".hero-title", { duration: 1, y: 30, opacity: 0, ease: "power3.out", delay: 0.2 });
    gsap.from(".hero-subtitle", { duration: 1, y: 20, opacity: 0, ease: "power3.out", delay: 0.4 });
    gsap.from(".hero-buttons", { duration: 1, y: 20, opacity: 0, ease: "power3.out", delay: 0.6 });

    // Hero Background Parallax
    gsap.to("#hero-bg-container", {
        y: 100,
        scale: 1.1,
        ease: "none",
        scrollTrigger: {
            trigger: "section",
            start: "top top",
            end: "bottom top",
            scrub: true
        }
    });

    // Cards Scroll Animation
    gsap.from(".feature-card", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
            trigger: "#features",
            start: "top 80%",
        }
    });

    // Split Section Animation
    gsap.from(".split-text", {
        x: -50,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
            trigger: "#about",
            start: "top 75%",
        }
    });
    
    gsap.from(".split-image", {
        x: 50,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
            trigger: "#about",
            start: "top 75%",
        }
    });
});

// --- File Upload & Pipeline Simulation --- //
const fileUpload = document.getElementById('file-upload');
const dropZone = document.getElementById('drop-zone');
const uploadContainer = document.getElementById('upload-container');
const loadingState = document.getElementById('loading-state');
const resultsSection = document.getElementById('results-section');
const materialsTableBody = document.getElementById('materials-table-body');
const llmCardsContainer = document.getElementById('llm-cards-container');

// Toggle Elements
const toggleViewBtn = document.getElementById('toggle-view');
const container3D = document.getElementById('canvas-container');
const container2D = document.getElementById('canvas-container-2d');
const resetCamBtn = document.getElementById('reset-cam');
const canvas2d = document.getElementById('canvas-2d');
const ctx2d = canvas2d ? canvas2d.getContext('2d') : null;

const exportBtn = document.getElementById('export-pdf');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Z-Axis Structural Material Report", 14, 22);
        
        // Grab table element directly to AutoTable
        doc.autoTable({
            html: 'table',
            startY: 30,
            theme: 'striped',
            headStyles: { fillColor: [6, 182, 212] },
            styles: { fontSize: 10 }
        });
        
        doc.save('Z-Axis_Materials_Report.pdf');
    });
}

let is2DView = true;

if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
        is2DView = !is2DView;
        if (is2DView) {
            container3D.classList.add('hidden');
            resetCamBtn.classList.add('hidden');
            container2D.classList.remove('hidden');
            toggleViewBtn.textContent = 'Switch to 3D';
        } else {
            container2D.classList.add('hidden');
            container3D.classList.remove('hidden');
            resetCamBtn.classList.remove('hidden');
            toggleViewBtn.textContent = 'Switch to 2D';
            // Force WebGL to grab new dynamic dimensions now that it's unhidden
            window.dispatchEvent(new Event('resize'));
        }
    });
}

let globalImg2D = null;
let globalParsedGeom2D = null;

function draw2DView() {
    if (!globalImg2D || !ctx2d) return;
    
    const containerW = container2D.clientWidth || 800;
    const containerH = container2D.clientHeight || 500;
    canvas2d.width = containerW;
    canvas2d.height = containerH;
    
    const scale = Math.min(containerW / globalImg2D.width, containerH / globalImg2D.height) * 0.9;
    const drawW = globalImg2D.width * scale;
    const drawH = globalImg2D.height * scale;
    const dx = (containerW - drawW) / 2;
    const dy = (containerH - drawH) / 2;
    
    ctx2d.clearRect(0, 0, containerW, containerH);
    
    const showImage = document.getElementById('cb-image')?.checked !== false;
    const showWalls = document.getElementById('cb-walls')?.checked !== false;
    const showRooms = document.getElementById('cb-rooms')?.checked !== false;
    const showOpenings = document.getElementById('cb-openings')?.checked !== false;

    if (showImage) {
        ctx2d.globalAlpha = 1.0;
        ctx2d.drawImage(globalImg2D, dx, dy, drawW, drawH);
    } else {
        ctx2d.fillStyle = '#ffffff';
        ctx2d.fillRect(0, 0, containerW, containerH);
    }

    if (globalParsedGeom2D) {
        ctx2d.lineWidth = 2;
        const scaleX = drawW / globalImg2D.width;
        const scaleY = drawH / globalImg2D.height;
        
        if (showRooms && globalParsedGeom2D.rooms) {
            globalParsedGeom2D.rooms.forEach(r => {
                if (r.polygon_points && r.polygon_points.length > 0) {
                    ctx2d.beginPath();
                    r.polygon_points.forEach((p, idx) => {
                        const px = dx + p[0] * scaleX;
                        const py = dy + p[1] * scaleY;
                        if (idx === 0) ctx2d.moveTo(px, py);
                        else ctx2d.lineTo(px, py);
                    });
                    ctx2d.closePath();
                    ctx2d.fillStyle = "rgba(139, 92, 246, 0.15)";
                    ctx2d.fill();
                    ctx2d.strokeStyle = "#8b5cf6";
                    ctx2d.stroke();
                }
            });
        }
        
        if (showWalls && globalParsedGeom2D.walls) {
            globalParsedGeom2D.walls.forEach(w => {
                ctx2d.beginPath();
                ctx2d.moveTo(dx + w.x1 * scaleX, dy + w.y1 * scaleY);
                ctx2d.lineTo(dx + w.x2 * scaleX, dy + w.y2 * scaleY);
                const classification = w.classification || w.type;
                ctx2d.strokeStyle = (classification === "LOAD_BEARING") ? "#ef4444" : "#10b981";
                ctx2d.stroke();
            });
        }

        if (showOpenings && globalParsedGeom2D.openings) {
            globalParsedGeom2D.openings.forEach(op => {
                const px = dx + op.x * scaleX;
                const py = dy + op.y * scaleY;
                if (op.type === "Door") {
                    ctx2d.beginPath();
                    ctx2d.arc(px, py, (op.radius_px * scaleX) || 15, 0, Math.PI * 2);
                    ctx2d.strokeStyle = "#f59e0b";
                    ctx2d.setLineDash([4, 2]);
                    ctx2d.stroke();
                    ctx2d.setLineDash([]);
                } else if (op.type === "Window") {
                    ctx2d.fillStyle = "rgba(59, 130, 246, 0.6)";
                    ctx2d.beginPath();
                    ctx2d.arc(px, py, ((op.span_px * scaleX) / 2) || 12, 0, Math.PI * 2);
                    ctx2d.fill();
                }
            });
        }
    }
}

['cb-image', 'cb-walls', 'cb-rooms', 'cb-openings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', draw2DView);
});


// Mock Drag and Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-cyan-100', 'border-cyan-500');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('bg-cyan-100', 'border-cyan-500');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('bg-cyan-100', 'border-cyan-500');
    if (e.dataTransfer.files.length) {
        startPipeline(e.dataTransfer.files[0]);
    }
});

fileUpload.addEventListener('change', (e) => {
    if (e.target.files.length) {
        startPipeline(e.target.files[0]);
    }
});

// Start Pipeline Simulation
async function startPipeline(file) {
    uploadContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');

    let pipelineRes = null;
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('http://127.0.0.1:5000/pipeline', { method: 'POST', body: formData });
            pipelineRes = await res.json();
            if (pipelineRes.status !== "success") throw new Error(pipelineRes.message || "Pipeline error");
        } catch(e) { 
            console.error("Pipeline failed", e);
            alert("Error running the intelligence pipeline! Check backend console.");
            loadingState.classList.add('hidden');
            return;
        }
    }

    loadingState.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    resultsSection.classList.add('flex');
    
    // Show 2D View by Default
    is2DView = true;
    container3D.classList.add('hidden');
    resetCamBtn.classList.add('hidden');
    container2D.classList.remove('hidden');
    if (toggleViewBtn) {
        toggleViewBtn.textContent = 'Switch to 3D';
        toggleViewBtn.classList.remove('hidden');
    }
    
    const exportBtn = document.getElementById('export-pdf');
    if (exportBtn) exportBtn.classList.remove('hidden');
    exportBtn.classList.add('flex');

    // Render the 2D uploaded photo and detections
    if (file && ctx2d && pipelineRes) {
        globalParsedGeom2D = pipelineRes.geom;
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                globalImg2D = img;
                draw2DView();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    if (pipelineRes && pipelineRes.model) {
        // Initialize Three.js View with the REAL architectural model
        initThreeJS(pipelineRes.model.walls);
        
        // Populate Table and Cards dynamically from the tradeoff_engine outputs
        const wallsWithExplanations = pipelineRes.materials.map((m, idx) => ({
            id: m.element_id,
            type: m.type === 'LOAD_BEARING' ? 'load-bearing' : 'partition',
            material: m.materials[0].name,
            cost: m.materials[0].cost,
            strength: m.materials[0].strength,
            explanation: pipelineRes.explanations[idx] || "Calculated primary internal structural component."
        }));
        populateResults(wallsWithExplanations);
    }
    
    feather.replace();
}

// --- Three.js Implementation --- //
let scene, camera, renderer, controls, gui;

function initThreeJS(walls) {
    const container = document.getElementById('canvas-container');
    
    // Clear old canvases if any
    container.innerHTML = '';
    
    if (gui) { gui.destroy(); }
    gui = new dat.GUI({ autoPlace: false });
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '10px';
    gui.domElement.style.left = '10px';
    container.appendChild(gui.domElement);

    const guiParams = { showLoadBearing: true, showPartitions: true };
    const wallsFolder = gui.addFolder('Wall Visibility');
    
    wallsFolder.add(guiParams, 'showLoadBearing').name('Load Bearing').onChange(v => {
        scene.traverse((child) => {
            if (child.isMesh && child.userData.type === 'load-bearing') child.visible = v;
        });
    });
    wallsFolder.add(guiParams, 'showPartitions').name('Partitions').onChange(v => {
        scene.traverse((child) => {
            if (child.isMesh && child.userData.type === 'partition') child.visible = v;
        });
    });
    wallsFolder.open();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9'); // slate-100

    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(10, 15, 15);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Lock below ground

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Floor Grid & Plane
    const gridHelper = new THREE.GridHelper(20, 20, 0x06B6D4, 0xCBD5E1);
    scene.add(gridHelper);

    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // Build Extruded CSG Walls
    walls.forEach(w => {
        const color = (w.type === 'LOAD_BEARING') ? 0xef4444 : 0x9ca3af;
        const dx = w.x2 - w.x1;
        const dz = w.z2 - w.z1;
        const length = Math.hypot(dx, dz);
        
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(length, 0);
        shape.lineTo(length, w.height);
        shape.lineTo(0, w.height);
        shape.lineTo(0, 0);
        
        // Punch out Windows!
        if (w.windows && w.windows.length > 0) {
            w.windows.forEach(win => {
                // Ensure window doesn't bleed outside the wall length parameter
                const safeU = Math.max(win.w/2, Math.min(length - win.w/2, win.u));
                const hole = new THREE.Path();
                hole.moveTo(safeU - win.w/2, win.elevation);
                hole.lineTo(safeU + win.w/2, win.elevation);
                hole.lineTo(safeU + win.w/2, win.elevation + win.h);
                hole.lineTo(safeU - win.w/2, win.elevation + win.h);
                hole.moveTo(safeU - win.w/2, win.elevation);
                shape.holes.push(hole);
            });
        }
        
        const extrudeSettings = { depth: w.thickness, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Center for origin rotation mapping
        geometry.translate(-length / 2, 0, -w.thickness / 2);
        
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set((w.x1 + w.x2) / 2, 0, (w.z1 + w.z2) / 2);
        
        // Face the extrusion along the wall vector
        mesh.rotation.y = -Math.atan2(dz, dx);
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: w.type === 'LOAD_BEARING' ? 'load-bearing' : 'partition' };
        
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        mesh.add(line);
        
        scene.add(mesh);
    });

    // Reset View Button
    document.getElementById('reset-cam').addEventListener('click', () => {
        gsap.to(camera.position, { x: 10, y: 15, z: 15, duration: 1, ease: "power2.inOut" });
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1, ease: "power2.inOut" });
    });

    // Resize Handler
    window.addEventListener('resize', () => {
        if (container.clientWidth > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });

    // Animate Loop
    const animate = function () {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    };

    animate();
}

// --- Populate Results UI --- //
function populateResults(walls) {
    materialsTableBody.innerHTML = '';
    llmCardsContainer.innerHTML = '';

    walls.forEach(w => {
        // 1. Table Rows
        const typeBadgeClass = w.type === 'load-bearing' 
            ? 'bg-red-50 text-red-600 border border-red-200' 
            : 'bg-slate-100 text-slate-600 border border-slate-200';
            
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition-colors";
        row.innerHTML = `
            <td class="p-4 border-b border-slate-100 font-semibold text-slate-800">${w.id}</td>
            <td class="p-4 border-b border-slate-100"><span class="px-3 py-1 text-xs rounded-full font-medium ${typeBadgeClass}">${w.type}</span></td>
            <td class="p-4 border-b border-slate-100 font-medium text-cyan-600">${w.material}</td>
            <td class="p-4 border-b border-slate-100 text-slate-600">${w.cost}</td>
            <td class="p-4 border-b border-slate-100 text-slate-600"><span class="flex items-center"><i data-feather="shield" class="w-4 h-4 mr-2 text-cyan-500"></i> ${w.strength}</span></td>
        `;
        materialsTableBody.appendChild(row);

        // 2. LLM Cards
        const card = document.createElement('div');
        card.className = "p-6 rounded-2xl border border-slate-200 bg-white hover:border-cyan-300 transition-colors shadow-sm relative overflow-hidden group";
        
        // Add subtle accent glow for load-bearing
        const glowColor = w.type === 'load-bearing' ? 'bg-red-50' : 'bg-slate-50';
        
        card.innerHTML = `
            <div class="absolute top-0 left-0 w-2 h-full ${w.type === 'load-bearing' ? 'bg-red-400' : 'bg-slate-300'}"></div>
            <div class="ml-4">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-bold text-slate-900">${w.id} Analysis</h4>
                        <p class="text-xs text-slate-500 mt-1 uppercase tracking-wider">${w.material}</p>
                    </div>
                    <div class="bg-cyan-50 p-2 rounded-lg text-cyan-600 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        <i data-feather="cpu" class="w-5 h-5"></i>
                    </div>
                </div>
                <p class="text-sm text-slate-600 border-l-2 border-slate-200 pl-4 py-1 italic leading-relaxed">
                    "${w.explanation}"
                </p>
                <div class="mt-4 pt-4 border-t border-slate-100 flex gap-4 text-xs font-medium text-slate-500">
                    <span class="flex items-center"><i data-feather="loader" class="w-3 h-3 mr-1"></i> Claude 3.5 Sonnet</span>
                    <span class="flex items-center text-cyan-600"><i data-feather="check" class="w-3 h-3 mr-1"></i> Confirmed Pipeline</span>
                </div>
            </div>
        `;
        llmCardsContainer.appendChild(card);
    });
}
