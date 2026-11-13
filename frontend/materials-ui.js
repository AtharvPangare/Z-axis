// materials-ui.js

document.addEventListener('DOMContentLoaded', () => {
    // ── 1. Drawer Toggle Logic ────────────────────────────────────────
    const toggleBtn = document.getElementById('nav-recommend-materials');
    const closeBtn  = document.getElementById('close-materials');
    const drawer    = document.getElementById('materials-drawer');
    const stage1    = document.getElementById('materials-stage-1');
    const stage2    = document.getElementById('materials-stage-2');

    let isDrawerOpen = false;

    function openDrawer() {
        if (isDrawerOpen) return;
        isDrawerOpen = true;
        drawer.classList.remove('hidden');
        setTimeout(() => {
            drawer.classList.remove('-translate-y-[150%]', 'opacity-0');
            drawer.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => stage1.classList.remove('translate-y-4', 'opacity-0'), 300);
            setTimeout(() => stage2.classList.remove('translate-y-4', 'opacity-0'), 500);
        }, 20);
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        if (!isDrawerOpen) return;
        isDrawerOpen = false;
        drawer.classList.remove('translate-y-0', 'opacity-100');
        drawer.classList.add('-translate-y-[150%]', 'opacity-0');
        stage1.classList.add('translate-y-4', 'opacity-0');
        stage2.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => drawer.classList.add('hidden'), 500);
        document.body.style.overflow = '';
    }

    if (toggleBtn) toggleBtn.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });
    if (closeBtn)  closeBtn.addEventListener('click', closeDrawer);

    // Auto-close drawer when navigating to other sections via navbar
    document.querySelectorAll('nav a[href^="#"]').forEach(link => {
        if (link.id !== 'nav-recommend-materials') {
            link.addEventListener('click', () => {
                if (isDrawerOpen) closeDrawer();
            });
        }
    });

    // ── 2. Element Data ───────────────────────────────────────────────
    const elementsData = [
        {
            id: 'load-bearing', title: 'Load-Bearing Walls (With Window)', desc: 'Carries gravity loads & supports window lintel beam', icon: 'layout',
            recommended: 'Reinforced Cement Concrete (RCC M25)',
            explanation: 'Holds window fenestrations where stress concentrations require continuous RCC lintels (IS 456). High compressive strength (25 MPa) safely transfers overhead slab loads down around window apertures to the foundation.',
            ranks: [
                { name: 'RCC M25 Concrete',         score: 0.95, percent: 95 },
                { name: 'Class 1 Red Clay Brick',   score: 0.86, percent: 86 },
                { name: 'Solid Concrete Masonry',   score: 0.81, percent: 81 }
            ]
        },
        {
            id: 'partition', title: 'Partition Walls (No Window)', desc: 'Interior solid space divider (carries self-weight only)', icon: 'grid',
            recommended: 'AAC Lightweight Blocks',
            explanation: 'Interior room partition with zero window openings. Autoclaved Aerated Concrete (AAC) reduces dead load on floor slabs by over 50%, providing 42 dB sound isolation and 0.16 W/m·K thermal insulation at lower installation cost.',
            ranks: [
                { name: 'AAC Blocks (Lightweight)', score: 0.92, percent: 92 },
                { name: 'Hollow Concrete Blocks',   score: 0.80, percent: 80 },
                { name: 'Gypsum Steel Stud Wall',   score: 0.73, percent: 73 }
            ]
        },
        {
            id: 'columns', title: 'Columns', desc: 'Vertical structural support', icon: 'box',
            recommended: 'RCC (M30 Structural)',
            explanation: 'Reinforced cement concrete with high-yield Fe500 TMT steel rebar cages provides high compressive resistance for primary building frames.',
            ranks: [
                { name: 'RCC M30 Mix',        score: 0.95, percent: 95 },
                { name: 'Structural Steel',   score: 0.88, percent: 88 },
                { name: 'Composite Column',   score: 0.82, percent: 82 }
            ]
        },
        {
            id: 'slabs', title: 'Slabs', desc: 'Floor and roof structure', icon: 'layers',
            recommended: 'Two-Way RCC Slab',
            explanation: 'Continuous solid RCC slabs are the standard for durable floor plates that distribute loads uniformly without undesirable deflections.',
            ranks: [
                { name: 'RCC Slab',      score: 0.93, percent: 93 },
                { name: 'Precast Panel', score: 0.89, percent: 89 },
                { name: 'Waffle Slab',   score: 0.81, percent: 81 }
            ]
        },
        {
            id: 'long-span', title: 'Long Span Structures', desc: 'Large unsupported spans', icon: 'maximize-2',
            recommended: 'Steel Truss',
            explanation: 'Steel Roof Trusses offer superior strength-to-weight ratios for large unsupported spans, eliminating the need for intermediate columns.',
            ranks: [
                { name: 'Steel Truss', score: 0.97, percent: 97 },
                { name: 'PT Slabs',    score: 0.86, percent: 86 },
                { name: 'Space Frame', score: 0.84, percent: 84 }
            ]
        }
    ];

    // ── 3. Render Cards ───────────────────────────────────────────────
    const cardsContainer = document.getElementById('material-cards-container');
    const stage3         = document.getElementById('materials-stage-3');
    const rankingBarsContainer = document.getElementById('ranking-bars-container');
    const aiExplanationBox     = document.getElementById('ai-explanation-box');
    let activeCardId = null;

    function renderCards() {
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';

        elementsData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'snap-center shrink-0 w-64 h-64 bg-white rounded-[24px] p-6 shadow-sm border-2 border-transparent transition-all duration-300 transform group cursor-pointer flex flex-col justify-center items-center text-center';
            card.id = `card-${item.id}`;

            card.innerHTML = `
                <div class="w-14 h-14 rounded-full bg-beige-light flex items-center justify-center mb-5 transition-colors duration-300" id="icon-bg-${item.id}">
                    <i data-feather="${item.icon}" class="text-brown-primary w-6 h-6" id="icon-svg-${item.id}"></i>
                </div>
                <h4 class="text-lg font-bold text-black-soft mb-2 transition-colors duration-300" id="title-${item.id}">${item.title}</h4>
                <p class="text-sm text-brown-sec leading-relaxed">${item.desc}</p>
            `;

            card.addEventListener('mouseenter', () => {
                if (activeCardId !== item.id) {
                    card.classList.add('-translate-y-2', 'shadow-elevate');
                    document.getElementById(`icon-bg-${item.id}`).classList.add('bg-beige-primary');
                    document.getElementById(`title-${item.id}`).classList.add('text-brown-primary');
                }
            });
            card.addEventListener('mouseleave', () => {
                if (activeCardId !== item.id) {
                    card.classList.remove('-translate-y-2', 'shadow-elevate');
                    document.getElementById(`icon-bg-${item.id}`).classList.remove('bg-beige-primary');
                    document.getElementById(`title-${item.id}`).classList.remove('text-brown-primary');
                }
            });
            card.addEventListener('click', () => selectCard(item.id));

            cardsContainer.appendChild(card);
        });

        if (window.feather) feather.replace();
    }

    // ── 4. Card Selection → Stage 3 ──────────────────────────────────
    function selectCard(id) {
        elementsData.forEach(item => {
            const c = document.getElementById(`card-${item.id}`);
            c.classList.remove('border-brown-primary', '-translate-y-2', 'shadow-elevate', 'bg-beige-primary');
            c.classList.add('border-transparent');
            document.getElementById(`icon-bg-${item.id}`).classList.remove('bg-brown-primary');
            document.getElementById(`icon-bg-${item.id}`).classList.add('bg-beige-light');
            const svg = document.getElementById(`icon-svg-${item.id}`);
            if (svg) { svg.classList.remove('text-white'); svg.classList.add('text-brown-primary'); }
        });

        activeCardId = id;
        const sel = document.getElementById(`card-${id}`);
        sel.classList.remove('border-transparent');
        sel.classList.add('border-brown-primary', '-translate-y-2', 'shadow-elevate', 'bg-beige-primary');

        const iconBg = document.getElementById(`icon-bg-${id}`);
        iconBg.classList.remove('bg-beige-light', 'bg-beige-primary');
        iconBg.classList.add('bg-brown-primary');

        const selIcon = document.getElementById(`icon-svg-${id}`);
        if (selIcon) { selIcon.classList.remove('text-brown-primary'); selIcon.classList.add('text-beige-cream'); }

        showRankingBars(elementsData.find(e => e.id === id));
    }

    function showRankingBars(data) {
        stage3.classList.remove('hidden');
        setTimeout(() => {
            stage3.classList.remove('opacity-0', 'translate-y-4');
            stage3.classList.add('opacity-100', 'translate-y-0');
        }, 10);

        document.getElementById('analysis-title').innerHTML = `Most Recommended Materials: <span class="text-brown-dark ml-2">${data.title}</span>`;
        document.getElementById('analysis-recommended').innerText = data.recommended;
        document.getElementById('analysis-explanation').innerText  = data.explanation;

        aiExplanationBox.classList.remove('opacity-100', 'translate-y-0');
        aiExplanationBox.classList.add('opacity-0', 'translate-y-4');

        rankingBarsContainer.innerHTML = '';
        data.ranks.forEach((rank, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative group';
            wrapper.innerHTML = `
                <div class="flex justify-between items-end mb-2">
                    <span class="font-bold text-black-soft">${rank.name}</span>
                    <span class="text-brown-dark font-mono font-bold text-sm bg-beige-light px-2 py-0.5 rounded">${rank.score.toFixed(2)}</span>
                </div>
                <div class="h-3 w-full bg-beige-light rounded-full overflow-hidden">
                    <div class="h-full ${index === 0 ? 'bg-brown-primary shadow-soft' : 'bg-brown-sec'} rounded-full transition-all duration-1000 ease-out" style="width:0%" id="bar-${data.id}-${index}"></div>
                </div>
            `;
            rankingBarsContainer.appendChild(wrapper);
            setTimeout(() => {
                const bar = document.getElementById(`bar-${data.id}-${index}`);
                if (bar) bar.style.width = `${rank.percent}%`;
            }, 100 + index * 200);
        });

        setTimeout(() => {
            aiExplanationBox.classList.remove('opacity-0', 'translate-y-4');
            aiExplanationBox.classList.add('opacity-100', 'translate-y-0');
        }, 600);
    }

    // Expose reset function globally
    window.resetMaterialsDrawer = () => {
        activeCardId = null;
        
        const emptyState = document.getElementById('drawer-empty-state');
        const contentState = document.getElementById('drawer-content');
        if (emptyState) emptyState.classList.remove('hidden');
        if (contentState) contentState.classList.add('hidden');

        elementsData.forEach(item => {
            const c = document.getElementById(`card-${item.id}`);
            if (c) {
                c.classList.remove('border-brown-primary', '-translate-y-2', 'shadow-elevate', 'bg-beige-primary');
                c.classList.add('border-transparent');
            }
            const bg = document.getElementById(`icon-bg-${item.id}`);
            if (bg) {
                bg.classList.remove('bg-brown-primary');
                bg.classList.add('bg-beige-light');
            }
            const svg = document.getElementById(`icon-svg-${item.id}`);
            if (svg) {
                svg.classList.remove('text-beige-cream');
                svg.classList.add('text-brown-primary');
            }
        });
        if (stage3) {
            stage3.classList.add('hidden');
            stage3.classList.remove('opacity-100', 'translate-y-0');
            stage3.classList.add('opacity-0', 'translate-y-4');
        }
    };

    window.showMaterialsDrawerContent = () => {
        const emptyState = document.getElementById('drawer-empty-state');
        const contentState = document.getElementById('drawer-content');
        if (emptyState) emptyState.classList.add('hidden');
        if (contentState) contentState.classList.remove('hidden');
    };

    renderCards();
});
