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

    // Multi-octave FBM for smooth cloudy displacement
    float fbm(vec3 p, float t) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 5; i++) {
            val += amp * snoise(p * freq + t);
            freq *= 2.0;
            amp *= 0.5;
        }
        return val;
    }

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        // Smooth cloud-like FBM layers (very soft, no harsh edges)
        float n1 = fbm(position * 0.35, uTime * 0.3);
        float n2 = fbm(position * 0.5 + vec3(5.2, 1.3, 2.8), -uTime * 0.25);
        float noiseVal = n1 * 0.6 + n2 * 0.4;
        
        vDisplacement = noiseVal;
        
        // Gentle smooth displacement (no harsh folds)
        vec3 displaced = position + normal * noiseVal * 0.25;
        float pulse = 1.0 + sin(uTime * 1.2) * 0.02;
        displaced *= pulse;
        
        vec4 viewPos = modelViewMatrix * vec4(displaced, 1.0);
        vPosition = viewPos.xyz;
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
        vec3 viewDir = normalize(-vPosition);
        float ndotv = max(dot(viewDir, vNormal), 0.0);
        
        // Soft edge masking
        float edgeFade = smoothstep(0.0, 0.5, ndotv);
        
        // Fresnel rim glow
        float fresnel = pow(1.0 - ndotv, 2.8);
        
        // Balanced color palette — visible with soft glow
        vec3 colorCyan   = vec3(0.05, 0.7, 0.95);
        vec3 colorPink   = vec3(0.8, 0.12, 0.5);
        vec3 colorGreen  = vec3(0.2, 0.8, 0.45);
        vec3 colorPurple = vec3(0.4, 0.12, 0.8);
        
        // Smooth cloud mask — soft gradients
        float cloudMask = smoothstep(-0.3, 0.6, vDisplacement);
        cloudMask = cloudMask * cloudMask;
        
        // Blend colors smoothly
        float t1 = smoothstep(-0.5, 0.5, vDisplacement);
        float t2 = sin(vPosition.y * 1.5 + uTime * 0.6) * 0.5 + 0.5;
        
        vec3 smokeColor = mix(colorCyan, colorPurple, t1);
        smokeColor = mix(smokeColor, colorPink, t2 * 0.5);
        
        // Gentle sweeping highlights
        float sweep = sin(vPosition.x * 2.0 + uTime * 1.2 + vDisplacement * 2.0) * 0.5 + 0.5;
        vec3 highlight = mix(colorCyan, colorGreen, sweep);
        smokeColor += highlight * pow(sweep, 3.0) * 1.2;
        
        // Soft rim glow
        vec3 rimEdge = mix(vec3(0.0, 0.3, 0.5), vec3(0.4, 0.0, 0.4), sin(uTime * 0.5) * 0.5 + 0.5) * fresnel;

        // Inner glow — soft radial light to keep the core visible
        float innerGlow = pow(ndotv, 2.0) * 0.45;
        vec3 glowColor = mix(colorCyan, vec3(0.4, 0.3, 0.8), 0.5) * innerGlow;

        vec3 finalColor = (smokeColor * cloudMask * 1.5 + rimEdge * 1.0 + glowColor) * 1.75; // Multiply slightly harder to ensure center blooms nicely over the 0.85 threshold

        // Alert mode
        vec3 alertColor = mix(vec3(0.8, 0.0, 0.0), vec3(0.8, 0.25, 0.0), sweep);
        finalColor = mix(finalColor, alertColor * cloudMask * 1.5, uAlertMode);
        
        // Translucent smoky alpha — visible glow
        float alpha = cloudMask * mix(0.6, 0.85, edgeFade) + (fresnel * 0.4) + innerGlow * 0.6;
        alpha = clamp(alpha, 0.0, 0.95);
        
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
        float fresnel = pow(1.0 - ndotv, 2.5);

        // Clean glass — solid center, bright rim
        float glassBase = 0.5 + fresnel * 0.6;

        // Smooth color — no lines, no patterns
        vec3 baseColor = uColor * glassBase + uColor * fresnel * 0.6;

        // Soft specular highlight
        float specular = pow(ndotv, 16.0) * 0.25;
        baseColor += vec3(specular);

        // Hover boost
        baseColor += uColor * uHover * 0.2;
        baseColor += vec3(fresnel * uHover * 0.3);

        // Alert tint
        vec3 alertTint = vec3(1.0, 0.15, 0.15);
        baseColor = mix(baseColor, alertTint, uAlertMode * 0.4);

        // Clean glass alpha
        float alpha = 0.6 + fresnel * 0.35 + uHover * 0.1;
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
        float intensity = max(dot(viewDir, vNormal), 0.0);
        intensity = pow(intensity, 1.2);

        // Strong visible glow shell
        float alpha = intensity * (0.7 + uHover * 0.3);
        vec3 color = uColor * 1.6 + vec3(0.1);

        gl_FragColor = vec4(color, alpha);
    }
`;

// ── ORBIT TORUS SHADER ──────────────────────────────────────────────
export const orbitVertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const orbitFragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uAlertMode;
    uniform vec3 uPlanetPos;
    uniform float uPlanetRadius;

    void main() {
        // Fade out near planet to avoid line-through-glass artifact
        float distToPlanet = length(vWorldPos - uPlanetPos);
        float planetMask = smoothstep(uPlanetRadius * 0.8, uPlanetRadius * 2.5, distToPlanet);

        // Fresnel for the torus tube
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
        fresnel = pow(fresnel, 1.5);

        // Strands
        float strands = sin(vUv.y * 30.0 + uTime * 2.0) * 0.5 + 0.5;
        strands = smoothstep(0.4, 0.6, strands);

        // Energy pulses
        float energy = sin(vUv.x * 20.0 - uTime * 4.0) * 0.5 + 0.5;
        energy = pow(energy, 3.0);

        float alpha = fresnel * (0.15 + strands * 0.2 + energy * 0.5) * planetMask;

        vec3 color = uColor + vec3(energy * 0.2) + vec3(strands * 0.1);

        vec3 alertColor = vec3(1.0, 0.2, 0.15);
        color = mix(color, alertColor, uAlertMode * 0.6);

        gl_FragColor = vec4(color, alpha);
    }
`;

// ── ENERGY BEAM SHADER ─────────────────────────────────────────────
export const beamVertexShader = /* glsl */ `
    attribute float aAlpha;
    attribute float aProgress;
    varying float vAlpha;
    varying float vProgress;

    void main() {
        vAlpha = aAlpha;
        vProgress = aProgress;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const beamFragmentShader = /* glsl */ `
    varying float vAlpha;
    varying float vProgress;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uIntensity;

    void main() {
        // Create traveling dashed packets (data flow)
        float speed = 4.0;
        float density = 15.0; // number of packets along the line
        float wave = sin(vProgress * density - uTime * speed) * 0.5 + 0.5;
        float packet = pow(wave, 6.0); // make dots smaller and sharper

        // Base soft pulse for the entire line
        float slowPulse = 0.5 + sin(uTime * 2.0) * 0.2;
        
        // Combine base glow with bright data packets, clamped so they don't blow out
        float totalGlow = (slowPulse + packet * 1.2) * uIntensity * 1.0;
        
        float alpha = vAlpha * totalGlow * 0.35;
        gl_FragColor = vec4(uColor + (vec3(packet) * 0.6), alpha);
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
