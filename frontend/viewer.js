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
        
        // Add Title
        doc.setFontSize(22);
        doc.setTextColor(26, 26, 26); // black-soft (#1a1a1a)
        doc.text("Z-Axis Structural Material Report", 14, 22);

        // Styling the table
        doc.autoTable({
            html: '#materials-table',
            startY: 32,
            theme: 'grid',
            headStyles: { 
                fillColor: [6, 182, 212], // cyan-500 (#06b6d4)
                textColor: 255, 
                fontSize: 11, 
                fontStyle: 'bold',
                halign: 'left'
            },
            bodyStyles: { 
                textColor: 74, // brown-sec (#4a3b2a approx)
                fontSize: 10,
                cellPadding: 6
            },
            alternateRowStyles: { 
                fillColor: [248, 250, 252] // slate-50
            },
            margin: { top: 30 }
        });

        doc.save('Z-Axis_Materials_Report.pdf');
        
        if (typeof showToast === 'function') {
            showToast("Material Report Generated! 📥");
        }
    });
}

let is2DView = true;

if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
        is2DView = !is2DView;
        if (is2DView) {
            container3D.classList.add('hidden');
            resetCamBtn.classList.add('hidden');
            const pBtn = document.getElementById('print-model');
            if(pBtn) pBtn.classList.add('hidden');
            container2D.classList.remove('hidden');
            toggleViewBtn.textContent = 'Switch to 3D';
        } else {
            container2D.classList.add('hidden');
            container3D.classList.remove('hidden');
            resetCamBtn.classList.remove('hidden');
            const pBtn = document.getElementById('print-model');
            if(pBtn) pBtn.classList.remove('hidden');
            toggleViewBtn.textContent = 'Switch to 2D';

            // Immediately update 3D viewport dimensions to active container
            if (renderer && camera && container3D.clientWidth > 0 && container3D.clientHeight > 0) {
                camera.aspect = container3D.clientWidth / container3D.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container3D.clientWidth, container3D.clientHeight);
                if (controls) controls.update();
                if (scene) renderer.render(scene, camera);
            }
            // Trigger layout resize event for dat.GUI and additional layout responsiveness
            setTimeout(() => {
                if (renderer && camera && container3D.clientWidth > 0 && container3D.clientHeight > 0) {
                    camera.aspect = container3D.clientWidth / container3D.clientHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(container3D.clientWidth, container3D.clientHeight);
                }
                window.dispatchEvent(new Event('resize'));
            }, 50);
        }
    });
}

if (resetCamBtn) {
    resetCamBtn.addEventListener('click', () => {
        if (camera && controls) {
            gsap.to(camera.position, { x: 10, y: 15, z: 15, duration: 1, ease: "power2.inOut" });
            gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1, ease: "power2.inOut" });
        }
    });
}

