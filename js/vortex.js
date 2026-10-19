/**
 * VORTEX CORE — Kinetic Concentric Ring Physics Engine
 * ----------------------------------------------------
 * - Left-Click (Hold or Click)  => Rotate Hovered Ring ANTICLOCKWISE (↺)
 * - Right-Click (Hold or Click) => Rotate Hovered Ring CLOCKWISE (↻)
 * - Mouse Wheel / A-D Keys      => Fine rotational control
 * - Realistic sub-stepped rigid-body marble physics with rounded slot end-cap
 *   bumpers, tangential surface friction, spiral funnel capture, screen shake,
 *   combo multipliers, and rich WebAudio sound effects.
 */

(() => {
    'use strict';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const canvasWrapper = document.getElementById('canvasWrapper');

    // HUD Elements
    const hudLevel = document.getElementById('hudLevel');
    const hudRings = document.getElementById('hudRings');
    const hudBalls = document.getElementById('hudBalls');
    const hudCombo = document.getElementById('hudCombo');
    const hudScore = document.getElementById('hudScore');
    const goalProgressBar = document.getElementById('goalProgressBar');

    const indicatorLMB = document.getElementById('indicatorLMB');
    const indicatorRMB = document.getElementById('indicatorRMB');
    const statusDot = document.getElementById('statusDot');
    const statusRingText = document.getElementById('statusRingText');
    const ringControlList = document.getElementById('ringControlList');

    // Modals & Buttons
    const levelModal = document.getElementById('levelModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
    const modalBalls = document.getElementById('modalBalls');
    const modalTime = document.getElementById('modalTime');
    const modalBonus = document.getElementById('modalBonus');
    const btnNextLevel = document.getElementById('btnNextLevel');

    const helpModal = document.getElementById('helpModal');
    const btnHelp = document.getElementById('btnHelp');
    const btnCloseHelp = document.getElementById('btnCloseHelp');
    const btnReset = document.getElementById('btnReset');
    const btnPulse = document.getElementById('btnPulse');
    const btnSound = document.getElementById('btnSound');
    const soundIcon = document.getElementById('soundIcon');

    // Vibrant Neon Ring & Marble Palettes
    const RING_THEMES = [
        { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.55)' }, // Cyan
        { main: '#c084fc', glow: 'rgba(192, 132, 252, 0.55)' }, // Purple
        { main: '#34d399', glow: 'rgba(52, 211, 153, 0.55)' },  // Emerald
        { main: '#fbbf24', glow: 'rgba(251, 191, 36, 0.55)' },  // Amber
        { main: '#fb7185', glow: 'rgba(251, 113, 133, 0.55)' }, // Rose
        { main: '#818cf8', glow: 'rgba(129, 140, 248, 0.55)' }, // Indigo
        { main: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.55)' },  // Teal
        { main: '#f472b6', glow: 'rgba(244, 114, 182, 0.55)' }, // Pink
        { main: '#a3e635', glow: 'rgba(163, 230, 53, 0.55)' }   // Lime
    ];

    const MARBLE_PALETTE = [
        { core: '#e0f2fe', mid: '#38bdf8', rim: '#0284c7' },
        { core: '#f3e8ff', mid: '#c084fc', rim: '#7e22ce' },
        { core: '#d1fae5', mid: '#34d399', rim: '#059669' },
        { core: '#fef3c7', mid: '#fbbf24', rim: '#d97706' },
        { core: '#ffe4e6', mid: '#fb7185', rim: '#e11d48' },
        { core: '#e0e7ff', mid: '#818cf8', rim: '#4338ca' }
    ];

    // Tactile WebAudio Synthesizer
    class TactileAudio {
        constructor() {
            this.enabled = true;
            this.ctx = null;
            this.lastClackTime = 0;
        }

        ensureContext() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        // Marble clack / bounce sound
        playBounce(impactSpeed) {
            if (!this.enabled || impactSpeed < 35) return;
            this.ensureContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            if (now - this.lastClackTime < 0.032) return;
            this.lastClackTime = now;

            const vol = Math.min(0.14, (impactSpeed / 360) * 0.14);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            const pitch = 240 + Math.min(350, impactSpeed * 0.6) + (Math.random() * 40);
            osc.frequency.setValueAtTime(pitch, now);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, now + 0.045);

            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.055);
        }

        // Mechanical servo click when triggering ring rotation
        playRingTrigger(dir) {
            if (!this.enabled) return;
            this.ensureContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';

            const startF = dir < 0 ? 190 : 230;
            const endF = dir < 0 ? 145 : 300;
            osc.frequency.setValueAtTime(startF, now);
            osc.frequency.exponentialRampToValueAtTime(endF, now + 0.055);

            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.065);
        }

        // Harmonic chime when a ball passes through a ring slot
        playGatePass(ringIndex) {
            if (!this.enabled) return;
            this.ensureContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';

            const freq = 520 - Math.min(240, ringIndex * 38);
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.09);

            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        }

        // Satisfying rising synth chord when a marble is captured in the core
        playCoreCapture(combo) {
            if (!this.enabled) return;
            this.ensureContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            // Pentatonic scale steps
            const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
            const baseFreq = scale[Math.min(scale.length - 1, combo - 1)];

            [1, 1.5].forEach((harm, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = idx === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(baseFreq * harm, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * harm * 1.35, now + 0.24);

                gain.gain.setValueAtTime(idx === 0 ? 0.18 : 0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.27);
            });
        }

        playLevelVictory() {
            if (!this.enabled) return;
            this.ensureContext();
            if (!this.ctx) return;

            const chord = [392.00, 493.88, 587.33, 783.99, 987.77];
            chord.forEach((f, i) => {
                const now = this.ctx.currentTime + i * 0.075;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now);
                gain.gain.setValueAtTime(0.16, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.5);
            });
        }

        playSurge() {
            if (!this.enabled) return;
            this.ensureContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(42, now + 0.35);

            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.39);
        }
    }

    const audio = new TactileAudio();

    // Game State
    const state = {
        level: 1,
        score: 0,
        combo: 1,
        comboTimer: 0,
        startTime: 0,
        elapsedSec: 0,
        levelCleared: false,

        centerX: 0,
        centerY: 0,
        holeRadius: 34,
        outerArenaRadius: 320,

        rings: [],
        balls: [],
        particles: [],
        floatingTexts: [],
        shockwaves: [],
        ambientStars: [],

        totalBalls: 0,
        sunkBalls: 0,

        // Input state
        hoveredRingIndex: -1,
        activeRingIndex: 0,
        heldMouseDir: 0, // -1 for Left-Click (Anticlockwise), +1 for Right-Click (Clockwise)
        keySpinDir: 0,

        // Visual juice
        vortexSpin: 0,
        corePulse: 0,
        shakeTime: 0,
        shakeMag: 0
    };

    // Math Utilities
    const TWO_PI = Math.PI * 2;

    function normalizeAngle(a) {
        return ((a % TWO_PI) + TWO_PI) % TWO_PI;
    }

    function shortestAngleDist(a, b) {
        let diff = (b - a) % TWO_PI;
        if (diff < -Math.PI) diff += TWO_PI;
        if (diff > Math.PI) diff -= TWO_PI;
        return diff;
    }

    // Trigger subtle screen shake on core capture or surge
    function addScreenShake(magnitude, duration = 0.14) {
        state.shakeMag = Math.max(state.shakeMag, magnitude);
        state.shakeTime = Math.max(state.shakeTime, duration);
    }

    // Create ambient background dust particles
    function initAmbientStars(width, height) {
        state.ambientStars = [];
        for (let i = 0; i < 65; i++) {
            state.ambientStars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 0.6 + Math.random() * 1.6,
                alpha: 0.15 + Math.random() * 0.45,
                phase: Math.random() * TWO_PI
            });
        }
    }

    // Resize Canvas & Recompute Geometry Proportionally
    function resizeCanvas() {
        const rect = canvasWrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const prevArenaR = state.outerArenaRadius || 300;
        const prevCX = state.centerX || rect.width / 2;
        const prevCY = state.centerY || rect.height / 2;

        state.centerX = rect.width / 2;
        state.centerY = rect.height / 2 + 12; // Slightly offset below top HUD bar

        const minDim = Math.min(rect.width, rect.height - 90);
        state.outerArenaRadius = Math.max(175, minDim * 0.45);
        state.holeRadius = Math.max(24, Math.min(36, state.outerArenaRadius * 0.115));

        if (state.ambientStars.length === 0) {
            initAmbientStars(rect.width, rect.height);
        }

        if (state.rings.length > 0) {
            const numRings = state.rings.length;
            const innerStart = state.holeRadius + Math.max(32, (state.outerArenaRadius - state.holeRadius) * 0.18);
            const maxRingSpan = state.outerArenaRadius * 0.78;
            const ringStep = numRings > 1 ? (maxRingSpan - innerStart) / (numRings - 1) : 0;

            state.rings.forEach((ring, i) => {
                ring.radius = numRings === 1 ? (innerStart + maxRingSpan) * 0.5 : innerStart + i * ringStep;
                ring.thickness = Math.max(8, Math.min(14, (maxRingSpan / (numRings + 2)) * 0.34));
            });

            const scale = state.outerArenaRadius / prevArenaR;
            state.balls.forEach(b => {
                b.x = state.centerX + (b.x - prevCX) * scale;
                b.y = state.centerY + (b.y - prevCY) * scale;
            });
        }
    }

    // Initialize Level
    function initLevel(levelNum) {
        state.level = levelNum;
        state.levelCleared = false;
        state.sunkBalls = 0;
        state.combo = 1;
        state.comboTimer = 0;
        state.startTime = performance.now();
        state.elapsedSec = 0;
        state.particles = [];
        state.floatingTexts = [];
        state.shockwaves = [];

        levelModal.classList.add('hidden');

        // Level 1 has 2 rings, Level 2 has 3 rings, Level 3 has 4 rings...
        const numRings = levelNum + 1;
        const numBalls = 14 + (levelNum - 1) * 7;
        state.totalBalls = numBalls;

        resizeCanvas();

        const innerStart = state.holeRadius + Math.max(32, (state.outerArenaRadius - state.holeRadius) * 0.18);
        const maxRingSpan = state.outerArenaRadius * 0.78;
        const ringStep = numRings > 1 ? (maxRingSpan - innerStart) / (numRings - 1) : 0;

        // Marble radius sized so balls roll smoothly between rings without jamming
        const ballRadius = Math.max(6.2, Math.min(10, (ringStep || 52) * 0.25));

        state.rings = [];
        for (let i = 0; i < numRings; i++) {
            const radius = numRings === 1
                ? (innerStart + maxRingSpan) * 0.5
                : innerStart + i * ringStep;

            const thickness = Math.max(8, Math.min(14, (maxRingSpan / (numRings + 2)) * 0.34));

            // Generous slot angular width so balls funnel in satisfyingly
            const minHalfAngle = Math.atan2(ballRadius * 2.55, radius);
            const slotHalfWidth = Math.max(minHalfAngle, 0.24 - Math.min(0.08, levelNum * 0.005));

            // Outer rings have 2 slots more often so lots of balls can flow dynamically
            const slotCount = (i >= 1 && Math.random() < 0.55) ? 2 : 1;
            const slots = [];
            const baseOffset = Math.random() * TWO_PI;

            for (let s = 0; s < slotCount; s++) {
                const spread = s === 0 ? 0 : (Math.PI * 0.75 + Math.random() * Math.PI * 0.5);
                slots.push({
                    offset: normalizeAngle(baseOffset + spread),
                    halfWidth: slotHalfWidth
                });
            }

            const theme = RING_THEMES[i % RING_THEMES.length];
            state.rings.push({
                index: i,
                radius,
                thickness,
                angle: normalizeAngle(Math.random() * TWO_PI),
                angularVel: 0,
                theme,
                slots,
                highlightAlpha: 0
            });
        }

        state.activeRingIndex = state.rings.length - 1;
        state.hoveredRingIndex = state.activeRingIndex;

        // Spawn marbles outside the outermost ring
        state.balls = [];
        const outerRing = state.rings[state.rings.length - 1];
        const spawnMinR = outerRing.radius + outerRing.thickness * 0.5 + ballRadius * 2.2;
        const spawnMaxR = Math.max(spawnMinR + ballRadius * 3, state.outerArenaRadius - ballRadius * 1.6);

        for (let b = 0; b < numBalls; b++) {
            const angle = (b / numBalls) * TWO_PI + (Math.random() - 0.5) * 0.14;
            const layer = (b % 3) / 2;
            const r = spawnMinR + layer * (spawnMaxR - spawnMinR);
            const palette = MARBLE_PALETTE[b % MARBLE_PALETTE.length];

            // Give a gentle initial orbital swirl so the outer marbles immediately feel alive
            const tangX = -Math.sin(angle);
            const tangY = Math.cos(angle);
            const initialSwirl = (b % 2 === 0 ? 1 : -1) * (25 + Math.random() * 25);

            state.balls.push({
                id: b,
                x: state.centerX + Math.cos(angle) * r,
                y: state.centerY + Math.sin(angle) * r,
                vx: tangX * initialSwirl,
                vy: tangY * initialSwirl,
                radius: ballRadius,
                palette,
                rollPhase: Math.random() * TWO_PI,
                lastRingIndex: state.rings.length,
                sunk: false,
                sinkProgress: 0,
                sinkStartX: 0,
                sinkStartY: 0,
                sinkAngle: 0,
                trail: []
            });
        }

        buildRingLayerDock();
        updateStatusBanner();
        updateHUD();
    }

    // Build Bottom-Right Ring Layer Pills
    function buildRingLayerDock() {
        ringControlList.innerHTML = '';
        for (let i = state.rings.length - 1; i >= 0; i--) {
            const ring = state.rings[i];
            const chip = document.createElement('button');
            chip.className = 'layer-chip' + (i === state.activeRingIndex ? ' active' : '');
            chip.dataset.idx = i;
            chip.innerHTML = `
                <span class="chip-dot" style="background:${ring.theme.main}; box-shadow:0 0 8px ${ring.theme.main}"></span>
                <span>R${i + 1}</span>
            `;
            chip.addEventListener('click', () => {
                state.activeRingIndex = i;
                state.hoveredRingIndex = i;
                syncLayerDockSelection();
                updateStatusBanner();
            });
            ringControlList.appendChild(chip);
        }
    }

    function syncLayerDockSelection() {
        const targetIdx = state.hoveredRingIndex !== -1 ? state.hoveredRingIndex : state.activeRingIndex;
        ringControlList.querySelectorAll('.layer-chip').forEach(chip => {
            const idx = parseInt(chip.dataset.idx, 10);
            chip.classList.toggle('active', idx === targetIdx);
        });
    }

    // Determine which ring is closest to the cursor
    function pickRingAtCursor(x, y) {
        if (state.rings.length === 0) return -1;
        const dx = x - state.centerX;
        const dy = y - state.centerY;
        const dist = Math.hypot(dx, dy);

        let bestIdx = 0;
        let bestDelta = Infinity;
        for (let i = 0; i < state.rings.length; i++) {
            const delta = Math.abs(dist - state.rings[i].radius);
            if (delta < bestDelta) {
                bestDelta = delta;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    // Apply rotational torque + snappy impulse to the selected ring
    function triggerRingTorque(ringIndex, dir, initialSnap = true) {
        const ring = state.rings[ringIndex];
        if (!ring) return;

        // dir: -1 = Anticlockwise (Left-Click), +1 = Clockwise (Right-Click)
        if (initialSnap) {
            ring.angularVel = dir * 3.1;
            ring.angle = normalizeAngle(ring.angle + dir * 0.085);
            audio.playRingTrigger(dir);
        } else {
            // Smooth acceleration toward target angular velocity while held
            const targetVel = dir * 3.45;
            ring.angularVel += (targetVel - ring.angularVel) * 0.28;
        }
        ring.highlightAlpha = 1.0;

        // Wake and impart realistic tangential drag to marbles touching this ring
        state.balls.forEach(b => {
            if (b.sunk) return;
            const dx = b.x - state.centerX;
            const dy = b.y - state.centerY;
            const dist = Math.hypot(dx, dy) || 1;
            if (Math.abs(dist - ring.radius) <= ring.thickness * 0.5 + b.radius + 6) {
                const tx = -dy / dist;
                const ty = dx / dist;
                b.vx += tx * dir * 18;
                b.vy += ty * dir * 18;
            }
        });
    }

    // Pointer & Mouse Button Controls:
    // Left-Click (button === 0) => Anticlockwise (-1)
    // Right-Click (button === 2) => Clockwise (+1)
    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    // Prevent browser context menu on Right-Click so Right-Click cleanly rotates clockwise
    window.addEventListener('contextmenu', (e) => {
        if (e.target === canvas || canvasWrapper.contains(e.target)) {
            e.preventDefault();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const pt = getPointerPos(e);
        const picked = pickRingAtCursor(pt.x, pt.y);
        if (picked !== -1) {
            state.hoveredRingIndex = picked;
            // If user isn't actively holding a click on another ring, follow hover
            if (state.heldMouseDir === 0) {
                state.activeRingIndex = picked;
            }
            syncLayerDockSelection();
            updateStatusBanner();
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const pt = getPointerPos(e);
        const picked = pickRingAtCursor(pt.x, pt.y);
        if (picked !== -1) {
            state.hoveredRingIndex = picked;
            state.activeRingIndex = picked;
        }

        // Left Click (0) => Anticlockwise (-1)
        // Right Click (2) => Clockwise (+1)
        if (e.button === 0) {
            state.heldMouseDir = -1;
            indicatorLMB.classList.add('active-trigger');
            indicatorRMB.classList.remove('active-trigger');
            triggerRingTorque(state.activeRingIndex, -1, true);
        } else if (e.button === 2) {
            state.heldMouseDir = 1;
            indicatorRMB.classList.add('active-trigger');
            indicatorLMB.classList.remove('active-trigger');
            triggerRingTorque(state.activeRingIndex, 1, true);
        }

        syncLayerDockSelection();
        updateStatusBanner();
    });

    window.addEventListener('mouseup', () => {
        state.heldMouseDir = 0;
        indicatorLMB.classList.remove('active-trigger');
        indicatorRMB.classList.remove('active-trigger');
        updateStatusBanner();
    });

    // Mouse Scroll Wheel support for precision rotation on hovered ring
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        const targetIdx = state.hoveredRingIndex !== -1 ? state.hoveredRingIndex : state.activeRingIndex;
        state.activeRingIndex = targetIdx;
        const ring = state.rings[targetIdx];
        if (ring) {
            ring.angularVel = dir * 2.6;
            ring.highlightAlpha = 1.0;
            audio.playRingTrigger(dir);
        }
        syncLayerDockSelection();
        updateStatusBanner();
    }, { passive: false });

    // Touch fallback (left half of screen = CCW, right half = CW on touched ring)
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const pt = getPointerPos(e);
        const picked = pickRingAtCursor(pt.x, pt.y);
        if (picked !== -1) {
            state.hoveredRingIndex = picked;
            state.activeRingIndex = picked;
            const dir = pt.x < state.centerX ? -1 : 1;
            state.heldMouseDir = dir;
            triggerRingTorque(picked, dir, true);
            syncLayerDockSelection();
            updateStatusBanner();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        state.heldMouseDir = 0;
        updateStatusBanner();
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            state.keySpinDir = -1;
            indicatorLMB.classList.add('active-trigger');
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            state.keySpinDir = 1;
            indicatorRMB.classList.add('active-trigger');
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            state.activeRingIndex = Math.min(state.rings.length - 1, state.activeRingIndex + 1);
            state.hoveredRingIndex = state.activeRingIndex;
            syncLayerDockSelection();
            updateStatusBanner();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            state.activeRingIndex = Math.max(0, state.activeRingIndex - 1);
            state.hoveredRingIndex = state.activeRingIndex;
            syncLayerDockSelection();
            updateStatusBanner();
        } else if (e.key === ' ') {
            e.preventDefault();
            triggerGravitySurge();
        } else if (e.key === 'r' || e.key === 'R') {
            initLevel(state.level);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) {
            if (state.keySpinDir === -1) state.keySpinDir = 0;
            indicatorLMB.classList.remove('active-trigger');
        } else if (['ArrowRight', 'd', 'D'].includes(e.key)) {
            if (state.keySpinDir === 1) state.keySpinDir = 0;
            indicatorRMB.classList.remove('active-trigger');
        }
    });

    function updateStatusBanner() {
        const idx = state.hoveredRingIndex !== -1 ? state.hoveredRingIndex : state.activeRingIndex;
        const ring = state.rings[idx];
        if (!ring) return;

        statusDot.style.background = ring.theme.main;
        statusDot.style.boxShadow = `0 0 12px ${ring.theme.main}`;

        const activeDir = state.heldMouseDir || state.keySpinDir;
        if (activeDir < 0) {
            statusRingText.textContent = `Ring ${idx + 1} • ↺ Spinning Anticlockwise (Left-Click)`;
        } else if (activeDir > 0) {
            statusRingText.textContent = `Ring ${idx + 1} • ↻ Spinning Clockwise (Right-Click)`;
        } else {
            statusRingText.textContent = `Ring ${idx + 1} Selected • Left-Click: ↺ Anticlockwise | Right-Click: ↻ Clockwise`;
        }
    }

    // Gravity Surge Shockwave
    function triggerGravitySurge() {
        audio.playSurge();
        addScreenShake(6, 0.22);
        state.shockwaves.push({
            radius: state.outerArenaRadius,
            alpha: 0.95,
            inward: true
        });

        state.balls.forEach(b => {
            if (b.sunk) return;
            const dx = state.centerX - b.x;
            const dy = state.centerY - b.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            const swirl = (Math.random() - 0.5) * 210;
            b.vx += nx * 165 - ny * swirl;
            b.vy += ny * 165 + nx * swirl;
        });
    }

    btnPulse.addEventListener('click', triggerGravitySurge);
    btnReset.addEventListener('click', () => initLevel(state.level));
    btnNextLevel.addEventListener('click', () => initLevel(state.level + 1));

    btnSound.addEventListener('click', () => {
        audio.enabled = !audio.enabled;
        soundIcon.textContent = audio.enabled ? '🔊' : '🔇';
    });

    btnHelp.addEventListener('click', () => helpModal.classList.remove('hidden'));
    btnCloseHelp.addEventListener('click', () => helpModal.classList.add('hidden'));

    // Visual Effects Spawners
    function spawnSparkles(x, y, color, count = 12, speedScale = 1) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * TWO_PI;
            const spd = (35 + Math.random() * 135) * speedScale;
            state.particles.push({
                x,
                y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                r: 1.8 + Math.random() * 2.6,
                color,
                alpha: 1.0
            });
        }
    }

    function spawnFloatingScore(x, y, text, color = '#38bdf8') {
        state.floatingTexts.push({
            x,
            y,
            text,
            color,
            alpha: 1.0,
            vy: -48
        });
    }

    // Check if angle `theta` lies inside an open slot of `ring`
    // Returns slot info + exact world positions of the two rounded slot end-cap bumpers
    function evaluateRingSlotAtAngle(ring, theta) {
        const normTheta = normalizeAngle(theta);
        for (let i = 0; i < ring.slots.length; i++) {
            const s = ring.slots[i];
            const center = normalizeAngle(ring.angle + s.offset);
            const angDiff = shortestAngleDist(center, normTheta);
            if (Math.abs(angDiff) <= s.halfWidth) {
                return {
                    inOpenAngle: true,
                    slotCenter: center,
                    angDiff,
                    halfWidth: s.halfWidth
                };
            }
        }
        return { inOpenAngle: false };
    }

    // High-Precision Sub-Stepped Physics Engine
    function updatePhysics(dt) {
        const clampedDt = Math.min(dt, 0.033);
        state.vortexSpin = (state.vortexSpin + clampedDt * 3.2) % TWO_PI;
        state.corePulse = Math.max(0, state.corePulse - clampedDt * 2.8);

        if (state.shakeTime > 0) {
            state.shakeTime = Math.max(0, state.shakeTime - clampedDt);
            if (state.shakeTime === 0) state.shakeMag = 0;
        }

        if (!state.levelCleared) {
            state.elapsedSec = (performance.now() - state.startTime) / 1000;
        }

        // Combo decay timer
        if (state.comboTimer > 0) {
            state.comboTimer = Math.max(0, state.comboTimer - clampedDt);
            if (state.comboTimer === 0) {
                state.combo = 1;
            }
        }

        // 1. Update Concentric Ring Rotational Inertia
        const activeDir = state.heldMouseDir || state.keySpinDir;
        state.rings.forEach((ring, idx) => {
            if (activeDir !== 0 && idx === state.activeRingIndex) {
                triggerRingTorque(idx, activeDir, false);
            } else {
                // Smooth rotational glide & friction decay
                ring.angularVel *= Math.pow(0.018, clampedDt);
                if (Math.abs(ring.angularVel) < 0.008) ring.angularVel = 0;
            }
            ring.angle = normalizeAngle(ring.angle + ring.angularVel * clampedDt);
            ring.highlightAlpha = Math.max(0, ring.highlightAlpha - clampedDt * 2.4);
        });

        // 2. Sub-stepped Rigid-Body Marble Physics (6 sub-steps per frame)
        const SUB_STEPS = 6;
        const subDt = clampedDt / SUB_STEPS;
        const cx = state.centerX;
        const cy = state.centerY;

        for (let step = 0; step < SUB_STEPS; step++) {
            for (let i = 0; i < state.balls.length; i++) {
                const b = state.balls[i];
                if (b.sunk) continue;

                const dx = cx - b.x;
                const dy = cy - b.y;
                const distFromCenter = Math.hypot(dx, dy) || 0.0001;
                const invDist = 1 / distFromCenter;
                const nx = dx * invDist; // Inward radial unit vector
                const ny = dy * invDist;

                // Realistic radial gravity attraction (stronger near the core like a physical funnel)
                const gravityPull = 290 + (15500 / (distFromCenter + 28));
                b.vx += nx * gravityPull * subDt;
                b.vy += ny * gravityPull * subDt;

                // Subtle fluid air resistance
                const airDrag = Math.pow(0.55, subDt);
                b.vx *= airDrag;
                b.vy *= airDrag;

                const prevDist = distFromCenter;
                b.x += b.vx * subDt;
                b.y += b.vy * subDt;

                const curDx = b.x - cx;
                const curDy = b.y - cy;
                const curDist = Math.hypot(curDx, curDy) || 0.0001;
                const theta = Math.atan2(curDy, curDx);

                // Check Central Singularity Capture
                if (curDist <= state.holeRadius - b.radius * 0.15) {
                    b.sunk = true;
                    b.sinkProgress = 0;
                    b.sinkStartX = b.x;
                    b.sinkStartY = b.y;
                    b.sinkAngle = theta;

                    state.sunkBalls++;
                    state.comboTimer = 2.6;
                    const pts = (75 + state.level * 20) * state.combo;
                    state.score += pts;
                    state.corePulse = 1.0;

                    audio.playCoreCapture(state.combo);
                    addScreenShake(4.2, 0.12);
                    spawnSparkles(b.x, b.y, b.palette.mid, 16, 1.15);
                    spawnFloatingScore(
                        cx + (Math.random() - 0.5) * 30,
                        cy - state.holeRadius - 10,
                        state.combo > 1 ? `+${pts} (x${state.combo}!)` : `+${pts}`,
                        state.combo > 1 ? '#fbbf24' : b.palette.mid
                    );

                    state.shockwaves.push({
                        radius: state.holeRadius,
                        alpha: 0.75,
                        color: b.palette.mid,
                        inward: false
                    });

                    state.combo = Math.min(12, state.combo + 1);
                    checkLevelComplete();
                    continue;
                }

                // Check Ring Collisions (Solid Arcs + Rounded Slot End-Cap Bumpers)
                for (let r = 0; r < state.rings.length; r++) {
                    const ring = state.rings[r];
                    const halfThick = ring.thickness * 0.5;
                    const minTouchR = ring.radius - halfThick - b.radius;
                    const maxTouchR = ring.radius + halfThick + b.radius;

                    if (curDist > minTouchR && curDist < maxTouchR) {
                        const slotEval = evaluateRingSlotAtAngle(ring, theta);

                        if (slotEval.inOpenAngle) {
                            // Inside the angular span of a slot:
                            // Collide accurately against the two circular end-cap bumpers of this slot!
                            // This creates realistic corner bounces & smooth funneling into the slot.
                            let hitEndCap = false;
                            for (let s = 0; s < ring.slots.length; s++) {
                                const slot = ring.slots[s];
                                const center = normalizeAngle(ring.angle + slot.offset);
                                const edges = [center - slot.halfWidth, center + slot.halfWidth];

                                for (let eIdx = 0; eIdx < 2; eIdx++) {
                                    const edgeAng = edges[eIdx];
                                    const capX = cx + Math.cos(edgeAng) * ring.radius;
                                    const capY = cy + Math.sin(edgeAng) * ring.radius;
                                    const capR = halfThick;

                                    const cdx = b.x - capX;
                                    const cdy = b.y - capY;
                                    const cDistSq = cdx * cdx + cdy * cdy;
                                    const minCapDist = b.radius + capR;

                                    if (cDistSq > 0 && cDistSq < minCapDist * minCapDist) {
                                        const cDist = Math.sqrt(cDistSq);
                                        const cnx = cdx / cDist;
                                        const cny = cdy / cDist;
                                        const overlap = minCapDist - cDist;

                                        b.x += cnx * overlap;
                                        b.y += cny * overlap;

                                        // Velocity of the moving slot end-cap due to ring rotation
                                        const capVx = -Math.sin(edgeAng) * ring.angularVel * ring.radius;
                                        const capVy = Math.cos(edgeAng) * ring.angularVel * ring.radius;

                                        const relVx = b.vx - capVx;
                                        const relVy = b.vy - capVy;
                                        const relDotN = relVx * cnx + relVy * cny;

                                        if (relDotN < 0) {
                                            const restitution = 0.48;
                                            b.vx -= (1 + restitution) * relDotN * cnx;
                                            b.vy -= (1 + restitution) * relDotN * cny;
                                            if (step === 0) audio.playBounce(-relDotN);
                                        }
                                        hitEndCap = true;
                                    }
                                }
                            }

                            // Track when a marble successfully slips inward past a ring layer
                            if (!hitEndCap && curDist < ring.radius && b.lastRingIndex > r) {
                                b.lastRingIndex = r;
                                ring.highlightAlpha = Math.max(ring.highlightAlpha, 0.7);
                                audio.playGatePass(r);
                                spawnSparkles(b.x, b.y, ring.theme.main, 5, 0.55);
                            }
                        } else {
                            // Solid Ring Wall Collision
                            const radOutX = curDx / curDist;
                            const radOutY = curDy / curDist;

                            const fromOutside = prevDist >= ring.radius;
                            const targetR = fromOutside ? maxTouchR : minTouchR;

                            b.x = cx + radOutX * targetR;
                            b.y = cy + radOutY * targetR;

                            // Normal bounce against ring wall
                            const vDotR = b.vx * radOutX + b.vy * radOutY;
                            if ((fromOutside && vDotR < 0) || (!fromOutside && vDotR > 0)) {
                                const bounceRestitution = 0.36;
                                b.vx -= (1 + bounceRestitution) * vDotR * radOutX;
                                b.vy -= (1 + bounceRestitution) * vDotR * radOutY;

                                if (step === 0 && Math.abs(vDotR) > 55) {
                                    audio.playBounce(Math.abs(vDotR));
                                }
                            }

                            // Realistic tangential rolling friction from the spinning ring wall
                            const tangX = -radOutY;
                            const tangY = radOutX;
                            const ringSurfaceSpeed = ring.angularVel * ring.radius;
                            const ballTangSpeed = b.vx * tangX + b.vy * tangY;
                            const tangSlip = ringSurfaceSpeed - ballTangSpeed;

                            // Pull ball tangentially with the spinning ring so it rolls smoothly toward the slot
                            const frictionTransfer = 6.5 * subDt;
                            b.vx += tangX * tangSlip * frictionTransfer;
                            b.vy += tangY * tangSlip * frictionTransfer;
                        }
                    }
                }

                // Outer Arena Containment Wall
                const maxArenaR = state.outerArenaRadius - b.radius;
                const finalDist = Math.hypot(b.x - cx, b.y - cy);
                if (finalDist > maxArenaR) {
                    const ux = (b.x - cx) / finalDist;
                    const uy = (b.y - cy) / finalDist;
                    b.x = cx + ux * maxArenaR;
                    b.y = cy + uy * maxArenaR;
                    const vDotOut = b.vx * ux + b.vy * uy;
                    if (vDotOut > 0) {
                        b.vx -= 1.4 * vDotOut * ux;
                        b.vy -= 1.4 * vDotOut * uy;
                    }
                }
            }

            // Marble-to-Marble Elastic Collisions
            for (let i = 0; i < state.balls.length; i++) {
                const b1 = state.balls[i];
                if (b1.sunk) continue;

                for (let j = i + 1; j < state.balls.length; j++) {
                    const b2 = state.balls[j];
                    if (b2.sunk) continue;

                    const dx = b2.x - b1.x;
                    const dy = b2.y - b1.y;
                    const minDist = b1.radius + b2.radius;
                    const distSq = dx * dx + dy * dy;

                    if (distSq > 0 && distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        const overlap = (minDist - dist) * 0.52;
                        const nx = dx / dist;
                        const ny = dy / dist;

                        b1.x -= nx * overlap;
                        b1.y -= ny * overlap;
                        b2.x += nx * overlap;
                        b2.y += ny * overlap;

                        const rvx = b2.vx - b1.vx;
                        const rvy = b2.vy - b1.vy;
                        const velAlongNormal = rvx * nx + rvy * ny;

                        if (velAlongNormal < 0) {
                            const restitution = 0.55;
                            const impulse = -(1 + restitution) * velAlongNormal * 0.5;
                            b1.vx -= impulse * nx;
                            b1.vy -= impulse * ny;
                            b2.vx += impulse * nx;
                            b2.vy += impulse * ny;

                            if (step === 0 && -velAlongNormal > 75) {
                                audio.playBounce(-velAlongNormal * 0.65);
                            }
                        }
                    }
                }
            }
        }

        // Update Marble Rolling Phase, Trails, and Spiral Sink Animation
        for (let i = 0; i < state.balls.length; i++) {
            const b = state.balls[i];
            if (b.sunk) {
                if (b.sinkProgress < 1) {
                    b.sinkProgress = Math.min(1, b.sinkProgress + clampedDt * 3.4);
                    // Spiral inward into the black hole core
                    const rem = 1 - b.sinkProgress;
                    const spiralR = state.holeRadius * 0.85 * rem;
                    b.sinkAngle += clampedDt * 16;
                    b.x = cx + Math.cos(b.sinkAngle) * spiralR;
                    b.y = cy + Math.sin(b.sinkAngle) * spiralR;
                }
                continue;
            }

            const speed = Math.hypot(b.vx, b.vy);
            b.rollPhase = (b.rollPhase + (speed / b.radius) * clampedDt * 0.35) % TWO_PI;

            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 8) b.trail.shift();
        }

        // Update Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.x += p.vx * clampedDt;
            p.y += p.vy * clampedDt;
            p.vx *= Math.pow(0.2, clampedDt);
            p.vy *= Math.pow(0.2, clampedDt);
            p.alpha -= clampedDt * 2.1;
            if (p.alpha <= 0) state.particles.splice(i, 1);
        }

        // Update Floating Score Popups
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
            const ft = state.floatingTexts[i];
            ft.y += ft.vy * clampedDt;
            ft.alpha -= clampedDt * 1.35;
            if (ft.alpha <= 0) state.floatingTexts.splice(i, 1);
        }

        // Update Shockwaves
        for (let i = state.shockwaves.length - 1; i >= 0; i--) {
            const sw = state.shockwaves[i];
            if (sw.inward) {
                sw.radius = Math.max(state.holeRadius, sw.radius - clampedDt * 560);
                sw.alpha -= clampedDt * 1.8;
            } else {
                sw.radius += clampedDt * 190;
                sw.alpha -= clampedDt * 2.2;
            }
            if (sw.alpha <= 0) state.shockwaves.splice(i, 1);
        }

        updateHUD();
    }

    function checkLevelComplete() {
        if (!state.levelCleared && state.sunkBalls >= state.totalBalls) {
            state.levelCleared = true;
            const timeBonus = Math.max(150, Math.round(1000 - state.elapsedSec * 14));
            state.score += timeBonus;
            audio.playLevelVictory();

            modalTitle.textContent = `LEVEL ${state.level} CLEARED`;
            modalSubtitle.textContent = `All ${state.totalBalls} kinetic spheres drawn into the singularity.`;
            modalBalls.textContent = `${state.sunkBalls} / ${state.totalBalls}`;
            modalTime.textContent = formatTime(state.elapsedSec);
            modalBonus.textContent = `+${timeBonus}`;
            btnNextLevel.innerHTML = `
                <span>PROCEED TO LEVEL ${state.level + 1} (${state.rings.length + 1} RINGS)</span>
                <span class="cta-arrow">➔</span>
            `;

            setTimeout(() => {
                levelModal.classList.remove('hidden');
            }, 420);
        }
    }

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateHUD() {
        hudLevel.textContent = state.level;
        hudRings.textContent = state.rings.length;
        hudBalls.textContent = `${state.sunkBalls} / ${state.totalBalls}`;
        hudCombo.textContent = `x${state.combo}`;
        hudScore.textContent = state.score.toLocaleString();

        const pct = state.totalBalls > 0 ? (state.sunkBalls / state.totalBalls) * 100 : 0;
        goalProgressBar.style.width = `${pct.toFixed(1)}%`;
    }

    // Render Scene
    function render(now) {
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.clearRect(0, 0, width, height);

        ctx.save();
        // Screen Shake Offset
        if (state.shakeTime > 0 && state.shakeMag > 0) {
            const sx = (Math.random() - 0.5) * state.shakeMag * 2;
            const sy = (Math.random() - 0.5) * state.shakeMag * 2;
            ctx.translate(sx, sy);
        }

        const cx = state.centerX;
        const cy = state.centerY;

        // 1. Twinkling Ambient Deep-Space Dust
        for (let i = 0; i < state.ambientStars.length; i++) {
            const st = state.ambientStars[i];
            const twinkle = 0.55 + 0.45 * Math.sin(now * 0.002 + st.phase);
            ctx.fillStyle = `rgba(148, 163, 184, ${st.alpha * twinkle})`;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.r, 0, TWO_PI);
            ctx.fill();
        }

        // 2. Subtle Gravity Well Radial Grid & Outer Containment Ring
        const funnelGrad = ctx.createRadialGradient(cx, cy, state.holeRadius * 0.5, cx, cy, state.outerArenaRadius);
        funnelGrad.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
        funnelGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.08)');
        funnelGrad.addColorStop(1, 'rgba(2, 6, 23, 0.35)');
        ctx.fillStyle = funnelGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, state.outerArenaRadius, 0, TWO_PI);
        ctx.fill();

        // Radial spokes
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
        ctx.lineWidth = 1;
        for (let a = 0; a < 12; a++) {
            const ang = (a / 12) * TWO_PI;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * state.holeRadius * 1.4, cy + Math.sin(ang) * state.holeRadius * 1.4);
            ctx.lineTo(cx + Math.cos(ang) * state.outerArenaRadius, cy + Math.sin(ang) * state.outerArenaRadius);
            ctx.stroke();
        }
        ctx.restore();

        // Outer Arena Rim
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, state.outerArenaRadius, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // 3. Shockwaves
        for (let i = 0; i < state.shockwaves.length; i++) {
            const sw = state.shockwaves[i];
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, sw.radius, 0, TWO_PI);
            ctx.strokeStyle = sw.color || '#38bdf8';
            ctx.globalAlpha = Math.max(0, sw.alpha);
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        // 4. Central Singularity Goal Hole
        const pulseExpand = state.corePulse * 7;
        const coreR = state.holeRadius + pulseExpand * 0.35;

        const coreGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR * 1.9);
        coreGlow.addColorStop(0, '#000000');
        coreGlow.addColorStop(0.5, '#030712');
        coreGlow.addColorStop(0.74, 'rgba(56, 189, 248, 0.65)');
        coreGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.save();
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR * 1.9, 0, TWO_PI);
        ctx.fill();

        // Swirling Accretion Disk inside the Central Hole
        ctx.translate(cx, cy);
        ctx.rotate(state.vortexSpin);
        for (let arm = 0; arm < 5; arm++) {
            ctx.rotate(TWO_PI / 5);
            ctx.beginPath();
            ctx.arc(coreR * 0.25, 0, coreR * 0.52, 0.1, Math.PI * 1.15);
            ctx.strokeStyle = arm % 2 === 0 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(192, 132, 252, 0.45)';
            ctx.lineWidth = 2.2;
            ctx.stroke();
        }
        ctx.restore();

        // Core Horizon Ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, TWO_PI);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5 + state.corePulse * 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16 + state.corePulse * 14;
        ctx.stroke();
        ctx.restore();

        // 5. Concentric Slotted Rings
        const targetRingIdx = state.hoveredRingIndex !== -1 ? state.hoveredRingIndex : state.activeRingIndex;

        state.rings.forEach((ring, idx) => {
            const isSelected = idx === targetRingIdx;

            // Compute sorted open slot intervals
            const gaps = ring.slots.map(s => {
                const center = normalizeAngle(ring.angle + s.offset);
                return {
                    center,
                    half: s.halfWidth,
                    start: center - s.halfWidth,
                    end: center + s.halfWidth
                };
            }).sort((a, b) => a.center - b.center);

            // Subtle guide track for selected ring
            if (isSelected) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, ring.radius, 0, TWO_PI);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
                ctx.lineWidth = ring.thickness + 10;
                ctx.stroke();
                ctx.restore();
            }

            // Draw Solid Metallic/Neon Ring Segments
            ctx.save();
            ctx.strokeStyle = ring.theme.main;
            ctx.lineWidth = ring.thickness;
            ctx.lineCap = 'round';
            ctx.shadowColor = ring.theme.main;
            ctx.shadowBlur = isSelected ? 16 : (8 + ring.highlightAlpha * 10);

            if (gaps.length === 1) {
                const g = gaps[0];
                ctx.beginPath();
                ctx.arc(cx, cy, ring.radius, g.end, g.start + TWO_PI);
                ctx.stroke();
            } else {
                for (let gIdx = 0; gIdx < gaps.length; gIdx++) {
                    const curr = gaps[gIdx];
                    const next = gaps[(gIdx + 1) % gaps.length];
                    let arcEnd = next.start;
                    if (gIdx === gaps.length - 1) arcEnd += TWO_PI;
                    if (arcEnd > curr.end) {
                        ctx.beginPath();
                        ctx.arc(cx, cy, ring.radius, curr.end, arcEnd);
                        ctx.stroke();
                    }
                }
            }

            // Inner metallic sheen line along the ring body
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
            ctx.lineWidth = Math.max(1.5, ring.thickness * 0.24);
            ctx.shadowBlur = 0;
            if (gaps.length === 1) {
                const g = gaps[0];
                ctx.beginPath();
                ctx.arc(cx, cy, ring.radius, g.end, g.start + TWO_PI);
                ctx.stroke();
            } else {
                for (let gIdx = 0; gIdx < gaps.length; gIdx++) {
                    const curr = gaps[gIdx];
                    const next = gaps[(gIdx + 1) % gaps.length];
                    let arcEnd = next.start;
                    if (gIdx === gaps.length - 1) arcEnd += TWO_PI;
                    if (arcEnd > curr.end) {
                        ctx.beginPath();
                        ctx.arc(cx, cy, ring.radius, curr.end, arcEnd);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();

            // Glowing Gate Caps + Inward Funnel Chevrons at each Slot Opening
            ctx.save();
            gaps.forEach(g => {
                [g.start, g.end].forEach(edgeAng => {
                    const gx = cx + Math.cos(edgeAng) * ring.radius;
                    const gy = cy + Math.sin(edgeAng) * ring.radius;
                    ctx.beginPath();
                    ctx.arc(gx, gy, ring.thickness * 0.54, 0, TWO_PI);
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = ring.theme.main;
                    ctx.shadowBlur = 10;
                    ctx.fill();
                });

                // Subtle inward beacon chevron inside the open slot
                const sx = cx + Math.cos(g.center) * ring.radius;
                const sy = cy + Math.sin(g.center) * ring.radius;
                ctx.beginPath();
                ctx.arc(sx, sy, 2.5, 0, TWO_PI);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.fill();
            });
            ctx.restore();
        });

        // 6. Render 3D Metallic/Glass Marbles & Velocity Ribbons
        for (let i = 0; i < state.balls.length; i++) {
            const b = state.balls[i];
            if (b.sunk && b.sinkProgress >= 1) continue;

            const scale = b.sunk ? (1 - b.sinkProgress * 0.88) : 1;
            const r = Math.max(1.2, b.radius * scale);

            // Motion Trail Ribbon
            if (!b.sunk && b.trail.length > 1) {
                ctx.save();
                for (let t = 0; t < b.trail.length - 1; t++) {
                    const pt = b.trail[t];
                    const ratio = (t + 1) / b.trail.length;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, r * ratio * 0.68, 0, TWO_PI);
                    ctx.fillStyle = b.palette.mid;
                    ctx.globalAlpha = ratio * 0.24;
                    ctx.fill();
                }
                ctx.restore();
            }

            // 3D Shaded Marble Sphere
            ctx.save();
            const grad = ctx.createRadialGradient(
                b.x - r * 0.32,
                b.y - r * 0.32,
                r * 0.1,
                b.x,
                b.y,
                r
            );
            grad.addColorStop(0, b.palette.core);
            grad.addColorStop(0.55, b.palette.mid);
            grad.addColorStop(1, b.palette.rim);

            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, TWO_PI);
            ctx.fillStyle = grad;
            ctx.shadowColor = b.palette.mid;
            ctx.shadowBlur = 10;
            ctx.fill();

            // Rolling internal stripe cue for realistic rolling visual
            const stripeOffX = Math.cos(b.rollPhase) * r * 0.28;
            const stripeOffY = Math.sin(b.rollPhase) * r * 0.28;
            ctx.beginPath();
            ctx.arc(b.x + stripeOffX, b.y + stripeOffY, r * 0.24, 0, TWO_PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fill();

            // Crisp specular glint
            ctx.beginPath();
            ctx.arc(b.x - r * 0.34, b.y - r * 0.34, r * 0.26, 0, TWO_PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fill();
            ctx.restore();
        }

        // 7. Sparkle Particles
        for (let i = 0; i < state.particles.length; i++) {
            const p = state.particles[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, TWO_PI);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
        }

        // 8. Floating Score Popups
        for (let i = 0; i < state.floatingTexts.length; i++) {
            const ft = state.floatingTexts[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.font = '800 13px "Orbitron", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = ft.color;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = 6;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        ctx.restore();
    }

    // Main Loop
    let lastTime = performance.now();
    function animate(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        updatePhysics(dt);
        render(now);

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resizeCanvas);

    // Start Level 1
    initLevel(1);
    requestAnimationFrame(animate);
})();
