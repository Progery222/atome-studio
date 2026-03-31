/**
 * Custom GLSL Shaders for Atome Galaxy
 * Core nucleus, planets, orbits, energy beams, particles
 */

// ── CORE NUCLEUS SHADER ────────────────────────────────────────────
export const coreVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;
    uniform float uTime;

    // Simplex-like noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal); // View space normal
        
        // Smooth, elegant liquid layers (low frequency for Siri blob)
        float n1 = snoise(position * 0.6 + uTime * 0.8);
        float n2 = snoise(position * 1.2 - uTime * 1.5);
        float noiseVal = n1 * 0.7 + n2 * 0.3;
        
        vDisplacement = noiseVal;
        
        // Deep liquid displaced folds (gentle frequency but high amplitude for ribbons)
        vec3 displaced = position + normal * noiseVal * 0.45;
        float pulse = 1.0 + sin(uTime * 2.0) * 0.05;
        displaced *= pulse;
        
        vec4 viewPos = modelViewMatrix * vec4(displaced, 1.0);
        vPosition = viewPos.xyz; // View space position
        gl_Position = projectionMatrix * viewPos;
    }
`;

export const coreFragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;
    uniform float uTime;
    uniform float uAlertMode;

    void main() {
        // High-end Siri look relies on contrast, translucency, and striking rim/interior details
        vec3 viewDir = normalize(-vPosition); // vPosition is in view space!
        float ndotv = max(dot(viewDir, vNormal), 0.0);
        
        // Soft edge masking
        float edgeFade = smoothstep(0.0, 0.5, ndotv);
        
        // Powerful rim lighting (Fresnel) for that crisp sci-fi edge
        float fresnel = pow(1.0 - ndotv, 2.5);
        
        // Map rich colors across the ribbons
        // We use the Siri color palette from the reference: Neon Cyan, Magenta/Pink, and Bright Green!
        vec3 colorCyan = vec3(0.0, 0.8, 1.0);
        vec3 colorPink = vec3(1.0, 0.1, 0.6);
        vec3 colorGreen = vec3(0.2, 1.0, 0.6);
        vec3 colorPurple = vec3(0.4, 0.1, 0.9);
        
        // Topographical mask to create distinct "floating petals" from a single surface!
        float petalMask = smoothstep(0.1, 0.9, sin(vDisplacement * 12.0 - uTime * 3.0) * 0.5 + 0.5);
        petalMask = pow(petalMask, 2.0); // Sharpen the ribbon edges
        
        // Mix colors dynamically based on surface height and time
        float t1 = smoothstep(-0.4, 0.5, vDisplacement);
        float t2 = sin(vPosition.y * 2.0 + uTime)*0.5+0.5;
        
        vec3 ribbonColor = mix(colorCyan, colorPurple, t1);
        ribbonColor = mix(ribbonColor, colorPink, t2);
        
        // Add sweeping bright green/cyan highlights (as seen in the reference)
        float sweep = sin(vPosition.x * 4.0 + uTime * 2.5 + vDisplacement * 4.0) * 0.5 + 0.5;
        vec3 highlight = mix(colorCyan, colorGreen, sweep);
        // Boosted ribbon highlight significantly to penetrate the dark glass
        ribbonColor += highlight * pow(sweep, 3.0) * 2.5; 
        
        // Edge lighting for the ribbons
        vec3 rimEdge = mix(vec3(0.0, 0.4, 0.6), vec3(0.5, 0.0, 0.5), sin(uTime) * 0.5 + 0.5) * fresnel;

        vec3 finalColor = ribbonColor * petalMask * 1.0 + rimEdge;

        // Alert mode transitions into menacing crimson / fiery orange
        vec3 alertColor = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.3, 0.0), sweep);
        finalColor = mix(finalColor, alertColor * petalMask * 1.5, uAlertMode);
        
        // Use normal blending alpha: opaque in the center of the petals, transparent at edges
        float alpha = petalMask * mix(0.7, 0.9, edgeFade) + (fresnel * 0.4);
        
        // Clamp alpha to ensure it behaves well in WebGL
        alpha = clamp(alpha, 0.0, 1.0);
        
        gl_FragColor = vec4(finalColor, alpha);    
    }
`;

