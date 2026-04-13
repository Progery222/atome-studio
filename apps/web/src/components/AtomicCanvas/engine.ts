/**
 * ═══════════════════════════════════════════════════════════════════
 *  ATOME GALAXY ENGINE — 1:1 port of galaxy/main.js for React
 *  Three.js + Custom Shaders + Post-Processing
 * ═══════════════════════════════════════════════════════════════════
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { getT } from "../../i18n";
import {
  beamFragmentShader,
  beamVertexShader,
  coreFragmentShader,
  coreVertexShader,
  dustFragmentShader,
  dustVertexShader,
  orbitFragmentShader,
  orbitVertexShader,
  planetFragmentShader,
  planetGlowFragmentShader,
  planetGlowVertexShader,
  planetVertexShader,
  starsFragmentShader,
  starsVertexShader,
} from "./shaders";

// ═══════════════════════════════════════════════════════════════════
//  SERVICE DATA (matches galaxy/services-data.js exactly)
// ═══════════════════════════════════════════════════════════════════

export interface GalaxyService {
  id: string;
  name: string;
  type: string;
  color: [number, number, number];
  orbitRadius: number;
  orbitTiltX: number;
  orbitTiltY: number;
  orbitSpeed: number;
  orbitPhase: number;
  size: number;
  metrics: { latency: string; load: string; rps: string; errors: string };
  subs: { name: string; status: string; color: string }[];
}

interface GalaxyConnection {
  from: string;
  to: string;
  intensity: number;
}

export function getGalaxyServices(): GalaxyService[] {
  const t = getT();
  return [
    {
      id: "sportzavod",
      name: "SportZavod",
      type: "generator",
      color: [0.98, 0.75, 0.14],
      orbitRadius: 10.0,
      orbitTiltX: 0.6,
      orbitTiltY: 0.3,
      orbitSpeed: 0.2,
      orbitPhase: 0,
      size: 0.38,
      metrics: { latency: "35ms", load: "68%", rps: "120", errors: "0.02%" },
      subs: [
        { name: t("sub_video_gen"), status: "healthy", color: "#34d399" },
        { name: "Google Sheets", status: "healthy", color: "#34d399" },
        { name: t("sub_task_queue"), status: "healthy", color: "#34d399" },
      ],
    },
    {
      id: "contentzavod",
      name: "Content Zavod",
      type: "generator",
      color: [0.75, 0.55, 0.99],
      orbitRadius: 14.0,
      orbitTiltX: -0.8,
      orbitTiltY: 1.2,
      orbitSpeed: 0.16,
      orbitPhase: 2.1,
      size: 0.34,
      metrics: { latency: "42ms", load: "55%", rps: "85", errors: "0.01%" },
      subs: [
        { name: "HeyGen Avatar", status: "healthy", color: "#34d399" },
        { name: t("sub_content_gen"), status: "healthy", color: "#34d399" },
        { name: t("sub_render_queue"), status: "warning", color: "#fbbf24" },
      ],
    },
    {
      id: "agentmusic",
      name: "agentMUSIC",
      type: "generator",
      color: [0.0, 0.78, 0.86],
      orbitRadius: 12.0,
      orbitTiltX: -0.4,
      orbitTiltY: 0.8,
      orbitSpeed: 0.18,
      orbitPhase: 3.5,
      size: 0.34,
      metrics: { latency: "50ms", load: "45%", rps: "30", errors: "0.00%" },
      subs: [
        { name: "Karaoke Renderer", status: "healthy", color: "#34d399" },
        { name: "Streamer Renderer", status: "healthy", color: "#34d399" },
        { name: "Whisper Transcriber", status: "healthy", color: "#34d399" },
      ],
    },
    {
      id: "orchestrator",
      name: "Orchestrator",
      type: "orchestrator",
      color: [0.13, 0.83, 0.93],
      orbitRadius: 18.0,
      orbitTiltX: 0.4,
      orbitTiltY: -0.9,
      orbitSpeed: 0.22,
      orbitPhase: 4.0,
      size: 0.36,
      metrics: { latency: "8ms", load: "42%", rps: "1.2k", errors: "0.00%" },
      subs: [
        { name: t("sub_publishing"), status: "healthy", color: "#34d399" },
        { name: t("sub_scheduler"), status: "healthy", color: "#34d399" },
        { name: "WebSocket Events", status: "healthy", color: "#34d399" },
      ],
    },
    {
      id: "farm",
      name: "Device Fleet",
      type: "farm",
      color: [0.2, 0.83, 0.6],
      orbitRadius: 22.0,
      orbitTiltX: -1.2,
      orbitTiltY: -0.4,
      orbitSpeed: 0.12,
      orbitPhase: 1.3,
      size: 0.42,
      metrics: { latency: "15ms", load: "78%", rps: "340", errors: "0.05%" },
      subs: [
        { name: t("sub_phones"), status: "healthy", color: "#34d399" },
        { name: t("sub_tiktok_accounts"), status: "healthy", color: "#34d399" },
        { name: "ADB Bridge", status: "warning", color: "#fbbf24" },
        { name: "Warmup Engine", status: "healthy", color: "#34d399" },
      ],
    },
    {
      id: "minio",
      name: "MinIO Storage",
      type: "storage",
      color: [0.98, 0.44, 0.52],
      orbitRadius: 27.0,
      orbitTiltX: 1.4,
      orbitTiltY: 0.7,
      orbitSpeed: 0.08,
      orbitPhase: 3.2,
      size: 0.3,
      metrics: { latency: "5ms", load: "35%", rps: "2.4k", errors: "0.00%" },
      subs: [
        { name: t("sub_video_storage"), status: "healthy", color: "#34d399" },
        { name: t("sub_preview_gen"), status: "healthy", color: "#34d399" },
      ],
    },
    {
      id: "dashboard-api",
      name: "Dashboard API",
      type: "api",
      color: [0.38, 0.65, 0.98],
      orbitRadius: 32.0,
      orbitTiltX: -0.5,
      orbitTiltY: 1.8,
      orbitSpeed: 0.06,
      orbitPhase: 5.5,
      size: 0.28,
      metrics: { latency: "12ms", load: "25%", rps: "450", errors: "0.00%" },
      subs: [
        { name: "REST API", status: "healthy", color: "#34d399" },
        { name: "Auth JWT", status: "healthy", color: "#34d399" },
        { name: "WS Gateway", status: "healthy", color: "#34d399" },
      ],
    },
  ];
}

export const GALAXY_SERVICES: GalaxyService[] = getGalaxyServices();

const CONNECTIONS: GalaxyConnection[] = [
  { from: "dashboard-api", to: "orchestrator", intensity: 0.9 },
  { from: "dashboard-api", to: "sportzavod", intensity: 0.8 },
  { from: "dashboard-api", to: "contentzavod", intensity: 0.8 },
  { from: "orchestrator", to: "farm", intensity: 0.95 },
  { from: "orchestrator", to: "minio", intensity: 0.7 },
  { from: "sportzavod", to: "minio", intensity: 0.85 },
  { from: "contentzavod", to: "minio", intensity: 0.85 },
  { from: "farm", to: "minio", intensity: 0.6 },
  { from: "sportzavod", to: "orchestrator", intensity: 0.7 },
  { from: "contentzavod", to: "orchestrator", intensity: 0.7 },
];

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
  bloom: { strength: 1.65, radius: 1.5, threshold: 0.85 },
  fog: { color: 0x0f0f23, near: 20, far: 80 },
  stars: { count: 3000 },
  dust: { count: 800 },
  core: { radius: 3.5, segments: 64, glowScale: 4.5 },
  focusTransitionDuration: 3.8,
};

// ═══════════════════════════════════════════════════════════════════
//  PLANET DATA
// ═══════════════════════════════════════════════════════════════════

interface PlanetObj {
  pivot: THREE.Group;
  wrapper: THREE.Group;
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  orbit: THREE.Mesh;
  hoverRing?: THREE.Mesh;
  data: GalaxyService;
  angle: number;
  hoverAmount: number;
}

interface BeamObj {
  line: THREE.Line;
  geo: THREE.BufferGeometry;
  fromId: string;
  toId: string;
  material: THREE.ShaderMaterial;
}

// ═══════════════════════════════════════════════════════════════════
//  ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════

export class GalaxyEngine {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private fxaaPass!: ShaderPass;
  private pointLight1!: THREE.PointLight;

  private state = {
    time: 0,
    mouse: new THREE.Vector2(0, 0),
    mouseTarget: new THREE.Vector2(0, 0),
    cameraTarget: CONFIG.camera.startPos.clone(),
    cameraLookTarget: new THREE.Vector3(0, 0, 0),
    currentLook: new THREE.Vector3(0, 0, 0),
    targetZoom: CONFIG.camera.startPos.z,
    hoveredService: null as string | null,
    focusedService: null as PlanetObj | null,
    isFocusing: false,
    focusProgress: 0,
    focusFrom: null as THREE.Vector3 | null,
    focusTo: null as THREE.Vector3 | null,
    focusLookFrom: null as THREE.Vector3 | null,
    focusLookTo: null as THREE.Vector3 | null,
    camVelocity: new THREE.Vector3(0, 0, 0),
    lookVelocity: new THREE.Vector3(0, 0, 0),
    alertMode: false,
    dragState: {
      isDragging: false,
      startX: 0,
      startY: 0,
      theta: 0,
      targetTheta: 0,
      phi: 1.4,
      targetPhi: 1.4,
      draggedDistance: 0,
    },
  };

  private demo = {
    active: false,
    phase: "planet" as "planet" | "overview",
    timer: 0,
    focusDuration: 6.0, // seconds on each planet (enough to read panel)
    overviewDuration: 5.0, // seconds on wide shot
    planetsPerCycle: 3, // planets before pulling back to overview
    planetsVisited: 0,
    planetIdx: 0,
    overviewSpeed: 0.09, // slow auto-rotate during overview
    pendingClickId: "" as string, // deferred onClick — fires only when camera arrives
  };

  private planets: PlanetObj[] = [];
  private beams: BeamObj[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();
  private animationId = 0;
  private alertModeValue = 0;
  private alertTarget = 0;

  // Core meshes
  private coreRibbons: THREE.Mesh[] = [];
  private coreRays: THREE.Mesh[] = [];
  private electronCloud!: THREE.Points;
  private electronCloudMat!: THREE.ShaderMaterial;
  private lensFlares: THREE.Mesh[] = [];
  private nebulaPanes: THREE.Mesh[] = [];
  private starsMesh!: THREE.Points;
  private dustMesh!: THREE.Points;

  // Request particles
  private reqParticlePositions!: Float32Array;
  private reqParticlePhases!: Float32Array;
  private reqParticleConnIdx!: Int32Array;
  private reqGeo!: THREE.BufferGeometry;
  private reqMat!: THREE.ShaderMaterial;
  private REQUEST_PARTICLES_COUNT = 200;

  // Labels
  private labelContainer!: HTMLDivElement;
  private labels: { el: HTMLDivElement; planet: PlanetObj }[] = [];

  // Callbacks
  private onHover: (id: string | null) => void;
  private onClick: (id: string) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onHover: (id: string | null) => void,
    onClick: (id: string) => void
  ) {
    this.canvas = canvas;
    this.onHover = onHover;
    this.onClick = onClick;
    this.init();
  }

  private init() {
    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.fog.color);
    this.scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);

    // ── Camera ──
    const parent = this.canvas.parentElement!;
    const w = parent.clientWidth,
      h = parent.clientHeight;
    this.renderer.setSize(w, h, false);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      w / h,
      CONFIG.camera.near,
      CONFIG.camera.far
    );
    this.camera.position.copy(CONFIG.camera.startPos);
    this.camera.lookAt(0, 0, 0);

    // ── Post-processing ──
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      CONFIG.bloom.strength,
      CONFIG.bloom.radius,
      CONFIG.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms.resolution.value.set(
      1 / (w * this.renderer.getPixelRatio()),
      1 / (h * this.renderer.getPixelRatio())
    );
    this.composer.addPass(this.fxaaPass);

    // ── Lighting ──
    this.scene.add(new THREE.AmbientLight(0x1a1a3e, 0.6));
    this.pointLight1 = new THREE.PointLight(0x4488ff, 3, 40);
    this.pointLight1.position.set(0, 0, 0);
    this.scene.add(this.pointLight1);
    const p2 = new THREE.PointLight(0x8844ff, 1.5, 50);
    p2.position.set(10, 5, -10);
    this.scene.add(p2);
    const p3 = new THREE.PointLight(0xffaa22, 0.8, 30);
    p3.position.set(-8, -3, 8);
    this.scene.add(p3);

    // ── Build scene ──
    this.createCore();
    this.createElectronCloud();
    this.createLensFlare();
    this.createNebula();
    getGalaxyServices().forEach((s) => this.createPlanet(s));
    CONNECTIONS.forEach((c) => this.createBeam(c));
    this.createStars();
    this.createDust();
    this.createRequestParticles();
    this.createLabels();

    // ── Events ──
    window.addEventListener("resize", this.handleResize);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: true });
    this.canvas.addEventListener("click", this.handleClick);
    window.addEventListener("keydown", this.handleKeyDown);

    // ── Start ──
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════
  //  CORE NUCLEUS
  // ═══════════════════════════════════════════════════════════════

  private createCore() {
    // 1. (Glass shell removed — no outer contour)

    // 2. Holographic cloud ribbons
    const ribbonGeo = new THREE.SphereGeometry(
      CONFIG.core.radius,
      CONFIG.core.segments,
      CONFIG.core.segments
    );
    const ribbonMat = new THREE.ShaderMaterial({
      vertexShader: coreVertexShader,
      fragmentShader: coreFragmentShader,
      uniforms: { uTime: { value: 0 }, uAlertMode: { value: 0 } },
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const r1 = new THREE.Mesh(ribbonGeo, ribbonMat);
    const r2 = new THREE.Mesh(ribbonGeo, ribbonMat);
    r2.rotation.set(Math.PI / 3, Math.PI / 4, 0);
    r2.scale.set(0.9, 0.95, 0.85);
    const r3 = new THREE.Mesh(ribbonGeo, ribbonMat);
    r3.rotation.set(-Math.PI / 4, Math.PI / 6, Math.PI / 2);
    r3.scale.set(0.85, 0.9, 0.95);
    this.coreRibbons = [r1, r2, r3];
    this.coreRibbons.forEach((r) => this.scene.add(r));

    // 3. Center sphere removed — core glow comes from ribbons + bloom only

    // 4. Subtle light rays emanating from core
    const rayGeo = new THREE.PlaneGeometry(32, 32);
    const rayMatTemplate = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x3388ff) }, uTime: { value: 0 } },
      vertexShader: `
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
      fragmentShader: `
                varying vec2 vUv; uniform vec3 uColor; uniform float uTime;
                void main() {
                    vec2 center = vUv - 0.5;
                    float dist = length(center);
                    float angle = atan(center.y, center.x);
                    
                    float rays = sin(angle * 8.0) * 0.5 + 0.5;
                    rays *= sin(angle * 3.0 + uTime * 0.3) * 0.5 + 0.5;
                    
                    float glow = smoothstep(0.5, 0.05, dist); // Fade at outer edges
                    float hole = smoothstep(0.12, 0.28, dist); // Significantly wider hole so rays emerge OUTSIDE the core, hiding internal lines
                    
                    float alpha = glow * hole * (0.1 + rays * 0.6) * 0.25; // Softer, more ethereal opacity
                    
                    vec3 colorPink = vec3(0.5, 0.1, 0.45);
                    vec3 colorCyan = vec3(0.1, 0.5, 0.7);
                    float mixVal = sin(uTime * 0.4 + angle * 2.0) * 0.5 + 0.5;
                    
                    gl_FragColor = vec4(mix(colorCyan, colorPink, mixVal), alpha);
                }
            `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 6; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMatTemplate.clone());
      ray.rotation.set(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.PI / 6) * i + Math.random() * 0.3
      );
      ray.name = `core-ray-${i}`;
      this.scene.add(ray);
      this.coreRays.push(ray);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ELECTRON CLOUD
  // ═══════════════════════════════════════════════════════════════

  private createElectronCloud() {
    const count = 600;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const shells = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute in spherical shells around the core (quantum orbital feel)
      const shell = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2;
      const baseR = CONFIG.core.radius * (1.5 + shell * 1.2);
      const r = baseR + (Math.random() - 0.5) * baseR * 0.6;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      sizes[i] = 0.3 + Math.random() * 0.8;
      phases[i] = Math.random() * Math.PI * 2;
      shells[i] = shell;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aShell", new THREE.BufferAttribute(shells, 1));

    this.electronCloudMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
                attribute float aSize;
                attribute float aPhase;
                attribute float aShell;
                varying float vAlpha;
                varying float vShell;
                uniform float uTime;

                void main() {
                    vShell = aShell;

                    // Orbital rotation — different speed per shell
                    float speed = 0.15 + aShell * 0.08;
                    float angle = uTime * speed + aPhase;

                    // Rotate around Y axis
                    float cosA = cos(angle);
                    float sinA = sin(angle);
                    vec3 pos = position;
                    vec3 rotated = vec3(
                        pos.x * cosA - pos.z * sinA,
                        pos.y,
                        pos.x * sinA + pos.z * cosA
                    );

                    // Gentle breathing
                    float breath = 1.0 + sin(uTime * 0.8 + aPhase) * 0.08;
                    rotated *= breath;

                    vec4 mvPos = modelViewMatrix * vec4(rotated, 1.0);
                    gl_Position = projectionMatrix * mvPos;

                    // Size attenuation
                    gl_PointSize = aSize * (250.0 / -mvPos.z);

                    // Pulsing alpha
                    vAlpha = 0.15 + 0.2 * sin(uTime * 1.5 + aPhase * 3.0);
                }
            `,
      fragmentShader: /* glsl */ `
                varying float vAlpha;
                varying float vShell;

                void main() {
                    float d = length(gl_PointCoord - vec2(0.5));
                    if (d > 0.5) discard;

                    float glow = smoothstep(0.5, 0.0, d);
                    glow = pow(glow, 2.0);

                    // Color shifts per shell
                    vec3 col0 = vec3(0.2, 0.6, 1.0);  // inner — blue
                    vec3 col1 = vec3(0.5, 0.2, 0.9);  // mid — purple
                    vec3 col2 = vec3(0.1, 0.8, 0.7);  // outer — teal

                    vec3 color = vShell < 0.5 ? col0 : vShell < 1.5 ? col1 : col2;

                    gl_FragColor = vec4(color, glow * vAlpha);
                }
            `,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.electronCloud = new THREE.Points(geo, this.electronCloudMat);
    this.scene.add(this.electronCloud);
  }

  // ═══════════════════════════════════════════════════════════════
  //  LENS FLARE
  // ═══════════════════════════════════════════════════════════════

  private createLensFlare() {
    const flareShader = {
      vertexShader: /* glsl */ `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
      fragmentShader: /* glsl */ `
                varying vec2 vUv;
                uniform float uTime;
                uniform vec3 uColor;
                uniform float uIntensity;

                void main() {
                    vec2 center = vUv - 0.5;
                    float d = length(center);

                    // Soft radial glow
                    float glow = smoothstep(0.5, 0.0, d);
                    glow = pow(glow, 3.0);

                    // Anamorphic horizontal streak
                    float streak = exp(-abs(center.y) * 15.0) * exp(-abs(center.x) * 3.0);

                    // Chromatic ring
                    float ring = smoothstep(0.28, 0.30, d) * smoothstep(0.35, 0.30, d);

                    float pulse = 0.8 + 0.2 * sin(uTime * 1.5);
                    float alpha = (glow * 0.6 + streak * 0.3 + ring * 0.15) * uIntensity * pulse;

                    vec3 color = uColor + vec3(streak * 0.3, streak * 0.1, 0.0);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
    };

    // Main central flare
    const flareGeo = new THREE.PlaneGeometry(12, 12);
    const flareMat = new THREE.ShaderMaterial({
      ...flareShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0.3, 0.5, 1.0) },
        uIntensity: { value: 0.35 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const flare1 = new THREE.Mesh(flareGeo, flareMat);
    flare1.renderOrder = 100;
    this.scene.add(flare1);
    this.lensFlares.push(flare1);

    // Smaller secondary flare (rotated)
    const flareGeo2 = new THREE.PlaneGeometry(8, 8);
    const flareMat2 = flareMat.clone();
    flareMat2.uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0.6, 0.2, 0.8) },
      uIntensity: { value: 0.2 },
    };
    const flare2 = new THREE.Mesh(flareGeo2, flareMat2);
    flare2.rotation.z = Math.PI / 4;
    flare2.renderOrder = 100;
    this.scene.add(flare2);
    this.lensFlares.push(flare2);
  }

  // ═══════════════════════════════════════════════════════════════
  //  NEBULA (volumetric cloud panes around core)
  // ═══════════════════════════════════════════════════════════════

  private createNebula() {
    const paneCount = 5;
    for (let i = 0; i < paneCount; i++) {
      const size = 8 + Math.random() * 10;
      const geo = new THREE.PlaneGeometry(size, size);
      const mat = new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
        fragmentShader: /* glsl */ `
                    varying vec2 vUv;
                    uniform float uTime;
                    uniform vec3 uColor;
                    uniform float uSeed;

                    // Simple noise
                    float hash(vec2 p) {
                        return fract(sin(dot(p, vec2(127.1 + uSeed, 311.7 + uSeed))) * 43758.5453);
                    }
                    float noise2d(vec2 p) {
                        vec2 i = floor(p);
                        vec2 f = fract(p);
                        f = f * f * (3.0 - 2.0 * f);
                        float a = hash(i);
                        float b = hash(i + vec2(1.0, 0.0));
                        float c = hash(i + vec2(0.0, 1.0));
                        float d = hash(i + vec2(1.0, 1.0));
                        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                    }
                    float fbm2(vec2 p) {
                        float v = 0.0;
                        float a = 0.5;
                        for (int i = 0; i < 4; i++) {
                            v += a * noise2d(p);
                            p *= 2.0;
                            a *= 0.5;
                        }
                        return v;
                    }

                    void main() {
                        vec2 center = vUv - 0.5;
                        float dist = length(center);

                        // Radial fade
                        float mask = smoothstep(0.5, 0.15, dist);

                        // Animated cloud noise
                        vec2 noiseCoord = center * 3.0 + uTime * 0.05;
                        float n = fbm2(noiseCoord);
                        float n2 = fbm2(noiseCoord * 1.5 + vec2(5.0, 3.0) - uTime * 0.03);

                        float cloud = n * 0.6 + n2 * 0.4;
                        cloud = smoothstep(0.25, 0.7, cloud);

                        float alpha = mask * cloud * 0.12;

                        gl_FragColor = vec4(uColor * (1.0 + cloud * 0.3), alpha);
                    }
                `,
        uniforms: {
          uTime: { value: 0 },
          uColor: {
            value: new THREE.Color(
              0.15 + Math.random() * 0.2,
              0.1 + Math.random() * 0.15,
              0.4 + Math.random() * 0.3
            ),
          },
          uSeed: { value: i * 17.3 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      const pane = new THREE.Mesh(geo, mat);
      // Random orientation around core
      pane.rotation.set(
        (Math.random() - 0.5) * Math.PI * 0.8,
        (Math.random() - 0.5) * Math.PI * 0.8,
        Math.random() * Math.PI
      );
      pane.position.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
      );
      this.scene.add(pane);
      this.nebulaPanes.push(pane);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ORBITS
  // ═══════════════════════════════════════════════════════════════

  private createOrbit(radius: number, color: [number, number, number], planetSize: number) {
    const geo = new THREE.TorusGeometry(radius, 0.018, 16, 256);
    const mat = new THREE.ShaderMaterial({
      vertexShader: orbitVertexShader,
      fragmentShader: orbitFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
        uTime: { value: 0 },
        uAlertMode: { value: 0 },
        uPlanetPos: { value: new THREE.Vector3() },
        uPlanetRadius: { value: planetSize },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const orbitMesh = new THREE.Mesh(geo, mat);
    orbitMesh.rotation.x = Math.PI / 2;
    orbitMesh.renderOrder = 0;
    return orbitMesh;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PLANETS (SERVICES)
  // ═══════════════════════════════════════════════════════════════

  private createPlanet(serviceData: GalaxyService) {
    const { color, size, orbitRadius, orbitTiltX, orbitTiltY, orbitPhase } = serviceData;
    const colorVec = new THREE.Vector3(color[0], color[1], color[2]);

    // Group handles compound orbit tilt
    const pivotGroup = new THREE.Group();
    pivotGroup.rotation.x = orbitTiltX || 0;
    pivotGroup.rotation.y = orbitTiltY || 0;
    this.scene.add(pivotGroup);

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
      transparent: true,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { serviceId: serviceData.id };
    mesh.renderOrder = 2;
    planetWrapper.add(mesh);

    // Glow
    const glowGeo = new THREE.SphereGeometry(size * 1.8, 24, 24);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: planetGlowVertexShader,
      fragmentShader: planetGlowFragmentShader,
      uniforms: { uColor: { value: colorVec }, uHover: { value: 0 } },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    planetWrapper.add(glow);

    // Orbit ring
    const orbit = this.createOrbit(orbitRadius, color, size);
    pivotGroup.add(orbit);

    const planetObj: PlanetObj = {
      pivot: pivotGroup,
      wrapper: planetWrapper,
      mesh,
      glow,
      orbit,
      data: serviceData,
      angle: orbitPhase,
      hoverAmount: 0,
    };
    this.planets.push(planetObj);
    return planetObj;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ENERGY BEAMS
  // ═══════════════════════════════════════════════════════════════

  private createBeam(conn: GalaxyConnection) {
    const segments = 40;
    const positions = new Float32Array(segments * 3);
    const alphas = new Float32Array(segments);
    const progress = new Float32Array(segments);
    for (let i = 0; i < segments; i++) {
      const p = i / (segments - 1);
      alphas[i] = Math.sin(p * Math.PI);
      progress[i] = p;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute("aProgress", new THREE.BufferAttribute(progress, 1));

    const fromP = this.planets.find((p) => p.data.id === conn.from);
    const toP = this.planets.find((p) => p.data.id === conn.to);
    if (!fromP || !toP) return;

    const mixedColor = new THREE.Color(
      (fromP.data.color[0] + toP.data.color[0]) * 0.5,
      (fromP.data.color[1] + toP.data.color[1]) * 0.5,
      (fromP.data.color[2] + toP.data.color[2]) * 0.5
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
    this.scene.add(line);
    this.beams.push({ line, geo, fromId: conn.from, toId: conn.to, material: mat });
  }

  // ═══════════════════════════════════════════════════════════════
  //  STARS
  // ═══════════════════════════════════════════════════════════════

  private createStars() {
    const count = CONFIG.stars.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);

    for (let i = 0; i < count; i++) {
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
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.starsMesh = new THREE.Points(geo, mat);
    this.starsMesh.name = "stars";
    this.scene.add(this.starsMesh);
  }

  // ═══════════════════════════════════════════════════════════════
  //  DUST PARTICLES
  // ═══════════════════════════════════════════════════════════════

  private createDust() {
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
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: dustVertexShader,
      fragmentShader: dustFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dustMesh = new THREE.Points(geo, mat);
    this.dustMesh.name = "dust";
    this.scene.add(this.dustMesh);
  }

  // ═══════════════════════════════════════════════════════════════
  //  REQUEST PARTICLES
  // ═══════════════════════════════════════════════════════════════

  private createRequestParticles() {
    const N = this.REQUEST_PARTICLES_COUNT;
    this.reqParticlePositions = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    this.reqParticlePhases = new Float32Array(N);
    this.reqParticleConnIdx = new Int32Array(N);

    for (let i = 0; i < N; i++) {
      this.reqParticlePhases[i] = Math.random();
      sizes[i] = 0.4 + Math.random() * 0.8;
      this.reqParticleConnIdx[i] = Math.floor(Math.random() * CONNECTIONS.length);
    }

    this.reqGeo = new THREE.BufferGeometry();
    this.reqGeo.setAttribute("position", new THREE.BufferAttribute(this.reqParticlePositions, 3));
    this.reqGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.reqGeo.setAttribute("aPhase", new THREE.BufferAttribute(this.reqParticlePhases, 1));

    this.reqMat = new THREE.ShaderMaterial({
      vertexShader: dustVertexShader,
      fragmentShader: dustFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const reqParticles = new THREE.Points(this.reqGeo, this.reqMat);
    reqParticles.name = "request-particles";
    this.scene.add(reqParticles);
  }

  // ═══════════════════════════════════════════════════════════════
  //  HTML LABELS
  // ═══════════════════════════════════════════════════════════════

  private createLabels() {
    this.labelContainer = document.createElement("div");
    this.labelContainer.id = "galaxy-label-container";
    this.labelContainer.style.cssText =
      "position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden;";
    document.body.appendChild(this.labelContainer);

    this.planets.forEach((p) => {
      const label = document.createElement("div");
      label.className = "service-label";
      label.textContent = p.data.name;
      label.style.cssText = `
                position:absolute;
                font-family:'JetBrains Mono',monospace;
                font-size:10px;
                letter-spacing:1px;
                color:rgba(226,232,240,0.7);
                text-transform:uppercase;
                white-space:nowrap;
                transform:translate(-50%,8px);
                text-shadow:0 0 8px rgba(15,15,35,0.9);
                transition:opacity 0.3s ease, color 0.3s ease;
            `;
      this.labelContainer.appendChild(label);
      this.labels.push({ el: label, planet: p });
    });
  }

  private updateLabels() {
    const halfW = (this.canvas.parentElement?.clientWidth ?? 0) / 2;
    const halfH = (this.canvas.parentElement?.clientHeight ?? 0) / 2;
    const vec = new THREE.Vector3();

    this.labels.forEach(({ el, planet }) => {
      planet.mesh.getWorldPosition(vec);
      vec.project(this.camera);

      if (vec.z > 1) {
        el.style.opacity = "0";
        return;
      }

      const x = vec.x * halfW + halfW;
      const y = -(vec.y * halfH) + halfH;

      el.style.left = `${x}px`;
      el.style.top = `${y + 12}px`;

      el.style.opacity =
        this.state.focusedService && this.state.focusedService !== planet ? "0.15" : "0.8";
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  FOCUS CAMERA
  // ═══════════════════════════════════════════════════════════════

  private focusSettleTimer = 0;

  private focusOnService(planetObj: PlanetObj) {
    // Spring-damper approach: just redirect the target, velocity carries over
    this.state.focusedService = planetObj;
    this.state.isFocusing = true;
    this.focusSettleTimer = 0;
  }

  private unfocusService() {
    if (!this.state.focusedService) return;

    this.state.isFocusing = true;
    this.state.focusProgress = 0;
    this.state.focusFrom = this.camera.position.clone();
    this.state.focusTo = CONFIG.camera.startPos.clone();
    this.state.focusTo.z = this.state.targetZoom;
    this.state.focusLookFrom = this.state.currentLook.clone();
    this.state.focusLookTo = new THREE.Vector3(0, 0, 0);
    this.state.focusedService = null;
  }

  // ═══════════════════════════════════════════════════════════════
  //  EASING
  // ═══════════════════════════════════════════════════════════════

  private easeInOutCubic(t: number) {
    // Quintic (5th power) — very smooth slow start and slow end, cinematic feel
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - (-2 * t + 2) ** 5 / 2;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    this.state.time += delta;
    const t = this.state.time;

    // Alert mode smooth transition
    this.alertModeValue = THREE.MathUtils.lerp(this.alertModeValue, this.alertTarget, delta * 3);

    // ── Demo / Presentation mode ──
    // ── Demo / Presentation mode ──
    if (this.demo.active && this.planets.length > 0) {
      if (this.demo.phase === "planet") {
        // Count time only when settled on planet (not mid-flight)
        if (!this.state.isFocusing) {
          this.demo.timer += delta;
        }

        if (!this.state.isFocusing && this.demo.timer >= this.demo.focusDuration) {
          this.demo.timer = 0;
          this.demo.planetsVisited++;

          // Close panel first, then fly after a brief delay
          this.onClick("");

          if (this.demo.planetsVisited >= this.demo.planetsPerCycle) {
            // Pull back to overview — wait for panel exit animation
            this.demo.phase = "overview";
            this.demo.planetsVisited = 0;
            setTimeout(() => {
              if (!this.demo.active) return;
              this.unfocusService();
              this.state.targetZoom = 58;
            }, 600);
          } else {
            // Next planet — wait for panel exit, then fly
            setTimeout(() => {
              if (!this.demo.active) return;
              this.demo.planetIdx = (this.demo.planetIdx + 1) % this.planets.length;
              const planet = this.planets[this.demo.planetIdx];
              this.focusOnService(planet);
              // Don't open panel yet — pendingClickId fires when camera arrives
              this.demo.pendingClickId = planet.data.id;
            }, 600);
          }
        }
      } else if (this.demo.phase === "overview") {
        // Only active when fully returned (no focus, no transition)
        if (!this.state.isFocusing && !this.state.focusedService) {
          this.demo.timer += delta;
          // Slow cinematic rotation
          this.state.dragState.targetTheta += delta * this.demo.overviewSpeed;
          this.state.targetZoom = THREE.MathUtils.lerp(this.state.targetZoom, 58, delta * 0.4);
          this.state.dragState.targetPhi = THREE.MathUtils.lerp(
            this.state.dragState.targetPhi,
            1.28,
            delta * 0.3
          );
        }

        if (
          !this.state.isFocusing &&
          !this.state.focusedService &&
          this.demo.timer >= this.demo.overviewDuration
        ) {
          this.demo.timer = 0;
          this.demo.phase = "planet";
          this.demo.planetIdx = (this.demo.planetIdx + 1) % this.planets.length;
          const planet = this.planets[this.demo.planetIdx];
          this.focusOnService(planet);
          // Panel opens only when camera arrives
          this.demo.pendingClickId = planet.data.id;
        }
      }
    }

    // ── Slow idle auto-rotation ──
    if (
      !this.state.isFocusing &&
      !this.state.focusedService &&
      !this.state.dragState.isDragging &&
      !this.demo.active
    ) {
      this.state.dragState.targetTheta += delta * 0.04;
    }

    // ── Mouse smoothing ──
    this.state.mouse.lerp(this.state.mouseTarget, CONFIG.camera.smoothFactor);

    // ── Camera parallax & Drag Rotation ──
    if (!this.state.isFocusing && !this.state.focusedService) {
      // Smoothly interpolate drag rotation targets
      this.state.dragState.theta = THREE.MathUtils.lerp(
        this.state.dragState.theta,
        this.state.dragState.targetTheta,
        delta * 8
      );
      this.state.dragState.phi = THREE.MathUtils.lerp(
        this.state.dragState.phi,
        this.state.dragState.targetPhi,
        delta * 8
      );

      const r = this.state.targetZoom;
      const tTheta = this.state.dragState.theta;
      const tPhi = this.state.dragState.phi;

      // Spherical to Cartesian (note: Three.js Y is up)
      const camX = r * Math.sin(tPhi) * Math.sin(tTheta);
      const camY = r * Math.cos(tPhi);
      const camZ = r * Math.sin(tPhi) * Math.cos(tTheta);

      const parallax = CONFIG.camera.parallaxIntensity;

      // Add slight mouse parallax on top of the spherical position
      this.state.cameraTarget.x = camX + this.state.mouse.x * parallax * Math.cos(tTheta);
      this.state.cameraTarget.y = camY + this.state.mouse.y * parallax * 0.5;
      this.state.cameraTarget.z = camZ - this.state.mouse.x * parallax * Math.sin(tTheta);

      // Gentle floating
      this.state.cameraTarget.x += Math.sin(t * 0.2) * 0.3;
      this.state.cameraTarget.y += Math.cos(t * 0.15) * 0.2;

      this.camera.position.lerp(this.state.cameraTarget, CONFIG.camera.smoothFactor);
      this.state.currentLook.lerp(new THREE.Vector3(0, 0, 0), CONFIG.camera.smoothFactor);
      this.camera.lookAt(this.state.currentLook);
    }

    // ── Unfocus return transition (back to overview, no focusedService) ──
    if (this.state.isFocusing && !this.state.focusedService) {
      this.state.focusProgress += delta / CONFIG.focusTransitionDuration;
      if (this.state.focusProgress >= 1) {
        this.state.focusProgress = 1;
        this.state.isFocusing = false;
        // Zero velocity so spherical orbit starts clean
        this.state.camVelocity.set(0, 0, 0);
        this.state.lookVelocity.set(0, 0, 0);
      }
      const ease = this.easeInOutCubic(this.state.focusProgress);
      this.camera.position.lerpVectors(this.state.focusFrom!, this.state.focusTo!, ease);
      this.state.currentLook.lerpVectors(this.state.focusLookFrom!, this.state.focusLookTo!, ease);
      this.camera.lookAt(this.state.currentLook);
    }

    // ── Planet spring-damper (approach + tracking unified, no velocity discontinuity) ──
    // Spring constants: K=1.5 (stiffness), dam=2.2 → ζ≈0.9, settling ~3.6s
    if (this.state.focusedService) {
      const pPos = new THREE.Vector3();
      this.state.focusedService.mesh.getWorldPosition(pPos);
      const pDir = pPos.clone().normalize();
      const camTarget = pPos
        .clone()
        .add(pDir.multiplyScalar(5))
        .add(new THREE.Vector3(0, 2.5, 0));

      const K = 1.5,
        dam = 2.2;
      // Position spring
      const pErr = camTarget.clone().sub(this.camera.position);
      const pAccel = pErr.multiplyScalar(K).addScaledVector(this.state.camVelocity, -dam);
      this.state.camVelocity.addScaledVector(pAccel, delta);
      this.camera.position.addScaledVector(this.state.camVelocity, delta);

      // Look spring (stiffer so it leads slightly)
      const lErr = pPos.clone().sub(this.state.currentLook);
      const lAccel = lErr
        .multiplyScalar(K * 2.5)
        .addScaledVector(this.state.lookVelocity, -(dam * 1.8));
      this.state.lookVelocity.addScaledVector(lAccel, delta);
      this.state.currentLook.addScaledVector(this.state.lookVelocity, delta);
      this.camera.lookAt(this.state.currentLook);

      // Settle detection — clears isFocusing flag used by demo timer & panel
      if (this.state.isFocusing) {
        this.focusSettleTimer += delta;
        const dist = this.camera.position.distanceTo(camTarget);
        const speed = this.state.camVelocity.length();
        if ((dist < 2.0 && speed < 0.8) || this.focusSettleTimer > 4.5) {
          this.state.isFocusing = false;
          // Fire deferred panel open — camera has arrived
          if (this.demo.pendingClickId) {
            this.onClick(this.demo.pendingClickId);
            this.demo.pendingClickId = "";
          }
        }
      }
    }

    // ── Core animation ──
    const coreScale = 1 + Math.sin(t * 2.0) * 0.05;

    this.coreRibbons[0].scale.setScalar(coreScale);
    this.coreRibbons[1].scale
      .copy(this.coreRibbons[0].scale)
      .multiply(new THREE.Vector3(0.9, 0.95, 0.85));
    this.coreRibbons[2].scale
      .copy(this.coreRibbons[0].scale)
      .multiply(new THREE.Vector3(0.85, 0.9, 0.95));

    this.coreRibbons.forEach((r) => {
      (r.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (r.material as THREE.ShaderMaterial).uniforms.uAlertMode.value = this.alertModeValue;
    });

    // coreGlass removed

    this.coreRays.forEach((ray) => {
      (ray.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      ray.rotation.x += delta * 0.1;
      ray.rotation.y += delta * 0.15;
    });

    // Electron cloud
    this.electronCloudMat.uniforms.uTime.value = t;

    // Nebula panes — slow rotation + face camera blend
    this.nebulaPanes.forEach((pane, i) => {
      (pane.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      pane.rotation.z += delta * 0.02 * (i % 2 === 0 ? 1 : -1);
      pane.rotation.y += delta * 0.01;
    });

    // Lens flares — always face camera
    this.lensFlares.forEach((f) => {
      f.lookAt(this.camera.position);
      (f.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    });

    // Core light pulse — stronger breathing
    const coreBreathe = Math.sin(t * 1.5) * 0.4 + Math.sin(t * 3.7) * 0.15;
    this.pointLight1.intensity = 3.5 + coreBreathe * 2;

    // ── Planet animation ──
    this.planets.forEach((p) => {
      p.angle += p.data.orbitSpeed * delta;

      // Orbit breathing (pulse)
      const breathe = 1 + Math.sin(t * 0.5 + p.data.orbitPhase) * 0.02;
      p.orbit.scale.set(breathe, breathe, 1);

      // Make sure planet position respects the same breathing scale so it doesn't drift
      const r = p.data.orbitRadius * breathe;
      p.wrapper.position.set(Math.cos(p.angle) * r, 0, Math.sin(p.angle) * r);
      p.wrapper.quaternion.copy(p.pivot.quaternion).invert();

      // Shader uniforms
      (p.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (p.mesh.material as THREE.ShaderMaterial).uniforms.uAlertMode.value = this.alertModeValue;

      // Hover animation
      const isHovered = this.state.hoveredService === p.data.id;
      const hoverTarget = isHovered ? 1 : 0;
      p.hoverAmount = THREE.MathUtils.lerp(p.hoverAmount, hoverTarget, delta * 5);
      (p.mesh.material as THREE.ShaderMaterial).uniforms.uHover.value = p.hoverAmount;
      (p.glow.material as THREE.ShaderMaterial).uniforms.uHover.value = p.hoverAmount;

      const hoverScale = 1 + p.hoverAmount * 0.3;
      p.mesh.scale.setScalar(hoverScale);
      p.glow.scale.setScalar(hoverScale);

      // Orbit shader
      const orbitUniforms = (p.orbit.material as THREE.ShaderMaterial).uniforms;
      orbitUniforms.uTime.value = t;
      orbitUniforms.uAlertMode.value = this.alertModeValue;
      const pWorldPos = new THREE.Vector3();
      p.mesh.getWorldPosition(pWorldPos);
      orbitUniforms.uPlanetPos.value.copy(pWorldPos);
    });

    // ── Energy beams ──
    const vecFrom = new THREE.Vector3();
    const vecTo = new THREE.Vector3();

    this.beams.forEach((beam) => {
      const fromPlanet = this.planets.find((p) => p.data.id === beam.fromId);
      const toPlanet = this.planets.find((p) => p.data.id === beam.toId);
      if (!fromPlanet || !toPlanet) return;

      fromPlanet.mesh.getWorldPosition(vecFrom);
      toPlanet.mesh.getWorldPosition(vecTo);

      const positions = beam.geo.attributes.position.array as Float32Array;
      const segments = positions.length / 3;

      const mid = new THREE.Vector3().addVectors(vecFrom, vecTo).multiplyScalar(0.5);
      const normal = new THREE.Vector3()
        .crossVectors(
          new THREE.Vector3().subVectors(vecTo, vecFrom).normalize(),
          new THREE.Vector3(0, 1, 0)
        )
        .multiplyScalar(vecFrom.distanceTo(vecTo) * 0.15);
      mid.add(normal);

      for (let i = 0; i < segments; i++) {
        const frac = i / (segments - 1);
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
    for (let i = 0; i < this.REQUEST_PARTICLES_COUNT; i++) {
      const connIdx = this.reqParticleConnIdx[i];
      const conn = CONNECTIONS[connIdx];
      const fromP = this.planets.find((p) => p.data.id === conn.from);
      const toP = this.planets.find((p) => p.data.id === conn.to);
      if (!fromP || !toP) continue;

      const phase = (this.reqParticlePhases[i] + t * 0.3 * conn.intensity) % 1;

      fromP.mesh.getWorldPosition(vecFrom);
      toP.mesh.getWorldPosition(vecTo);

      this.reqParticlePositions[i * 3] =
        THREE.MathUtils.lerp(vecFrom.x, vecTo.x, phase) + Math.sin(phase * 10 + t) * 0.1;
      this.reqParticlePositions[i * 3 + 1] =
        THREE.MathUtils.lerp(vecFrom.y, vecTo.y, phase) + Math.cos(phase * 8 + t) * 0.08;
      this.reqParticlePositions[i * 3 + 2] =
        THREE.MathUtils.lerp(vecFrom.z, vecTo.z, phase) + Math.sin(phase * 12 + t * 0.5) * 0.1;
    }
    this.reqGeo.attributes.position.needsUpdate = true;
    this.reqMat.uniforms.uTime.value = t;

    // ── Stars & Dust ──
    (this.starsMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.starsMesh.rotation.y += delta * 0.003;
    (this.dustMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    // ── Raycasting for hover ──
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const planetMeshes = this.planets.map((p) => p.mesh);
    const intersects = this.raycaster.intersectObjects(planetMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const sid = hit.userData.serviceId;
      if (this.state.hoveredService !== sid) {
        this.state.hoveredService = sid;
        this.canvas.style.cursor = "pointer";
        this.onHover(sid);
      }
    } else {
      if (this.state.hoveredService !== null) {
        this.state.hoveredService = null;
        this.canvas.style.cursor = "default";
        this.onHover(null);
      }
    }

    // ── Update labels ──
    this.updateLabels();

    // ── Dynamic Bloom ──
    const distToCenter = this.camera.position.length();
    const bloomFactor = THREE.MathUtils.clamp((distToCenter - 12) / 25, 0.05, 1.0);
    this.bloomPass.strength = CONFIG.bloom.strength * bloomFactor;

    // ── Render ──
    this.composer.render();
  };

  // ═══════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button === 0 || e.button === 1) {
      this.state.dragState.isDragging = true;
      this.state.dragState.startX = e.clientX;
      this.state.dragState.startY = e.clientY;
      this.state.dragState.draggedDistance = 0;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "grabbing";
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.state.mouseTarget.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.state.mouseTarget.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.x = this.state.mouseTarget.x;
    this.pointer.y = this.state.mouseTarget.y;

    if (this.state.dragState.isDragging && !this.state.focusedService) {
      const dx = e.clientX - this.state.dragState.startX;
      const dy = e.clientY - this.state.dragState.startY;

      this.state.dragState.draggedDistance += Math.abs(dx) + Math.abs(dy);

      this.state.dragState.targetTheta -= dx * 0.005;
      this.state.dragState.targetPhi -= dy * 0.005;

      // Clamp phi to avoid camera flipping over the poles
      this.state.dragState.targetPhi = THREE.MathUtils.clamp(
        this.state.dragState.targetPhi,
        0.1,
        Math.PI - 0.1
      );

      this.state.dragState.startX = e.clientX;
      this.state.dragState.startY = e.clientY;
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.state.dragState.isDragging) {
      this.state.dragState.isDragging = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (_err) {}
      this.canvas.style.cursor = this.state.hoveredService ? "pointer" : "default";
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.state.focusedService) return;
    this.state.targetZoom += e.deltaY * 0.01 * CONFIG.camera.zoomSpeed;
    this.state.targetZoom = THREE.MathUtils.clamp(
      this.state.targetZoom,
      CONFIG.camera.minZoom,
      CONFIG.camera.maxZoom
    );
  };

  private handleClick = () => {
    if (this.state.dragState.draggedDistance > 10) return;

    if (this.state.hoveredService) {
      const planet = this.planets.find((p) => p.data.id === this.state.hoveredService);
      if (planet) {
        if (this.state.focusedService === planet) {
          this.unfocusService();
        } else {
          if (this.state.focusedService) this.unfocusService();
          setTimeout(() => this.focusOnService(planet), this.state.focusedService ? 400 : 0);
        }
        this.onClick(planet.data.id);
      }
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.unfocusService();
  };

  private handleResize = () => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth,
      h = parent.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.fxaaPass.uniforms.resolution.value.set(
      1 / (w * this.renderer.getPixelRatio()),
      1 / (h * this.renderer.getPixelRatio())
    );
  };

  // ═══════════════════════════════════════════════════════════════
  //  DEMO / PRESENTATION MODE
  // ═══════════════════════════════════════════════════════════════

  public startDemo() {
    if (this.demo.active) return;
    this.demo.active = true;
    this.demo.phase = "planet";
    this.demo.timer = 0;
    this.demo.planetIdx = 0;
    this.demo.planetsVisited = 0;
    // Immediately fly to first planet
    if (this.planets.length > 0) {
      const planet = this.planets[0];
      this.focusOnService(planet);
      this.onClick(planet.data.id);
    }
  }

  public stopDemo() {
    if (!this.demo.active) return;
    this.demo.active = false;
    this.demo.phase = "planet";
    this.demo.planetsVisited = 0;
    this.unfocusService();
    this.onClick("");
  }

  public get isDemoActive() {
    return this.demo.active;
  }

  /** Update planet appearance based on live service status */
  public updateServiceStatus(
    serviceId: string,
    status: "online" | "degraded" | "offline" | "error"
  ) {
    const planet = this.planets.find((p) => p.data.id === serviceId);
    if (!planet) return;

    const statusColors: Record<string, [number, number, number]> = {
      online: [0.1, 0.75, 0.4],
      degraded: [0.9, 0.7, 0.1],
      offline: [0.4, 0.4, 0.5],
      error: [0.9, 0.15, 0.15],
    };
    const col = statusColors[status] ?? planet.data.color;
    const colorVec = new THREE.Vector3(col[0], col[1], col[2]);

    (planet.mesh.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(colorVec);
    (planet.glow.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(colorVec);
    // Error mode — pulsing alert
    const alertTarget = status === "error" ? 1 : 0;
    (planet.mesh.material as THREE.ShaderMaterial).uniforms.uAlertMode.value = alertTarget;
  }

  /** True when the camera has arrived at the planet and is no longer in transit */
  public get isCameraSettled(): boolean {
    return !!this.state.focusedService && !this.state.isFocusing;
  }

  /** Returns screen-space position {x, y} of the focused planet, or null */
  public getFocusedScreenPos(): { x: number; y: number } | null {
    if (!this.state.focusedService) return null;
    const vec = new THREE.Vector3();
    this.state.focusedService.mesh.getWorldPosition(vec);
    vec.project(this.camera);
    if (vec.z > 1) return null;
    const parent = this.canvas.parentElement!;
    const halfW = parent.clientWidth / 2;
    const halfH = parent.clientHeight / 2;
    return {
      x: vec.x * halfW + halfW,
      y: -(vec.y * halfH) + halfH,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  DISPOSE
  // ═══════════════════════════════════════════════════════════════

  public dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.labelContainer?.remove();
    this.renderer.dispose();
  }
}
