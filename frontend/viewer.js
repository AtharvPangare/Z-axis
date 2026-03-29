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
function startPipeline(file) {
    // Hide Upload
    uploadContainer.classList.add('hidden');
    // Show Loading
    loadingState.classList.remove('hidden');

    // Simulate API Call delay (since backend is stage 1-6)
    setTimeout(() => {
        loadingState.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('flex');
        
        // Mock Response Data
        const mockPipelineData = getMockData();
        
        // Initialize Three.js View
        initThreeJS(mockPipelineData.walls);
        
        // Populate Table and Cards
        populateResults(mockPipelineData.walls);
        
        // Trigger feather icons to re-render in new cards
        feather.replace();

    }, 3000); // 3 seconds fake loading to simulate OpenCV -> ThreeJS -> LLM
}

// Mock Data Generator representing backend payload
function getMockData() {
    return {
        walls: [
            { id: "W1", x: -4, y: 1.5, z: -5, w: 8, h: 3, d: 0.4, type: "load-bearing", material: "Reinforced Concrete", cost: "$45/sqft", strength: "95/100", explanation: "Calculated primary vertical load path transferring roof stress directly to the foundation slab. RC specified to meet shear strength thresholds." },
            { id: "W2", x: 4, y: 1.5, z: 0, w: 0.4, h: 3, d: 10, type: "load-bearing", material: "Steel Studs (Heavy Gauge)", cost: "$38/sqft", strength: "88/100", explanation: "Exterior lateral wall stabilizing wind loads. Heavy gauge steel offers high tensile strength without adding detrimental dead weight on edge footings." },
            { id: "W3", x: -4, y: 1.5, z: 5, w: 8, h: 3, d: 0.4, type: "load-bearing", material: "Reinforced Concrete", cost: "$45/sqft", strength: "95/100", explanation: "Rear load-bearing envelope. Requires matched stiffness with front facade (W1) to prevent torsional displacement during dynamic loading." },
            { id: "W4", x: -1, y: 1.5, z: 0, w: 0.2, h: 3, d: 6, type: "partition", material: "Timber Studs + Drywall", cost: "$12/sqft", strength: "40/100", explanation: "Interior space division. Carries no axial loads above self-weight. Optimized for cost-effectiveness and rapid installation speed." },
            { id: "W5", x: 2, y: 1.5, z: 3, w: 4, h: 3, d: 0.2, type: "partition", material: "Aerated Concrete Blocks", cost: "$18/sqft", strength: "55/100", explanation: "Secondary partition enclosing utilities. Provides excellent fire resistance and acoustic insulation while remaining cost-viable." }
        ]
    };
}

// --- Three.js Implementation --- //
let scene, camera, renderer, controls;

function initThreeJS(walls) {
    const container = document.getElementById('canvas-container');
    
    // Clear old canvases if any
    container.innerHTML = '';

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

    // Build Walls
    walls.forEach(w => {
        // Red = Load bearing, Grey = Partition
        const color = w.type === 'load-bearing' ? 0xef4444 : 0x9ca3af;
        
        const geometry = new THREE.BoxGeometry(w.w, w.h, w.d);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(w.x, w.y, w.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Add subtle edge geometry for clarity
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