let globalImg2D = null;
let globalParsedGeom2D = null;
let lastModelData = null; // Store for JSON export
let lastOpeningsPayload = null;

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
    const showDoors    = document.getElementById('cb-doors')?.checked !== false;
    const showWindows  = document.getElementById('cb-windows')?.checked !== false;

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

        if (showDoors && globalParsedGeom2D.openings) {
            globalParsedGeom2D.openings.filter(op => op.type === 'Door').forEach(op => {
                const px = dx + op.x * scaleX;
                const py = dy + op.y * scaleY;
                const r  = Math.max(12, (op.radius_px || 0) * scaleX);

                // ── Find nearest wall and get its screen-space angle ──────────
                let wallAngle = 0; // default: horizontal
                if (globalParsedGeom2D.walls && globalParsedGeom2D.walls.length) {
                    let bestDist = Infinity;
                    globalParsedGeom2D.walls.forEach(w => {
                        const wmx = dx + ((w.x1 + w.x2) / 2) * scaleX;
                        const wmy = dy + ((w.y1 + w.y2) / 2) * scaleY;
                        const d = Math.hypot(px - wmx, py - wmy);
                        if (d < bestDist) {
                            bestDist = d;
                            wallAngle = Math.atan2(
                                (w.y2 - w.y1) * scaleY,
                                (w.x2 - w.x1) * scaleX
                            );
                        }
                    });
                }

                // Hinge at pivot, panel goes along wall direction (closed position)
                const hingeX = px - Math.cos(wallAngle) * r * 0.5;
                const hingeY = py - Math.sin(wallAngle) * r * 0.5;
                const panelEndX = hingeX + Math.cos(wallAngle) * r;
                const panelEndY = hingeY + Math.sin(wallAngle) * r;

                // ── 1. Door panel line (closed position, along wall) ──────────
                ctx2d.beginPath();
                ctx2d.moveTo(hingeX, hingeY);
                ctx2d.lineTo(panelEndX, panelEndY);
                ctx2d.strokeStyle = '#f59e0b';
                ctx2d.lineWidth = 2.5;
                ctx2d.setLineDash([]);
                ctx2d.stroke();

                // ── 2. Swing arc — 90° from wall direction to perpendicular ───
                ctx2d.beginPath();
                ctx2d.arc(hingeX, hingeY, r, wallAngle, wallAngle + Math.PI / 2, false);
                ctx2d.strokeStyle = '#f59e0b';
                ctx2d.lineWidth = 1.5;
                ctx2d.setLineDash([5, 3]);
                ctx2d.stroke();
                ctx2d.setLineDash([]);

                // ── 3. Hinge pivot dot ────────────────────────────────────────
                ctx2d.beginPath();
                ctx2d.arc(hingeX, hingeY, 3.5, 0, Math.PI * 2);
                ctx2d.fillStyle = '#f59e0b';
                ctx2d.fill();
            });
        }

        if (showWindows && globalParsedGeom2D.openings) {
            globalParsedGeom2D.openings.filter(op => op.type === 'Window').forEach(op => {
                const px   = dx + op.x * scaleX;
                const py   = dy + op.y * scaleY;
                const half = Math.max(10, ((op.span_px || 24) * scaleX) / 2);
                const THICK = 7; // glazing band thickness in canvas px

                // ── Find nearest wall angle in screen space ───────────────────
                let wallAngle = 0;
                if (globalParsedGeom2D.walls && globalParsedGeom2D.walls.length) {
                    let bestDist = Infinity;
                    globalParsedGeom2D.walls.forEach(w => {
                        const wmx = dx + ((w.x1 + w.x2) / 2) * scaleX;
                        const wmy = dy + ((w.y1 + w.y2) / 2) * scaleY;
                        const d = Math.hypot(px - wmx, py - wmy);
                        if (d < bestDist) {
                            bestDist = d;
                            wallAngle = Math.atan2(
                                (w.y2 - w.y1) * scaleY,
                                (w.x2 - w.x1) * scaleX
                            );
                        }
                    });
                }

                // ── Draw rotated window band ─────────────────────────────────
                ctx2d.save();
                ctx2d.translate(px, py);
                ctx2d.rotate(wallAngle);  // align to wall direction

                // Glazing fill
                ctx2d.fillStyle = 'rgba(59, 130, 246, 0.25)';
                ctx2d.fillRect(-half, -THICK / 2, half * 2, THICK);

                // Glazing outline
                ctx2d.strokeStyle = '#3b82f6';
                ctx2d.lineWidth = 1.5;
                ctx2d.setLineDash([]);
                ctx2d.strokeRect(-half, -THICK / 2, half * 2, THICK);

                // Centre pane divider (perpendicular to wall span)
                ctx2d.beginPath();
                ctx2d.moveTo(0, -THICK / 2);
                ctx2d.lineTo(0,  THICK / 2);
                ctx2d.strokeStyle = '#93c5fd';
                ctx2d.lineWidth = 1;
                ctx2d.stroke();

                ctx2d.restore();
            });
        }
    }
}

