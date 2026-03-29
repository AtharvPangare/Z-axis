// about-animation.js

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('hero-3d-container');
    if (!container) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    
    // We don't set a background so it's transparent and lets the CSS gradient show
    scene.background = null; 

    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Bright for 2D mode initially
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0); // Shadows off initially
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8B6F47, 0.4); // Warm brown fill
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // 3. Environment - Blueprint Grid
    const gridHelper = new THREE.GridHelper(20, 40, 0x8B6F47, 0x6B5B4D);
    gridHelper.material.opacity = 0.15;
    gridHelper.material.transparent = true;
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xF5F1EB, // Soft Beige background
        roughness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Constructing the Building
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xF5F1EB, // Starts matching Soft Beige background to hide faces in 2D
        roughness: 0.2,
        metalness: 0.05,
    });

    // Dark brown blueprint edges
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x4A3B2A, // Dark brown
        linewidth: 1,
        transparent: true,
        opacity: 0.8
    });

    function createWall(w, h, d, x, z) {
        const geom = new THREE.BoxGeometry(w, h, d);
        // Translate up so the origin is at the base
        geom.translate(0, h / 2, 0);

        const mesh = new THREE.Mesh(geom, wallMaterial);
        mesh.position.set(x, 0, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Edges for blueprint look
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, edgeMaterial);
        mesh.add(line);

        buildingGroup.add(mesh);
    }

    // A slightly complex architecture layout
    const H = 2.5; // full height
    const T = 0.2; // wall thickness

    // Outer shell
    createWall(8, H, T, 0, -3.9); 
    createWall(8, H, T, 0, 3.9);  
    createWall(T, H, 8, -3.9, 0); 
    createWall(T, H, 8, 3.9, 0);  

    // Inner rooms
    createWall(4, H, T, -1.9, 0); 
    createWall(T, H, 4, 0, -1.9); 
    createWall(3, H, T, 2.4, 1.5); 
    createWall(T, H, 2.4, 1.0, 2.7); 

    // 5. Initial 2D Blueprint State
    camera.position.set(0, 16, 0); // Looking straight down
    camera.lookAt(0, 0, 0);
    
    buildingGroup.scale.set(1, 0.001, 1); // Flatten to 2D

    // 6. GSAP Scroll Animation
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: '.hero-3d-wrapper',
            start: 'top 80%',
            end: 'bottom 20%',
            scrub: 1.5, // smoothness
        }
    });

    // Animate camera to Isometric View
    tl.to(camera.position, {
        x: 10,
        y: 8,
        z: 12,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.lookAt(0, 0, 0);
        }
    }, 0);

    // Extrude walls to 3D
    tl.to(buildingGroup.scale, {
        y: 1,
        ease: "power2.inOut"
    }, 0);

    // Transition material to stark white 3D object
    tl.to(wallMaterial.color, {
        r: 1, g: 1, b: 1, 
        ease: "power2.inOut"
    }, 0);

    // Fade edges slightly to make them less intrusive in 3D
    tl.to(edgeMaterial, {
        opacity: 0.15,
        ease: "power2.inOut"
    }, 0);

    // Adjust lighting to show depth and shadows
    tl.to(ambientLight, {
        intensity: 0.4,
        ease: "power2.inOut"
    }, 0);

    tl.to(mainLight, {
        intensity: 1.2,
        ease: "power2.inOut"
    }, 0);

    // Add slight rotation for dynamic feel
    tl.to(buildingGroup.rotation, {
        y: Math.PI / 6,
        ease: "power2.inOut"
    }, 0);

    // 7. Hover Interactions
    const wrapper = document.querySelector('.hero-3d-wrapper');
    let isHovered = false;
    
    // Store animated rotation base
    let baseRotationY = 0;
    
    // Update base rotation when timeline updates
    tl.eventCallback("onUpdate", () => {
        if (!isHovered) {
            baseRotationY = buildingGroup.rotation.y;
        }
    });

    wrapper.addEventListener('mouseenter', () => {
        isHovered = true;
        gsap.to(fillLight, { intensity: 1.0, duration: 0.5 });
        gsap.to(wrapper, { y: -5, scale: 1.02, duration: 0.4, ease: "back.out(1.5)" });
    });

    wrapper.addEventListener('mouseleave', () => {
        isHovered = false;
        gsap.to(fillLight, { intensity: 0.2, duration: 0.5 });
        gsap.to(wrapper, { y: 0, scale: 1.0, duration: 0.4 });
        gsap.to(buildingGroup.rotation, { x: 0, y: baseRotationY, duration: 0.5 });
    });

    wrapper.addEventListener('mousemove', (e) => {
        if (!isHovered) return;
        const rect = wrapper.getBoundingClientRect();
        
        // Normalize mouse to -1 to 1
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1; 
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Subtle tilt based on progress
        const isExtruded = buildingGroup.scale.y > 0.5;
        if (isExtruded) {
            gsap.to(buildingGroup.rotation, {
                y: baseRotationY + mouseX * 0.15,
                x: -mouseY * 0.05,
                duration: 0.5,
                ease: "power1.out"
            });
        }
    });

    // 8. Render Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // 9. Resize Handler
    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
});
