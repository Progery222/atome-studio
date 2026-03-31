/**
 * ═══════════════════════════════════════════════════════════════════
 *  ATOME GALAXY — Interactive 3D Microservice Architecture Visualizer
 *  Three.js + Custom Shaders + Post-Processing
 * ═══════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { SERVICES, CONNECTIONS } from './services-data.js';
import {
    coreVertexShader, coreFragmentShader,
    coreGlowVertexShader, coreGlowFragmentShader,
    planetVertexShader, planetFragmentShader,
    planetGlowVertexShader, planetGlowFragmentShader,
    orbitVertexShader, orbitFragmentShader,
    beamVertexShader, beamFragmentShader,
    starsVertexShader, starsFragmentShader,
    dustVertexShader, dustFragmentShader,
} from './shaders.js';


// ═══════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
    camera: {
        fov: 55,
        near: 0.1,
        far: 1000,
        startPos: new THREE.Vector3(0, 10, 55),
        parallaxIntensity: 0.8,
        smoothFactor: 0.04,
        zoomSpeed: 1.5,
        minZoom: 18,
        maxZoom: 75,
    },
    bloom: {
        strength: 1.0,
        radius: 1.5,
        threshold: 0.2,
    },
    fog: {
        color: 0x0F0F23,
        near: 20,
        far: 80,
    },
    stars: { count: 3000 },
    dust: { count: 800 },
    core: {
        radius: 3.5,
        segments: 64,
        glowScale: 4.5,
    },
    focusTransitionDuration: 1.5,
};


// ═══════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════

const state = {
    time: 0,
    mouse: new THREE.Vector2(0, 0),
    mouseTarget: new THREE.Vector2(0, 0),
    cameraTarget: CONFIG.camera.startPos.clone(),
    cameraLookTarget: new THREE.Vector3(0, 0, 0),
    currentLook: new THREE.Vector3(0, 0, 0),
    targetZoom: CONFIG.camera.startPos.z,
    hoveredService: null,
    focusedService: null,
    isFocusing: false,
    focusProgress: 0,
    focusFrom: null,
    focusTo: null,
    focusLookFrom: null,
    focusLookTo: null,
    alertMode: false,
    audioEnabled: false,
    planets: [],    // { mesh, glow, orbit, data, angle }
    beams: [],      // { line, fromId, toId, material }
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
};


// ═══════════════════════════════════════════════════════════════════
//  INIT THREE.JS
// ═══════════════════════════════════════════════════════════════════

const canvas = document.getElementById('galaxy-canvas');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.fog.color);
scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);

const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far,
);
camera.position.copy(CONFIG.camera.startPos);
camera.lookAt(0, 0, 0);


// ═══════════════════════════════════════════════════════════════════
//  POST-PROCESSING
// ═══════════════════════════════════════════════════════════════════

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloom.strength,
    CONFIG.bloom.radius,
    CONFIG.bloom.threshold,
);
composer.addPass(bloomPass);

const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.uniforms['resolution'].value.set(
    1 / (window.innerWidth * renderer.getPixelRatio()),
    1 / (window.innerHeight * renderer.getPixelRatio()),
);
composer.addPass(fxaaPass);


// ═══════════════════════════════════════════════════════════════════
//  LIGHTING
// ═══════════════════════════════════════════════════════════════════

const ambientLight = new THREE.AmbientLight(0x1a1a3e, 0.6);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0x4488ff, 3, 40);
pointLight1.position.set(0, 0, 0);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x8844ff, 1.5, 50);
pointLight2.position.set(10, 5, -10);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0xffaa22, 0.8, 30);
pointLight3.position.set(-8, -3, 8);
scene.add(pointLight3);


// ═══════════════════════════════════════════════════════════════════
//  CORE NUCLEUS
// ═══════════════════════════════════════════════════════════════════

function createCore() {
    // 1. Outer Dark Glass Shell (The bubble)
    const glassGeo = new THREE.SphereGeometry(CONFIG.core.radius * 1.15, 64, 64);
    const glassMat = new THREE.ShaderMaterial({
        vertexShader: coreGlowVertexShader, // Reusing but will modify shader behavior
        fragmentShader: coreGlowFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uAlertMode: { value: 0 },
        },
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
        blending: THREE.NormalBlending, // Normal blend for a solid glass look
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.name = 'core-glass';
    scene.add(glassMesh);

    // 2. The Holographic Siri Ribbons (Multiple overlapping displaced spheres)
    const geo = new THREE.SphereGeometry(CONFIG.core.radius, CONFIG.core.segments, CONFIG.core.segments);
    const mat = new THREE.ShaderMaterial({
        vertexShader: coreVertexShader,
        fragmentShader: coreFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uAlertMode: { value: 0 },
        },
        transparent: true,
        blending: THREE.NormalBlending, // Normal blend to prevent white blowout!
        depthWrite: false, 
        side: THREE.FrontSide, // FrontSide only so the back halves don't overlap through the center
    });
    
    // We create 3 intersecting ribbon layers with different rotations and scales
    const ribbon1 = new THREE.Mesh(geo, mat);
    const ribbon2 = new THREE.Mesh(geo, mat);
    const ribbon3 = new THREE.Mesh(geo, mat);
    
    ribbon1.rotation.set(0, 0, 0);
    ribbon2.rotation.set(Math.PI / 3, Math.PI / 4, 0);
    ribbon2.scale.set(0.9, 0.95, 0.85);
    ribbon3.rotation.set(-Math.PI / 4, Math.PI / 6, Math.PI / 2);
    ribbon3.scale.set(0.85, 0.9, 0.95);
    
    scene.add(ribbon1);
    scene.add(ribbon2);
    scene.add(ribbon3);

    // 3. The Bright White Center Core (With a light outline / rim)
    const centerGeo = new THREE.SphereGeometry(CONFIG.core.radius * 0.12, 32, 32);
    const centerMat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0xffffff) }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform vec3 uColor;
            void main() {
                vec3 viewDir = normalize(-vPosition);
                float ndotv = max(dot(viewDir, vNormal), 0.0);
                
                // Light outline (fresnel rim) and less bright center
                float rim = pow(1.0 - ndotv, 1.5); // Outline thickness
                float alpha = mix(0.1, 0.7, rim); // 0.1 center opacity, 0.7 rim opacity
                
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    scene.add(centerMesh);

    // Inner light rays (God rays / radial flare)
    const rayGeo = new THREE.PlaneGeometry(24, 24);
    // Radial gradient glow texture via simple custom shader
    const rayMat = new THREE.ShaderMaterial({
        uniforms: { 
            uColor: { value: new THREE.Color(0x3388ff) },
            uTime: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec3 uColor;
            uniform float uTime;
            void main() {
                vec2 center = vUv - 0.5;
                float dist = length(center);
                // Creating star-ray-like pattern
                float angle = atan(center.y, center.x);
                float rays = sin(angle * 12.0) * 0.5 + 0.5;
                rays *= sin(angle * 5.0) * 0.5 + 0.5;
                float glow = smoothstep(0.5, 0.0, dist);
                float alpha = glow * (0.1 + rays * 0.4) * 0.08;
                
                // Shift color slightly for Siri look
                vec3 colorPink = vec3(0.6, 0.1, 0.5);
                vec3 colorCyan = vec3(0.1, 0.6, 0.8);
                float mixVal = sin(uTime * 0.5 + angle * 2.0) * 0.5 + 0.5;
                vec3 mixedColor = mix(colorCyan, colorPink, mixVal);

                gl_FragColor = vec4(mixedColor, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    for (let i = 0; i < 4; i++) {
        const ray = new THREE.Mesh(rayGeo, rayMat.clone());
        ray.rotation.set(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI,
        );
        ray.name = `core-ray-${i}`;
        scene.add(ray);
    }

    return { glassMesh, ribbon1, ribbon2, ribbon3, centerMesh };
}

const core = createCore();


// ═══════════════════════════════════════════════════════════════════
//  ORBITS
// ═══════════════════════════════════════════════════════════════════

function createOrbit(radius, color) {
    // TorusGeometry(radius, tube, radialSegments, tubularSegments)
    const geo = new THREE.TorusGeometry(radius, 0.025, 16, 256);

    const mat = new THREE.ShaderMaterial({
        vertexShader: orbitVertexShader,
        fragmentShader: orbitFragmentShader,
        uniforms: {
            uColor: { value: new THREE.Color(...color) },
            uTime: { value: 0 },
            uAlertMode: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });

    const orbitMesh = new THREE.Mesh(geo, mat);
    // Torus lies in XY plane by default, rotate to XZ plane
    orbitMesh.rotation.x = Math.PI / 2;

    return orbitMesh;
}


// ═══════════════════════════════════════════════════════════════════
//  PLANETS (SERVICES)
// ═══════════════════════════════════════════════════════════════════

function createPlanet(serviceData) {
    const { color, size, orbitRadius, orbitTiltX, orbitTiltY, orbitPhase } = serviceData;
    const colorVec = new THREE.Vector3(color[0], color[1], color[2]);

    // Group to handle compound orbit tilt effortlessly
    const pivotGroup = new THREE.Group();
    pivotGroup.rotation.x = orbitTiltX || 0;
    pivotGroup.rotation.y = orbitTiltY || 0;
    scene.add(pivotGroup);

    // Planet mesh wrapper (relative to pivot)
    const planetWrapper = new THREE.Group();
    pivotGroup.add(planetWrapper);

    // Planet mesh
    const geo = new THREE.SphereGeometry(size, 32, 32);
    const mat = new THREE.ShaderMaterial({
        vertexShader: planetVertexShader,
        fragmentShader: planetFragmentShader,
        uniforms: {
            uColor: { value: colorVec },
            uTime: { value: 0 },
            uHover: { value: 0 },
            uAlertMode: { value: 0 },
        },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { serviceId: serviceData.id };
    planetWrapper.add(mesh);

    // Glow
    const glowGeo = new THREE.SphereGeometry(size * 1.8, 24, 24);
    const glowMat = new THREE.ShaderMaterial({
        vertexShader: planetGlowVertexShader,
        fragmentShader: planetGlowFragmentShader,
        uniforms: {
            uColor: { value: colorVec },
            uHover: { value: 0 },
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    planetWrapper.add(glow);

    // Orbit
    const orbit = createOrbit(orbitRadius, color);
    pivotGroup.add(orbit);

    const planetObj = {
        pivot: pivotGroup,
        wrapper: planetWrapper,
        mesh,
        glow,
        orbit,
        data: serviceData,
        angle: orbitPhase,
        hoverAmount: 0,
    };
    state.planets.push(planetObj);

    return planetObj;
}

// Create all service planets
SERVICES.forEach(s => createPlanet(s));


// ═══════════════════════════════════════════════════════════════════
//  SERVICE LABELS (HTML overlay)
// ═══════════════════════════════════════════════════════════════════

const labelContainer = document.createElement('div');
labelContainer.id = 'label-container';
labelContainer.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden;';
document.body.appendChild(labelContainer);

const labels = [];
state.planets.forEach(p => {
    const label = document.createElement('div');
    label.className = 'service-label';
    label.textContent = p.data.name;
    label.style.cssText = `
        position:absolute;
        font-family:var(--font-mono);
        font-size:10px;
        letter-spacing:1px;
        color:rgba(226,232,240,0.7);
        text-transform:uppercase;
        white-space:nowrap;
        transform:translate(-50%,8px);
        text-shadow:0 0 8px rgba(15,15,35,0.9);
        transition:opacity 0.3s ease, color 0.3s ease;
    `;
    labelContainer.appendChild(label);
    labels.push({ el: label, planet: p });
});

function updateLabels() {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    const vec = new THREE.Vector3();

    labels.forEach(({ el, planet }) => {
        planet.mesh.getWorldPosition(vec);
        vec.project(camera);

        // Behind camera check
        if (vec.z > 1) {
            el.style.opacity = '0';
            return;
        }

        const x = vec.x * halfW + halfW;
        const y = -(vec.y * halfH) + halfH;

        el.style.left = x + 'px';
        el.style.top = (y + 12) + 'px';
        el.style.opacity = state.focusedService && state.focusedService !== planet ? '0.15' : '0.8';
    });
}


// ═══════════════════════════════════════════════════════════════════
//  ENERGY BEAMS (CONNECTIONS)
// ═══════════════════════════════════════════════════════════════════

function createBeam(conn) {
    const segments = 40;
    const positions = new Float32Array(segments * 3);
    const alphas = new Float32Array(segments);

    for (let i = 0; i < segments; i++) {
        alphas[i] = Math.sin((i / (segments - 1)) * Math.PI);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    const fromPlanet = state.planets.find(p => p.data.id === conn.from);
    const toPlanet = state.planets.find(p => p.data.id === conn.to);

    // Blend colors
    const mixedColor = new THREE.Color(
        (fromPlanet.data.color[0] + toPlanet.data.color[0]) * 0.5,
        (fromPlanet.data.color[1] + toPlanet.data.color[1]) * 0.5,
        (fromPlanet.data.color[2] + toPlanet.data.color[2]) * 0.5,
    );

    const mat = new THREE.ShaderMaterial({
        vertexShader: beamVertexShader,
        fragmentShader: beamFragmentShader,
        uniforms: {
            uColor: { value: mixedColor },
            uTime: { value: 0 },
            uIntensity: { value: conn.intensity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geo, mat);
    scene.add(line);

    const beam = {
        line,
        geo,
        fromId: conn.from,
        toId: conn.to,
        material: mat,
    };
    state.beams.push(beam);
    return beam;
}

CONNECTIONS.forEach(c => createBeam(c));


// ═══════════════════════════════════════════════════════════════════
//  BACKGROUND STARS
// ═══════════════════════════════════════════════════════════════════

function createStars() {
    const count = CONFIG.stars.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Distribute in a large sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 30 + Math.random() * 70;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        sizes[i] = 0.5 + Math.random() * 2.0;
        brightness[i] = 0.3 + Math.random() * 0.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));

    const mat = new THREE.ShaderMaterial({
        vertexShader: starsVertexShader,
        fragmentShader: starsFragmentShader,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(geo, mat);
    stars.name = 'stars';
    scene.add(stars);
    return stars;
}

const stars = createStars();


// ═══════════════════════════════════════════════════════════════════
//  FLOATING DUST PARTICLES
// ═══════════════════════════════════════════════════════════════════

function createDust() {
    const count = CONFIG.dust.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

        sizes[i] = 0.3 + Math.random() * 1.5;
        phases[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
        vertexShader: dustVertexShader,
        fragmentShader: dustFragmentShader,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const dust = new THREE.Points(geo, mat);
    dust.name = 'dust';
    scene.add(dust);
    return dust;
}

const dust = createDust();


// ═══════════════════════════════════════════════════════════════════
//  REQUEST PARTICLE STREAMS (between connected services)
// ═══════════════════════════════════════════════════════════════════

const REQUEST_PARTICLES_COUNT = 200;
const reqParticlePositions = new Float32Array(REQUEST_PARTICLES_COUNT * 3);
const reqParticleSizes = new Float32Array(REQUEST_PARTICLES_COUNT);
const reqParticlePhases = new Float32Array(REQUEST_PARTICLES_COUNT);
const reqParticleConnIdx = new Int32Array(REQUEST_PARTICLES_COUNT);

for (let i = 0; i < REQUEST_PARTICLES_COUNT; i++) {
    reqParticlePhases[i] = Math.random();
    reqParticleSizes[i] = 0.4 + Math.random() * 0.8;
    reqParticleConnIdx[i] = Math.floor(Math.random() * CONNECTIONS.length);
}

const reqGeo = new THREE.BufferGeometry();
reqGeo.setAttribute('position', new THREE.BufferAttribute(reqParticlePositions, 3));
reqGeo.setAttribute('aSize', new THREE.BufferAttribute(reqParticleSizes, 1));
reqGeo.setAttribute('aPhase', new THREE.BufferAttribute(reqParticlePhases, 1));

const reqMat = new THREE.ShaderMaterial({
    vertexShader: dustVertexShader,
    fragmentShader: dustFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const reqParticles = new THREE.Points(reqGeo, reqMat);
reqParticles.name = 'request-particles';
scene.add(reqParticles);


// ═══════════════════════════════════════════════════════════════════
//  UI ELEMENTS
// ═══════════════════════════════════════════════════════════════════

const tooltip = document.getElementById('tooltip');
const tooltipName = document.getElementById('tooltip-name');
const tooltipStatus = document.getElementById('tooltip-status');
const servicePanel = document.getElementById('service-panel');
const panelName = document.getElementById('panel-name');
const panelType = document.getElementById('panel-type');
const pmLatency = document.getElementById('pm-latency');
const pmLoad = document.getElementById('pm-load');
const pmRps = document.getElementById('pm-rps');
const pmErrors = document.getElementById('pm-errors');
const panelSubList = document.getElementById('panel-sub-list');
const loadingScreen = document.getElementById('loading-screen');
const btnAlert = document.getElementById('btn-alert');
const btnAudio = document.getElementById('btn-audio');
const panelClose = document.getElementById('panel-close');
const statusText = document.getElementById('status-text');
const statusDot = document.querySelector('.status-dot');


// ═══════════════════════════════════════════════════════════════════
//  SERVICE PANEL
// ═══════════════════════════════════════════════════════════════════

function showServicePanel(serviceData) {
    panelName.textContent = serviceData.name;
    panelType.textContent = serviceData.type;
    pmLatency.textContent = serviceData.metrics.latency;
    pmLoad.textContent = serviceData.metrics.load;
    pmRps.textContent = serviceData.metrics.rps;
    pmErrors.textContent = serviceData.metrics.errors;

    // Color the latency/errors
    const errVal = parseFloat(serviceData.metrics.errors);
    pmErrors.style.color = errVal > 0.05 ? '#fb7185' : errVal > 0 ? '#fbbf24' : '#34d399';

    // Sub-services
    panelSubList.innerHTML = '';
    serviceData.subs.forEach(sub => {
        const el = document.createElement('div');
        el.className = 'sub-item';
        el.innerHTML = `
            <span class="sub-dot" style="background:${sub.color};box-shadow:0 0 6px ${sub.color}"></span>
            <span class="sub-name">${sub.name}</span>
            <span class="sub-status" style="color:${sub.color}">${sub.status.toUpperCase()}</span>
        `;
        panelSubList.appendChild(el);
    });

    servicePanel.classList.remove('hidden');
}

function hideServicePanel() {
    servicePanel.classList.add('hidden');
}


// ═══════════════════════════════════════════════════════════════════
//  FOCUS CAMERA ON SERVICE
// ═══════════════════════════════════════════════════════════════════

function focusOnService(planetObj) {
    if (state.isFocusing) return;

    state.focusedService = planetObj;
    state.isFocusing = true;
    state.focusProgress = 0;

    // Calculate target position: offset from planet
    const planetPos = new THREE.Vector3();
    planetObj.mesh.getWorldPosition(planetPos);
    
    const dir = planetPos.clone().normalize();
    const offset = dir.multiplyScalar(5); // Increased distance due to larger general scale
    const upOffset = new THREE.Vector3(0, 2.5, 0);

    state.focusFrom = camera.position.clone();
    state.focusTo = planetPos.clone().add(offset).add(upOffset);
    state.focusLookFrom = state.currentLook.clone();
    state.focusLookTo = planetPos.clone();

    showServicePanel(planetObj.data);
}

function unfocusService() {
    if (!state.focusedService) return;

    state.isFocusing = true;
    state.focusProgress = 0;
    state.focusFrom = camera.position.clone();
    state.focusTo = CONFIG.camera.startPos.clone();
    state.focusTo.z = state.targetZoom;
    state.focusLookFrom = state.currentLook.clone();
    state.focusLookTo = new THREE.Vector3(0, 0, 0);
    state.focusedService = null;

    hideServicePanel();
}


// ═══════════════════════════════════════════════════════════════════
//  ALERT MODE
// ═══════════════════════════════════════════════════════════════════

let alertModeValue = 0;
let alertTarget = 0;

function toggleAlertMode() {
    state.alertMode = !state.alertMode;
    alertTarget = state.alertMode ? 1 : 0;

    btnAlert.classList.toggle('active', state.alertMode);
    document.body.classList.toggle('alert-mode', state.alertMode);

    if (state.alertMode) {
        statusText.textContent = 'ALERT: SERVICE DEGRADED';
        statusDot.classList.add('alert');
        statusDot.classList.remove('pulse');
    } else {
        statusText.textContent = 'SYSTEM ONLINE';
        statusDot.classList.remove('alert');
        statusDot.classList.add('pulse');
    }
}


// ═══════════════════════════════════════════════════════════════════
//  AUDIO REACTIVITY (lightweight)
// ═══════════════════════════════════════════════════════════════════

let audioCtx = null;
let audioAnalyser = null;
let audioData = null;
let audioLevel = 0;

function toggleAudio() {
    state.audioEnabled = !state.audioEnabled;
    btnAudio.classList.toggle('active', state.audioEnabled);

    if (state.audioEnabled && !audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                const source = audioCtx.createMediaStreamSource(stream);
                audioAnalyser = audioCtx.createAnalyser();
                audioAnalyser.fftSize = 64;
                source.connect(audioAnalyser);
                audioData = new Uint8Array(audioAnalyser.frequencyBinCount);
            }).catch(() => {
                state.audioEnabled = false;
                btnAudio.classList.remove('active');
            });
        } catch (e) {
            state.audioEnabled = false;
            btnAudio.classList.remove('active');
        }
    }
}

function updateAudioLevel() {
    if (!audioAnalyser || !state.audioEnabled) {
        audioLevel = THREE.MathUtils.lerp(audioLevel, 0, 0.05);
        return;
    }
    audioAnalyser.getByteFrequencyData(audioData);
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) sum += audioData[i];
    const avg = sum / audioData.length / 255;
    audioLevel = THREE.MathUtils.lerp(audioLevel, avg, 0.15);
}


// ═══════════════════════════════════════════════════════════════════
//  EASING
// ═══════════════════════════════════════════════════════════════════

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}


// ═══════════════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════════

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    state.time += delta;
    const t = state.time;

    updateAudioLevel();

    // Audio boost
    const audioBoost = 1 + audioLevel * 0.5;

    // Alert mode smooth transition
    alertModeValue = THREE.MathUtils.lerp(alertModeValue, alertTarget, delta * 3);

    // ── Mouse smoothing ──
    state.mouse.lerp(state.mouseTarget, CONFIG.camera.smoothFactor);

    // ── Camera parallax ──
    if (!state.isFocusing && !state.focusedService) {
        const parallax = CONFIG.camera.parallaxIntensity;
        state.cameraTarget.x = state.mouse.x * parallax;
        state.cameraTarget.y = CONFIG.camera.startPos.y + state.mouse.y * parallax * 0.5;
        state.cameraTarget.z = state.targetZoom;

        // Gentle floating
        state.cameraTarget.x += Math.sin(t * 0.2) * 0.3;
        state.cameraTarget.y += Math.cos(t * 0.15) * 0.2;

        camera.position.lerp(state.cameraTarget, CONFIG.camera.smoothFactor);
        state.currentLook.lerp(new THREE.Vector3(0, 0, 0), CONFIG.camera.smoothFactor);
        camera.lookAt(state.currentLook);
    }

    // ── Focus transition ──
    if (state.isFocusing) {
        state.focusProgress += delta / CONFIG.focusTransitionDuration;
        if (state.focusProgress >= 1) {
            state.focusProgress = 1;
            state.isFocusing = false;
        }
        const ease = easeInOutCubic(state.focusProgress);

        camera.position.lerpVectors(state.focusFrom, state.focusTo, ease);
        state.currentLook.lerpVectors(state.focusLookFrom, state.focusLookTo, ease);
        camera.lookAt(state.currentLook);
    }

    // If focused (not transitioning), keep tracking
    if (state.focusedService && !state.isFocusing) {
        const targetPos = new THREE.Vector3();
        state.focusedService.mesh.getWorldPosition(targetPos);
        const dir = targetPos.clone().normalize();
        const camPos = targetPos.clone().add(dir.multiplyScalar(5)).add(new THREE.Vector3(0, 2.5, 0));

        camera.position.lerp(camPos, CONFIG.camera.smoothFactor * 2);
        state.currentLook.lerp(targetPos, CONFIG.camera.smoothFactor * 2);
        camera.lookAt(state.currentLook);
    }

    // ── Core animation ──
    const coreScale = (1 + Math.sin(t * 2.0) * 0.05) * audioBoost;
    
    // Animate the distinct internal Siri ribbons
    core.ribbon1.scale.setScalar(coreScale);
    core.ribbon2.scale.copy(core.ribbon1.scale).multiply(new THREE.Vector3(0.9, 0.95, 0.85));
    core.ribbon3.scale.copy(core.ribbon1.scale).multiply(new THREE.Vector3(0.85, 0.9, 0.95));

    [core.ribbon1, core.ribbon2, core.ribbon3].forEach(r => {
        r.material.uniforms.uTime.value = t;
        r.material.uniforms.uAlertMode.value = alertModeValue;
    });
    
    // Animate the outer glass bubble
    core.glassMesh.scale.setScalar(coreScale);
    core.glassMesh.material.uniforms.uTime.value = t;
    core.glassMesh.material.uniforms.uAlertMode.value = alertModeValue;

    scene.children.forEach(child => {
        if (child.name && child.name.startsWith('core-ray-')) {
            child.material.uniforms.uTime.value = t;
        }
    });

    // Core rays rotation
    scene.children.forEach(child => {
        if (child.name?.startsWith('core-ray-')) {
            child.rotation.x += delta * 0.1;
            child.rotation.y += delta * 0.15;
        }
    });

    // Core light pulse
    pointLight1.intensity = 3 + Math.sin(t * 2.0) * 0.8 + audioLevel * 3;

    // ── Planet animation ──
    state.planets.forEach(p => {
        // Orbital movement
        p.angle += p.data.orbitSpeed * delta * audioBoost;
        const r = p.data.orbitRadius;

        // Simplify position! Group handles tilt rotation
        p.wrapper.position.set(Math.cos(p.angle) * r, 0, Math.sin(p.angle) * r);
        
        // Counter-rotate the wrapper so the planet meshes always face upright 
        // regardless of the pivot's tilt (optional but keeps textures/glow looking good)
        p.wrapper.quaternion.copy(p.pivot.quaternion).invert();

        // Orbit breathing (Torus scaling)
        const breathe = 1 + Math.sin(t * 0.5 + p.data.orbitPhase) * 0.02;
        p.orbit.scale.set(breathe, breathe, 1);

        // Update shader uniforms
        p.mesh.material.uniforms.uTime.value = t;
        p.mesh.material.uniforms.uAlertMode.value = alertModeValue;

        // Hover animation
        const isHovered = state.hoveredService === p.data.id;
        const hoverTarget = isHovered ? 1 : 0;
        p.hoverAmount = THREE.MathUtils.lerp(p.hoverAmount, hoverTarget, delta * 5);
        p.mesh.material.uniforms.uHover.value = p.hoverAmount;
        p.glow.material.uniforms.uHover.value = p.hoverAmount;

        // Scale on hover
        const sizeBase = p.data.size;
        const hoverScale = 1 + p.hoverAmount * 0.3;
        p.mesh.scale.setScalar(hoverScale);
        p.glow.scale.setScalar(hoverScale);

        // Orbit shader
        p.orbit.material.uniforms.uTime.value = t;
        p.orbit.material.uniforms.uAlertMode.value = alertModeValue;
    });

    // ── Energy beams ──
    const vecFrom = new THREE.Vector3();
    const vecTo = new THREE.Vector3();

    state.beams.forEach(beam => {
        const fromPlanet = state.planets.find(p => p.data.id === beam.fromId);
        const toPlanet = state.planets.find(p => p.data.id === beam.toId);
        if (!fromPlanet || !toPlanet) return;

        fromPlanet.mesh.getWorldPosition(vecFrom);
        toPlanet.mesh.getWorldPosition(vecTo);

        const positions = beam.geo.attributes.position.array;
        const segments = positions.length / 3;

        // Curved path with slight arc
        const mid = new THREE.Vector3().addVectors(vecFrom, vecTo).multiplyScalar(0.5);
        const normal = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(vecTo, vecFrom).normalize(),
            new THREE.Vector3(0, 1, 0),
        ).multiplyScalar(vecFrom.distanceTo(vecTo) * 0.15);
        mid.add(normal);

        for (let i = 0; i < segments; i++) {
            const frac = i / (segments - 1);
            // Quadratic bezier
            const a = vecFrom.clone().multiplyScalar((1 - frac) * (1 - frac));
            const b = mid.clone().multiplyScalar(2 * (1 - frac) * frac);
            const c = vecTo.clone().multiplyScalar(frac * frac);
            const point = a.add(b).add(c);

            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;
        }
        beam.geo.attributes.position.needsUpdate = true;
        beam.material.uniforms.uTime.value = t;
    });

    // ── Request particles ──
    for (let i = 0; i < REQUEST_PARTICLES_COUNT; i++) {
        const connIdx = reqParticleConnIdx[i];
        const conn = CONNECTIONS[connIdx];
        const fromPlanet = state.planets.find(p => p.data.id === conn.from);
        const toPlanet = state.planets.find(p => p.data.id === conn.to);
        if (!fromPlanet || !toPlanet) continue;

        // Animate along connection path
        let phase = (reqParticlePhases[i] + t * 0.3 * conn.intensity) % 1;
        
        fromPlanet.mesh.getWorldPosition(vecFrom);
        toPlanet.mesh.getWorldPosition(vecTo);

        reqParticlePositions[i * 3] = THREE.MathUtils.lerp(vecFrom.x, vecTo.x, phase) + Math.sin(phase * 10 + t) * 0.1;
        reqParticlePositions[i * 3 + 1] = THREE.MathUtils.lerp(vecFrom.y, vecTo.y, phase) + Math.cos(phase * 8 + t) * 0.08;
        reqParticlePositions[i * 3 + 2] = THREE.MathUtils.lerp(vecFrom.z, vecTo.z, phase) + Math.sin(phase * 12 + t * 0.5) * 0.1;
    }
    reqGeo.attributes.position.needsUpdate = true;
    reqMat.uniforms.uTime.value = t;

    // ── Stars & Dust ──
    stars.material.uniforms.uTime.value = t;
    stars.rotation.y += delta * 0.003;
    dust.material.uniforms.uTime.value = t;

    // ── Raycasting for hover ──
    state.raycaster.setFromCamera(state.pointer, camera);
    const planetMeshes = state.planets.map(p => p.mesh);
    const intersects = state.raycaster.intersectObjects(planetMeshes);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const sid = hit.userData.serviceId;
        state.hoveredService = sid;
        canvas.style.cursor = 'pointer';

        // Update tooltip
        const service = SERVICES.find(s => s.id === sid);
        tooltipName.textContent = service.name;
        tooltipStatus.textContent = `${service.metrics.rps} RPS · ${service.metrics.latency}`;
        tooltip.classList.remove('hidden');
    } else {
        state.hoveredService = null;
        canvas.style.cursor = 'default';
        tooltip.classList.add('hidden');
    }

    // ── Update labels ──
    updateLabels();

    // ── Dynamic Bloom ──
    // Smoothly reduce bloom intensity when zoomed in to prevent blinding glare
    const distToCenter = camera.position.length();
    const bloomFactor = THREE.MathUtils.clamp((distToCenter - 15) / 30, 0.1, 1.0);
    bloomPass.strength = CONFIG.bloom.strength * bloomFactor;

    // ── Render ──
    composer.render();
}


// ═══════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════

// Mouse move -> parallax + pointer tracking
window.addEventListener('mousemove', e => {
    state.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;

    state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Tooltip position
    tooltip.style.left = e.clientX + 16 + 'px';
    tooltip.style.top = e.clientY - 10 + 'px';
});

// Scroll -> zoom
window.addEventListener('wheel', e => {
    if (state.focusedService) return;
    state.targetZoom += e.deltaY * 0.01 * CONFIG.camera.zoomSpeed;
    state.targetZoom = THREE.MathUtils.clamp(
        state.targetZoom,
        CONFIG.camera.minZoom,
        CONFIG.camera.maxZoom,
    );
}, { passive: true });

// Click -> focus
canvas.addEventListener('click', () => {
    if (state.hoveredService) {
        const planet = state.planets.find(p => p.data.id === state.hoveredService);
        if (planet) {
            if (state.focusedService === planet) {
                unfocusService();
            } else {
                if (state.focusedService) unfocusService();
                setTimeout(() => focusOnService(planet), state.focusedService ? 400 : 0);
            }
        }
    }
});

// Escape -> unfocus
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') unfocusService();
});

// Panel close button
panelClose.addEventListener('click', () => unfocusService());

// Alert toggle
btnAlert.addEventListener('click', toggleAlertMode);

// Audio toggle
btnAudio.addEventListener('click', toggleAudio);

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    fxaaPass.uniforms['resolution'].value.set(
        1 / (window.innerWidth * renderer.getPixelRatio()),
        1 / (window.innerHeight * renderer.getPixelRatio()),
    );
});


// ═══════════════════════════════════════════════════════════════════
//  METRICS UPDATE SIMULATION
// ═══════════════════════════════════════════════════════════════════

function updateMetrics() {
    const metricLatency = document.getElementById('metric-latency');
    const metricLoad = document.getElementById('metric-load');

    const latency = Math.round(8 + Math.random() * 20);
    const load = Math.round(50 + Math.random() * 40);

    metricLatency.textContent = latency + 'ms';
    metricLoad.textContent = load + '%';

    // Color by value
    metricLatency.style.color = latency > 20 ? '#fbbf24' : '#60a5fa';
    metricLoad.style.color = load > 80 ? '#fb7185' : '#60a5fa';
}

setInterval(updateMetrics, 2000);


// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════

// Hide loading screen after short delay
setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 800);
}, 1200);

// Start render loop
animate();

console.log('%c⚛ ATOME GALAXY — Ready', 'color: #60a5fa; font-weight: bold; font-size: 14px;');