['cb-image', 'cb-walls', 'cb-rooms', 'cb-doors', 'cb-windows'].forEach(id => {
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

const changeImageBtn = document.getElementById('change-image-btn');
if (changeImageBtn) {
    changeImageBtn.addEventListener('click', () => {
        if (fileUpload) fileUpload.click();
    });
}

// Start Pipeline Simulation
async function startPipeline(file) {
    if (typeof window.resetMaterialsDrawer === 'function') {
        window.resetMaterialsDrawer();
    }
    uploadContainer.classList.add('hidden');
    resultsSection.classList.add('hidden');
    resultsSection.classList.remove('flex');
    loadingState.classList.remove('hidden');

    let pipelineRes = null;
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const apiBase = (window.location.protocol === 'file:' || window.location.port === '5500' || window.location.port === '3000') 
            ? 'http://127.0.0.1:5000' 
            : window.location.origin;
        try {
            const res = await fetch(`${apiBase}/pipeline`, { method: 'POST', body: formData });
            pipelineRes = await res.json();
            if (pipelineRes.status !== "success") throw new Error(pipelineRes.message || "Pipeline error");
        } catch(e) { 
            console.error("Pipeline connectivity failed:", e);
            alert("⚠️ CONNECTION ERROR: Unable to reach the structural intelligence engine.\n\nPlease ensure the backend service is running!\nDetails: " + e.message);
            loadingState.classList.add('hidden');
            return;
        }
    }

    loadingState.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    resultsSection.classList.add('flex');

    if (typeof window.showMaterialsDrawerContent === 'function') {
        window.showMaterialsDrawerContent();
    }
    
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

    // Render the 2D processed photo (now in grayscale) and detections
    if (pipelineRes && pipelineRes.artifacts && pipelineRes.artifacts.grayscale_preview && ctx2d) {
        globalParsedGeom2D = pipelineRes.geom;
        const img = new Image();
        img.onload = () => {
            globalImg2D = img;
            draw2DView();
        };
        img.src = pipelineRes.artifacts.grayscale_preview;
    }
    
    if (pipelineRes && pipelineRes.model) {
        lastModelData = pipelineRes.model; // Store for JSON export
        // Build door/window data for 3D rendering
        const geom = pipelineRes.geom || {};
        const imgSize = geom.image_size_px || { width: 600, height: 400 };
        const pxPerM  = (pipelineRes.model.scale || 100);
        lastOpeningsPayload = {
            list:  (geom.openings || []),
            imgW:  imgSize.width,
            imgH:  imgSize.height,
            scale: pxPerM
        };

        // Initialize Three.js View with the REAL architectural model
        initThreeJS(pipelineRes.model.walls, lastOpeningsPayload);
        
        // Populate Table and Cards dynamically from the tradeoff_engine outputs
        const wallsWithExplanations = pipelineRes.materials.map((m, idx) => ({
            id: m.element_id,
            type: m.type === 'LOAD_BEARING' ? 'load-bearing' : 'partition',
            material: m.materials[0].name,
            cost: m.materials[0].cost,
            strength: m.materials[0].strength,
            explanation: (pipelineRes.explanations && pipelineRes.explanations[idx] && pipelineRes.explanations[idx].explanation) ? pipelineRes.explanations[idx].explanation : (m.explanation || "Calculated primary structural component.")
        }));
        populateResults(wallsWithExplanations);
    }
    
    feather.replace();
}

// --- Three.js Implementation --- //
let scene, camera, renderer, controls, gui;

// Store global animation frame ID and resize handler to prevent leaks
let animationFrameId = null;
let currentResizeHandler = null;

function initThreeJS(walls, pipelineOpenings = null) {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // 1. Cleanup previous WebGL Context & Animation Loop
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (currentResizeHandler) {
        window.removeEventListener('resize', currentResizeHandler);
        currentResizeHandler = null;
    }
    if (renderer) {
        try {
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer.dispose();
        } catch (e) {
            console.warn("Renderer cleanup warning:", e);
        }
        renderer = null;
    }
    if (scene) {
        try {
            scene.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        } catch (e) {
            console.warn("Scene cleanup warning:", e);
        }
    }

    // Clear container children (old GUI, canvases, etc.)
    container.innerHTML = '';

    // 2. Setup GUI Controls
    if (gui) { 
        try { gui.destroy(); } catch (e) {} 
        gui = null;
    }
    if (typeof dat !== 'undefined' && dat.GUI) {
        gui = new dat.GUI({ autoPlace: false });
        gui.domElement.style.position = 'absolute';
        gui.domElement.style.top = '10px';
        gui.domElement.style.left = '10px';
        gui.domElement.style.zIndex = '20';
        container.appendChild(gui.domElement);

        const guiParams = { showLoadBearing: true, showPartitions: true, showDoors3D: true, showWindows3D: true };
        const wallsFolder = gui.addFolder('Wall Visibility');
        wallsFolder.add(guiParams, 'showLoadBearing').name('Load Bearing').onChange(v => {
            if (scene) {
                scene.traverse((child) => {
                    if (child.isMesh && child.userData.type === 'load-bearing') child.visible = v;
                });
            }
        });
        wallsFolder.add(guiParams, 'showPartitions').name('Partitions').onChange(v => {
            if (scene) {
                scene.traverse((child) => {
                    if (child.isMesh && child.userData.type === 'partition') child.visible = v;
                });
            }
        });
        wallsFolder.open();

        const openingsFolder = gui.addFolder('Openings');
        openingsFolder.add(guiParams, 'showDoors3D').name('Doors').onChange(v => {
            if (scene) {
                scene.traverse((child) => {
                    if (child.isMesh && child.userData.type === 'door') child.visible = v;
                });
            }
        });
        openingsFolder.add(guiParams, 'showWindows3D').name('Windows').onChange(v => {
            if (scene) {
                scene.traverse((child) => {
                    if (child.isMesh && child.userData.type === 'window') child.visible = v;
                });
            }
        });
        openingsFolder.open();
    }

    // 3. Robust Dimension Calculation (never 0x0 or NaN)
    let width = container.clientWidth;
    let height = container.clientHeight;
    if (!width || !height || width <= 0 || height <= 0) {
        const c2d = document.getElementById('canvas-container-2d');
        width = (c2d && c2d.clientWidth > 0) ? c2d.clientWidth : (container.parentElement ? container.parentElement.clientWidth : 800);
        height = (c2d && c2d.clientHeight > 0) ? c2d.clientHeight : (container.parentElement ? container.parentElement.clientHeight : 520);
    }
    if (!width || width <= 0) width = 800;
    if (!height || height <= 0) height = 520;

    // 4. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#FAF7F2');

    const aspect = width / height;
    camera = new THREE.PerspectiveCamera(45, (isFinite(aspect) && aspect > 0) ? aspect : 1.6, 0.1, 1000);
    camera.position.set(10, 15, 15);

    // 5. Safe WebGLRenderer Setup with Context-Loss Recovery
    try {
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance"
        });
    } catch (e) {
        console.warn("Failed WebGL with antialias, trying without...", e);
        try {
            renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
        } catch (e2) {
            console.error("WebGL completely unsupported or blocked:", e2);
            alert("Could not initialize 3D view. WebGL context failed. Please enable 'Hardware Acceleration' in browser settings or restart your browser.");
            return;
        }
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('WebGL context lost. Halting render loop and awaiting restoration...');
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored! Re-initializing 3D scene...');
        if (lastModelData && lastModelData.walls) {
            initThreeJS(lastModelData.walls, lastOpeningsPayload);
        }
    }, false);

    container.appendChild(canvas);

    // 6. Controls
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Lock below ground

    // 7. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // 8. Floor Grid & Plane
    const gridHelper = new THREE.GridHelper(24, 24, 0x8B6F47, 0xCBD5E1);
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    const planeGeometry = new THREE.PlaneGeometry(30, 30);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // 9. Build Extruded CSG Walls with Validation & Geometry Fallbacks
    if (Array.isArray(walls)) {
        walls.forEach(w => {
            try {
                const color = (w.type === 'LOAD_BEARING') ? 0xef4444 : 0x9ca3af;
                const dx = (w.x2 || 0) - (w.x1 || 0);
                const dz = (w.z2 || 0) - (w.z1 || 0);
                const length = Math.hypot(dx, dz);
                if (!length || length < 0.05 || isNaN(length)) return;

                const wallHeight = w.height || 3.0;
                const wallThk = w.thickness || 0.2;

                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(length, 0);
                shape.lineTo(length, wallHeight);
                shape.lineTo(0, wallHeight);
                shape.closePath();

                // Punch out Windows safely with boundary validation
                if (w.windows && Array.isArray(w.windows) && w.windows.length > 0) {
                    w.windows.forEach(win => {
                        const winW = win.w || 0.8;
                        const winH = win.h || 1.2;
                        const winElev = win.elevation || 1.0;
                        const margin = 0.05;

                        // Only carve hole if wall is large enough to contain window with positive margins
                        if (length > winW + margin * 2 && wallHeight > winH + margin * 2) {
                            const halfW = winW / 2;
                            const safeU = Math.max(halfW + margin, Math.min(length - halfW - margin, win.u || (length / 2)));
                            const safeElev = Math.max(margin, Math.min(wallHeight - winH - margin, winElev));
                            const safeH = Math.min(winH, wallHeight - safeElev - margin);

                            const hole = new THREE.Path();
                            hole.moveTo(safeU - halfW, safeElev);
                            hole.lineTo(safeU + halfW, safeElev);
                            hole.lineTo(safeU + halfW, safeElev + safeH);
                            hole.lineTo(safeU - halfW, safeElev + safeH);
                            hole.closePath();
                            shape.holes.push(hole);
                        }
                    });
                }

                let geometry;
                try {
                    const extrudeSettings = { depth: wallThk, bevelEnabled: false };
                    geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    geometry.translate(-length / 2, 0, -wallThk / 2);
                } catch (extrErr) {
                    console.warn("Extrude failed for wall, using box fallback:", extrErr);
                    geometry = new THREE.BoxGeometry(length, wallHeight, wallThk);
                    geometry.translate(0, wallHeight / 2, 0);
                }

                const material = new THREE.MeshStandardMaterial({ 
                    color: color,
                    roughness: 0.7,
                    metalness: 0.1
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(((w.x1 || 0) + (w.x2 || 0)) / 2, 0, ((w.z1 || 0) + (w.z2 || 0)) / 2);
                mesh.rotation.y = -Math.atan2(dz, dx);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { type: w.type === 'LOAD_BEARING' ? 'load-bearing' : 'partition' };

                try {
                    const edges = new THREE.EdgesGeometry(geometry);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5 }));
                    mesh.add(line);
                } catch (e) {}

                scene.add(mesh);
            } catch (err) {
                console.warn("Failed to create wall mesh:", err);
            }
        });
    }

    // 10. 3D Openings (Doors & Windows)
    if (pipelineOpenings && Array.isArray(pipelineOpenings.list) && pipelineOpenings.list.length > 0) {
        const imgW = pipelineOpenings.imgW || 600;
        const imgH = pipelineOpenings.imgH || 400;
        const sM   = (pipelineOpenings.scale && pipelineOpenings.scale > 0) ? pipelineOpenings.scale : 100;

        function _nearestWallAngle(xM, zM) {
            let best = null;
            let bestDist = Infinity;
            if (Array.isArray(walls)) {
                walls.forEach(w => {
                    const mx = ((w.x1 || 0) + (w.x2 || 0)) / 2;
                    const mz = ((w.y1 || 0) + (w.y2 || 0)) / 2;
                    const d = Math.hypot(xM - mx, zM - mz);
                    if (d < bestDist) { bestDist = d; best = w; }
                });
            }
            if (!best) return 0;
            return Math.atan2((best.z2 || 0) - (best.z1 || 0), (best.x2 || 0) - (best.x1 || 0));
        }

        const windowMat = new THREE.MeshStandardMaterial({
            color: 0x60a5fa, roughness: 0.1, metalness: 0.1,
            transparent: true, opacity: 0.45
        });

        pipelineOpenings.list.forEach(op => {
            try {
                const xM = (op.x - imgW / 2) / sM;
                const zM = (op.y - imgH / 2) / sM;
                if (!isFinite(xM) || !isFinite(zM)) return;

                if (op.type === 'Door') {
                    const doorW = Math.max(0.7, (op.radius_px * 2 || 70) / sM);
                    const doorH = 2.1;
                    const angle = _nearestWallAngle(xM, zM);

                    const panelGeo = new THREE.BoxGeometry(doorW, doorH, 0.05);
                    const panelMat = new THREE.MeshStandardMaterial({
                        color: 0xd97706, roughness: 0.5, metalness: 0.2
                    });
                    const panel = new THREE.Mesh(panelGeo, panelMat);

                    const hingeOffsetX = Math.cos(angle) * doorW / 2;
                    const hingeOffsetZ = Math.sin(angle) * doorW / 2;
                    panel.position.set(
                        xM - hingeOffsetX * 0.5,
                        doorH / 2,
                        zM - hingeOffsetZ * 0.5
                    );
                    panel.rotation.y = -angle + Math.PI / 4;
                    panel.userData = { type: 'door' };
                    panel.castShadow = true;
                    panel.receiveShadow = true;

                    try {
                        const edgeGeo = new THREE.EdgesGeometry(panelGeo);
                        panel.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
                    } catch (e) {}

                    scene.add(panel);

                } else if (op.type === 'Window') {
                    const winW   = Math.max(0.3, (op.span_px || 40) / sM);
                    const sill   = 1.0;
                    const head   = 2.2;
                    const winH   = head - sill;
                    const angle  = _nearestWallAngle(xM, zM);

                    let wallThk = 0.15;
                    if (Array.isArray(walls)) {
                        walls.forEach(w => {
                            const mx = ((w.x1 || 0) + (w.x2 || 0)) / 2;
                            const mz = ((w.z1 || 0) + (w.z2 || 0)) / 2;
                            if (Math.hypot(xM - mx, zM - mz) < 1.5) {
                                wallThk = w.thickness || 0.15;
                            }
                        });
                    }

                    const winGeo = new THREE.BoxGeometry(winW, winH, wallThk + 0.02);
                    const winMesh = new THREE.Mesh(winGeo, windowMat);

                    winMesh.position.set(xM, sill + winH / 2, zM);
                    winMesh.rotation.y = -angle;
                    winMesh.userData = { type: 'window' };
                    scene.add(winMesh);

                    try {
                        const frameGeo = new THREE.EdgesGeometry(winGeo);
                        const frameMesh = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
                        winMesh.add(frameMesh);
                    } catch (e) {}
                }
            } catch (opErr) {
                console.warn("Failed creating opening 3D mesh:", opErr);
            }
        });
    }

    // 11. Export JSON Button (Re-bound cleanly)
    const printBtnEl = document.getElementById('print-model');
    if (printBtnEl) {
        const newPrintBtn = printBtnEl.cloneNode(true);
        printBtnEl.parentNode.replaceChild(newPrintBtn, printBtnEl);
        
        const btnText = newPrintBtn.querySelector('span');
        if (btnText) btnText.textContent = "Export JSON";
        
        newPrintBtn.addEventListener('click', () => {
            if (!lastModelData) {
                alert("No model data available to export.");
                return;
            }
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lastModelData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href",     dataStr);
            downloadAnchorNode.setAttribute("download", "z_axis_model.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            if (typeof showToast === 'function') {
                showToast("JSON Model Exported! 📄");
            }
        });
        if (window.feather) feather.replace();
    }

    // 12. Dynamic Resize Handler
    currentResizeHandler = () => {
        if (!container || !renderer || !camera) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (cw > 0 && ch > 0) {
            camera.aspect = cw / ch;
            camera.updateProjectionMatrix();
            renderer.setSize(cw, ch);
        }
    };
    window.addEventListener('resize', currentResizeHandler);

    // 13. High-Efficiency Animate Loop (Only renders when 3D is active and visible)
    const animate = function () {
        animationFrameId = requestAnimationFrame(animate);
        if (!is2DView && container.clientWidth > 0 && container.clientHeight > 0 && renderer && scene && camera) {
            if (controls) controls.update();
            renderer.render(scene, camera);
        }
    };

    animate();
}