// ── CORE GLOW HALO SHADER ──────────────────────────────────────────
export const coreGlowVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const coreGlowFragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    uniform float uAlertMode;

    void main() {
        vec3 viewDir = normalize(-vPosition);
        float ndotv = max(dot(viewDir, vNormal), 0.0);
        
        // Sharp continuous edge to simulate a physical glass bubble
        float fresnel = pow(1.0 - ndotv, 3.5);

        // Core Glass tinted dark blue/purple to outline the bright internals
        vec3 glassColor = vec3(0.01, 0.02, 0.05);
        
        // Sweeping chromatic highlights on the glass edges (Pink and Cyan)
        vec3 rimCyan = vec3(0.0, 0.5, 0.8);
        vec3 rimPink = vec3(0.7, 0.1, 0.5);
        
        float n = sin(vPosition.x * 0.5 + uTime * 0.5) * cos(vPosition.y * 0.5 - uTime * 0.3) * 0.5 + 0.5;
        vec3 rimColor = mix(rimCyan, rimPink, n) * fresnel * 1.8;

        vec3 finalColor = glassColor + rimColor;

        vec3 alertColor = vec3(0.5, 0.05, 0.0) * fresnel * 2.0;
        finalColor = mix(finalColor, alertColor + vec3(0.1, 0.0, 0.0), uAlertMode);

        // Glass is highly transparent so we can see the ribbons inside
        float alpha = 0.01 + fresnel * 0.4; 
        
        // Very subtle pulse
        float pulse = 0.95 + sin(uTime * 2.0) * 0.05;
        alpha *= pulse;

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// ── PLANET SHADER ──────────────────────────────────────────────────
export const planetVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const planetFragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uHover;
    uniform float uAlertMode;

    void main() {
        vec3 viewDir = normalize(-vPosition);
        float ndotv = max(dot(viewDir, vNormal), 0.0);
        float fresnel = pow(1.0 - ndotv, 3.0);

        // Base diffuse
        float diffuse = ndotv * 0.6 + 0.4;

        // Emissive energy
        float energy = sin(vUv.y * 12.0 + uTime * 2.0) * 0.5 + 0.5;
        energy *= 0.3;

        vec3 baseColor = uColor * diffuse + uColor * fresnel * 0.8 + vec3(energy * 0.08);

        // Hover boost
        baseColor += uColor * uHover * 0.3;
        baseColor += vec3(fresnel * uHover * 0.5);

        // Alert tint
        vec3 alertTint = vec3(1.0, 0.15, 0.15);
        baseColor = mix(baseColor, alertTint, uAlertMode * 0.4);

        float alpha = 0.92 + fresnel * 0.08;
        gl_FragColor = vec4(baseColor, alpha);
    }
`;

// ── PLANET GLOW ────────────────────────────────────────────────────
export const planetGlowVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const planetGlowFragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 uColor;
    uniform float uHover;

    void main() {
        vec3 viewDir = normalize(-vPosition);
        // Volumetric radial glow to guarantee zero sharp edges
        float intensity = max(dot(viewDir, vNormal), 0.0);
        intensity = pow(intensity, 1.5);

        float alpha = intensity * (0.3 + uHover * 0.4);
        vec3 color = uColor * 1.5;

        gl_FragColor = vec4(color, alpha);
    }
`;

// ── ORBIT TORUS SHADER ──────────────────────────────────────────────
export const orbitVertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const orbitFragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uAlertMode;

    void main() {
        // Fresnel for the torus tube to make it look ethereal and hollow
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
        fresnel = pow(fresnel, 1.5);

        // Multiple strands using uv.y (around the tube)
        float strands = sin(vUv.y * 30.0 + uTime * 2.0) * 0.5 + 0.5;
        strands = smoothstep(0.4, 0.6, strands);

        // Energy pulses flowing along the ring
        float energy = sin(vUv.x * 20.0 - uTime * 4.0) * 0.5 + 0.5;
        energy = pow(energy, 3.0);

        // Combine
        float alpha = fresnel * (0.15 + strands * 0.2 + energy * 0.5);

        vec3 color = uColor + vec3(energy * 0.2) + vec3(strands * 0.1);
        
        vec3 alertColor = vec3(1.0, 0.2, 0.15);
        color = mix(color, alertColor, uAlertMode * 0.6);

        gl_FragColor = vec4(color, alpha);
    }
`;

// ── ENERGY BEAM SHADER ─────────────────────────────────────────────
export const beamVertexShader = /* glsl */ `
    attribute float aAlpha;
    varying float vAlpha;

    void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const beamFragmentShader = /* glsl */ `
    varying float vAlpha;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uIntensity;

    void main() {
        float pulse = 0.5 + sin(uTime * 3.0 + vAlpha * 10.0) * 0.3;
        float alpha = vAlpha * pulse * uIntensity * 0.4;
        gl_FragColor = vec4(uColor * 1.5, alpha);
    }
`;

// ── BACKGROUND STARS SHADER ────────────────────────────────────────
export const starsVertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aBrightness;
    varying float vBrightness;
    uniform float uTime;

    void main() {
        vBrightness = aBrightness;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (200.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
    }
`;

export const starsFragmentShader = /* glsl */ `
    varying float vBrightness;
    uniform float uTime;

    void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;

        float alpha = smoothstep(0.5, 0.0, d);
        float twinkle = 0.6 + sin(uTime * 2.0 + vBrightness * 100.0) * 0.4;

        vec3 color = mix(
            vec3(0.7, 0.8, 1.0),
            vec3(1.0, 0.9, 0.7),
            vBrightness
        );

        gl_FragColor = vec4(color * twinkle, alpha * vBrightness);
    }
`;

// ── FLOATING DUST SHADER ───────────────────────────────────────────
export const dustVertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    varying float vPhase;
    uniform float uTime;

    void main() {
        vPhase = aPhase;

        // Gentle noise-like movement
        vec3 pos = position;
        pos.x += sin(uTime * 0.3 + aPhase * 6.28) * 0.5;
        pos.y += cos(uTime * 0.2 + aPhase * 4.0) * 0.3;
        pos.z += sin(uTime * 0.15 + aPhase * 3.0) * 0.4;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (100.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
    }
`;

export const dustFragmentShader = /* glsl */ `
    varying float vPhase;
    uniform float uTime;

    void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;

        float alpha = smoothstep(0.5, 0.0, d) * 0.15;
        float flicker = 0.5 + sin(uTime + vPhase * 20.0) * 0.5;

        vec3 color = mix(
            vec3(0.3, 0.4, 0.8),
            vec3(0.6, 0.3, 0.9),
            vPhase
        );

        gl_FragColor = vec4(color, alpha * flicker);
    }
`;