// --- Populate Results UI --- //
function populateResults(walls) {
    materialsTableBody.innerHTML = '';
    llmCardsContainer.innerHTML = '';

    walls.forEach(w => {
        // 1. Table Rows
        const isLoadBearing = (w.type === 'load-bearing' || w.type === 'LOAD_BEARING');
        const typeBadgeClass = isLoadBearing 
            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' 
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium';
        const typeLabel = isLoadBearing ? 'Load-Bearing (Window)' : 'Partition (No Window)';
            
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition-colors";
        row.innerHTML = `
            <td class="p-4 border-b border-slate-100 font-semibold text-slate-800">${w.id}</td>
            <td class="p-4 border-b border-slate-100"><span class="px-3 py-1 text-xs rounded-full ${typeBadgeClass}">${typeLabel}</span></td>
            <td class="p-4 border-b border-slate-100 font-medium text-brown-dark">${w.material}</td>
            <td class="p-4 border-b border-slate-100 text-slate-600">${w.cost}</td>
            <td class="p-4 border-b border-slate-100 text-slate-600"><span class="flex items-center"><i data-feather="shield" class="w-4 h-4 mr-2 text-amber-600"></i> ${w.strength}</span></td>
        `;
        materialsTableBody.appendChild(row);

        // 2. Structural Specification Cards
        const card = document.createElement('div');
        card.className = "p-6 rounded-2xl border border-slate-200 bg-white hover:border-brown-primary transition-all shadow-sm relative overflow-hidden group";
        
        card.innerHTML = `
            <div class="absolute top-0 left-0 w-2 h-full ${isLoadBearing ? 'bg-amber-600' : 'bg-emerald-500'}"></div>
            <div class="ml-4">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-bold text-slate-900">${w.id} — ${typeLabel}</h4>
                        <p class="text-xs text-brown-primary mt-1 uppercase tracking-wider font-semibold">${w.material}</p>
                    </div>
                    <div class="${isLoadBearing ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'} p-2 rounded-lg">
                        <i data-feather="${isLoadBearing ? 'layout' : 'grid'}" class="w-5 h-5"></i>
                    </div>
                </div>
                <p class="text-sm text-slate-700 border-l-2 ${isLoadBearing ? 'border-amber-400' : 'border-emerald-300'} pl-4 py-1 leading-relaxed">
                    ${w.explanation}
                </p>
                <div class="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                    <span class="flex items-center text-brown-dark"><i data-feather="check-circle" class="w-3.5 h-3.5 mr-1 text-emerald-600"></i> ${isLoadBearing ? 'RCC Lintel Mandatory (IS 456 / Eurocode 2)' : 'Non-Structural Partition (IS 2185)'}</span>
                    <span class="flex items-center text-slate-600"><i data-feather="shield" class="w-3.5 h-3.5 mr-1 text-amber-600"></i> Compressive Strength: ${w.strength}</span>
                </div>
            </div>
        `;
        llmCardsContainer.appendChild(card);
    });
}
