import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- Shaders ---

const starVertexShader = `
attribute float size;
attribute float random;
varying vec3 vColor;
varying float vRnd;
void main() {
  vColor = color;
  vRnd = random;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (250.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const starFragmentShader = `
uniform float time;
varying vec3 vColor;
varying float vRnd;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = 1.0 - smoothstep(0.4, 0.5, d);
  a *= 0.7 + 0.3 * sin(time * (0.6 + vRnd * 0.3) + vRnd * 5.0);
  if (a < 0.02) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

const particleVertexShader = `
uniform float time;
attribute float size;
attribute vec3 random;
varying vec3 vCol;
varying float vR;
void main() {
  vCol = color;
  vR = random.z;
  vec3 p = position;
  float t = time * 0.25 * random.z;
  float ax = t + random.y, ay = t * 0.75 + random.x;
  float amp = (0.6 + sin(random.x + t * 0.6) * 0.3) * random.z;
  p.x += sin(ax + p.y * 0.06 + random.x * 0.1) * amp;
  p.y += cos(ay + p.z * 0.06 + random.y * 0.1) * amp;
  p.z += sin(ax * 0.85 + p.x * 0.06 + random.z * 0.1) * amp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float pulse = 0.9 + 0.1 * sin(time * 1.15 + random.y);
  gl_PointSize = size * pulse * (350.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const particleFragmentShader = `
uniform float time;
uniform float hueSpeed;
varying vec3 vCol;
varying float vR;

vec3 hueShift(vec3 c, float h) {
  const vec3 k = vec3(0.57735);
  float cosA = cos(h);
  float sinA = sin(h);
  return c * cosA + cross(k, c) * sinA + k * dot(k, c) * (1.0 - cosA);
}

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  
  float core = smoothstep(0.05, 0.0, d);
  float angle = atan(uv.y, uv.x);
  float flare = pow(max(0.0, sin(angle * 6.0 + time * 2.0 * vR)), 4.0);
  flare *= smoothstep(0.5, 0.0, d);
  float glow = smoothstep(0.4, 0.1, d);
  
  float alpha = core * 1.0 + flare * 0.5 + glow * 0.2;
  
  vec3 color = hueShift(vCol, time * hueSpeed);
  vec3 finalColor = mix(color, vec3(1.0, 0.95, 0.9), core);
  finalColor = mix(finalColor, color, flare * 0.5 + glow * 0.5);

  if (alpha < 0.01) discard;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

const sparkleVertexShader = `
uniform float time;
attribute float size;
attribute vec3 random;
void main() {
  vec3 p = position;
  float t = time * 0.25 * random.z;
  float ax = t + random.y, ay = t * 0.75 + random.x;
  float amp = (0.6 + sin(random.x + t * 0.6) * 0.3) * random.z;
  p.x += sin(ax + p.y * 0.06 + random.x * 0.1) * amp;
  p.y += cos(ay + p.z * 0.06 + random.y * 0.1) * amp;
  p.z += sin(ax * 0.85 + p.x * 0.06 + random.z * 0.1) * amp;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const sparkleFragmentShader = `
uniform float time;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = 1.0 - smoothstep(0.4, 0.5, d);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`;

// --- Geometry Generators ---

const PARTICLE_COUNT = 15000;
const SPARK_COUNT = 2000;
const STAR_COUNT = 7000;

function normalise(points: THREE.Vector3[], size: number) {
    if (points.length === 0) return [];
    const box = new THREE.Box3().setFromPoints(points);
    const maxDim = Math.max(...box.getSize(new THREE.Vector3()).toArray()) || 1;
    const centre = box.getCenter(new THREE.Vector3());
    return points.map(p => p.clone().sub(centre).multiplyScalar(size / maxDim));
}

function torusKnot(n: number) {
    const geometry = new THREE.TorusKnotGeometry(10, 3, 200, 16, 2, 3);
    const points: THREE.Vector3[] = [];
    const positionAttribute = geometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
        points.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i));
    }
    const result: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
        result.push(points[i % points.length].clone());
    }
    return normalise(result, 50);
}

function halvorsen(n: number) {
    const pts: THREE.Vector3[] = [];
    let x = 0.1, y = 0, z = 0;
    const a = 1.89;
    const dt = 0.005;
    for (let i = 0; i < n * 25; i++) {
        const dx = -a * x - 4 * y - 4 * z - y * y;
        const dy = -a * y - 4 * z - 4 * x - z * z;
        const dz = -a * z - 4 * x - 4 * y - x * x;
        x += dx * dt;
        y += dy * dt;
        z += dz * dt;
        if (i > 200 && i % 25 === 0) {
            pts.push(new THREE.Vector3(x, y, z));
        }
        if (pts.length >= n) break;
    }
    while (pts.length < n) pts.push(pts[Math.floor(Math.random() * pts.length)].clone());
    return normalise(pts, 60);
}

function dualHelix(n: number) {
    const pts: THREE.Vector3[] = [];
    const turns = 5;
    const radius = 15;
    const height = 40;
    for (let i = 0; i < n; i++) {
        const isSecondHelix = i % 2 === 0;
        const angle = (i / n) * Math.PI * 2 * turns;
        const y = (i / n) * height - height / 2;
        const r = radius + (isSecondHelix ? 5 : -5);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        pts.push(new THREE.Vector3(x, y, z));
    }
    return normalise(pts, 60);
}

function deJong(n: number) {
    const pts: THREE.Vector3[] = [];
    let x = 0.1, y = 0.1;
    const a = 1.4, b = -2.3, c = 2.4, d = -2.1;
    for (let i = 0; i < n; i++) {
        const xn = Math.sin(a * y) - Math.cos(b * x);
        const yn = Math.sin(c * x) - Math.cos(d * y);
        x = xn;
        y = yn;
        const z = Math.sin(x * y * 0.5);
        pts.push(new THREE.Vector3(x, y, z));
    }
    return normalise(pts, 55);
}

const PATTERNS = [torusKnot, halvorsen, dualHelix, deJong];

interface MorphingParticlesProps {
    onRef?: (fns: { triggerMorph: () => void }) => void;
}

export const MorphingParticles: React.FC<MorphingParticlesProps> = ({ onRef }) => {
    const particlesRef = useRef<THREE.Points>(null);
    const sparklesRef = useRef<THREE.Points>(null);
    const starsRef = useRef<THREE.Points>(null);

    // State for morphing
    const [currentPattern, setCurrentPattern] = useState(0);
    const isTrans = useRef(false);
    const prog = useRef(0);
    const morphSpeed = 0.03;
    const userData = useRef<{ from: Float32Array, to: Float32Array, next: number }>({
        from: new Float32Array(), to: new Float32Array(), next: 0
    });

    // Data generation
    const starsGeometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(STAR_COUNT * 3);
        const col = new Float32Array(STAR_COUNT * 3);
        const size = new Float32Array(STAR_COUNT);
        const rnd = new Float32Array(STAR_COUNT);
        const R = 900;

        for (let i = 0; i < STAR_COUNT; i++) {
            const i3 = i * 3;
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = R * Math.cbrt(Math.random());

            pos[i3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i3 + 2] = r * Math.cos(phi);

            const c = new THREE.Color().setHSL(Math.random() * 0.6, 0.3 + 0.3 * Math.random(), 0.55 + 0.35 * Math.random());
            col[i3] = c.r;
            col[i3 + 1] = c.g;
            col[i3 + 2] = c.b;

            size[i] = 0.25 + Math.pow(Math.random(), 4) * 2.1;
            rnd[i] = Math.random() * Math.PI * 2;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
        geo.setAttribute('random', new THREE.BufferAttribute(rnd, 1));
        return geo;
    }, []);

    const [initialParticlesGeo, initialSparklesGeo] = useMemo(() => {
        const palette = [0xff3c78, 0xff8c00, 0xfff200, 0x00cfff, 0xb400ff, 0xffffff, 0xff4040].map(c => new THREE.Color(c));

        // Particles
        const pGeo = new THREE.BufferGeometry();
        const pPos = new Float32Array(PARTICLE_COUNT * 3);
        const pCol = new Float32Array(PARTICLE_COUNT * 3);
        const pSize = new Float32Array(PARTICLE_COUNT);
        const pRnd = new Float32Array(PARTICLE_COUNT * 3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const base = palette[Math.floor(Math.random() * palette.length)];
            const hsl = { h: 0, s: 0, l: 0 };
            base.getHSL(hsl);
            hsl.h += (Math.random() - 0.5) * 0.05;
            hsl.s = Math.min(1, Math.max(0.7, hsl.s + (Math.random() - 0.5) * 0.3));
            hsl.l = Math.min(0.9, Math.max(0.5, hsl.l + (Math.random() - 0.5) * 0.4));

            const c = new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
            pCol[i3] = c.r; pCol[i3 + 1] = c.g; pCol[i3 + 2] = c.b;

            pSize[i] = 0.7 + Math.random() * 1.1;
            pRnd[i3] = Math.random() * 10;
            pRnd[i3 + 1] = Math.random() * Math.PI * 2;
            pRnd[i3 + 2] = 0.5 + 0.5 * Math.random();
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
        pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
        pGeo.setAttribute('random', new THREE.BufferAttribute(pRnd, 3));

        // Sparkles
        const sGeo = new THREE.BufferGeometry();
        const sPos = new Float32Array(SPARK_COUNT * 3);
        const sSize = new Float32Array(SPARK_COUNT);
        const sRnd = new Float32Array(SPARK_COUNT * 3);

        for (let i = 0; i < SPARK_COUNT; i++) {
            sSize[i] = 0.5 + Math.random() * 0.8;
            sRnd[i * 3] = Math.random() * 10;
            sRnd[i * 3 + 1] = Math.random() * Math.PI * 2;
            sRnd[i * 3 + 2] = 0.5 + 0.5 * Math.random();
        }

        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
        sGeo.setAttribute('random', new THREE.BufferAttribute(sRnd, 3));

        return [pGeo, sGeo];
    }, []);

    // Set initial pattern
    useEffect(() => {
        if (!particlesRef.current || !sparklesRef.current) return;

        const applyPattern = (i: number) => {
            const pts = PATTERNS[i](PARTICLE_COUNT);
            const particleArr = particlesRef.current!.geometry.attributes.position.array as Float32Array;
            const sparkleArr = sparklesRef.current!.geometry.attributes.position.array as Float32Array;

            for (let j = 0; j < PARTICLE_COUNT; j++) {
                const idx = j * 3;
                const p = pts[j] || new THREE.Vector3();
                particleArr[idx] = p.x;
                particleArr[idx + 1] = p.y;
                particleArr[idx + 2] = p.z;
                if (j < SPARK_COUNT) {
                    sparkleArr[idx] = p.x;
                    sparkleArr[idx + 1] = p.y;
                    sparkleArr[idx + 2] = p.z;
                }
            }
            particlesRef.current!.geometry.attributes.position.needsUpdate = true;
            sparklesRef.current!.geometry.attributes.position.needsUpdate = true;
        };

        applyPattern(currentPattern);
    }, []); // Run once on mount

    // Expose trigger to parent
    useEffect(() => {
        if (onRef) {
            onRef({
                triggerMorph: () => {
                    if (!isTrans.current && particlesRef.current) {
                        isTrans.current = true;
                        prog.current = 0;
                        const next = (currentPattern + 1) % PATTERNS.length;

                        const currentPositions = particlesRef.current.geometry.attributes.position.array as Float32Array;
                        const fromPts = new Float32Array(currentPositions);
                        const toPtsVec = PATTERNS[next](PARTICLE_COUNT);

                        const to = new Float32Array(PARTICLE_COUNT * 3);
                        for (let j = 0; j < PARTICLE_COUNT; j++) {
                            const idx = j * 3;
                            const p = toPtsVec[j] || new THREE.Vector3();
                            to[idx] = p.x; to[idx + 1] = p.y; to[idx + 2] = p.z;
                        }

                        userData.current = { from: fromPts, to, next };
                        // Update state lazily at end of animation? Or just track ref.
                        // We'll update state at end.
                    }
                }
            });
        }
    }, [currentPattern, onRef]);

    useFrame((state, delta) => {
        const t = state.clock.elapsedTime;

        if (particlesRef.current && sparklesRef.current) {
            // Update Uniforms
            (particlesRef.current.material as THREE.ShaderMaterial).uniforms.time.value = t;
            (sparklesRef.current.material as THREE.ShaderMaterial).uniforms.time.value = t;
            (starsRef.current!.material as THREE.ShaderMaterial).uniforms.time.value = t;

            // Constant Rotation for Background Movement
            if (particlesRef.current) {
                particlesRef.current.rotation.y += delta * 0.05;
                particlesRef.current.rotation.x += delta * 0.02;
            }
            if (sparklesRef.current) {
                sparklesRef.current.rotation.y += delta * 0.05;
                sparklesRef.current.rotation.x += delta * 0.02;
            }

            // Animation
            if (isTrans.current) {
                prog.current += morphSpeed;
                const p = prog.current;
                const eased = p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
                const { from, to, next } = userData.current;

                if (to) {
                    const particleArr = particlesRef.current.geometry.attributes.position.array as Float32Array;
                    const sparkleArr = sparklesRef.current.geometry.attributes.position.array as Float32Array;

                    for (let i = 0; i < particleArr.length; i++) {
                        const val = from[i] + (to[i] - from[i]) * eased;
                        particleArr[i] = val;
                        if (i < sparkleArr.length) {
                            sparkleArr[i] = val;
                        }
                    }
                    particlesRef.current.geometry.attributes.position.needsUpdate = true;
                    sparklesRef.current.geometry.attributes.position.needsUpdate = true;
                }

                if (p >= 1) {
                    isTrans.current = false;
                    setCurrentPattern(next);
                }
            }
        }
    });

    return (
        <group>
            <points ref={starsRef} geometry={starsGeometry}>
                <shaderMaterial
                    vertexShader={starVertexShader}
                    fragmentShader={starFragmentShader}
                    uniforms={{ time: { value: 0 } }}
                    transparent
                    depthWrite={false}
                    vertexColors
                    blending={THREE.AdditiveBlending}
                />
            </points>

            <points ref={particlesRef} geometry={initialParticlesGeo}>
                <shaderMaterial
                    vertexShader={particleVertexShader}
                    fragmentShader={particleFragmentShader}
                    uniforms={{ time: { value: 0 }, hueSpeed: { value: 0.12 } }}
                    transparent
                    depthWrite={false}
                    vertexColors
                    blending={THREE.AdditiveBlending}
                />
            </points>

            <points ref={sparklesRef} geometry={initialSparklesGeo}>
                <shaderMaterial
                    vertexShader={sparkleVertexShader}
                    fragmentShader={sparkleFragmentShader}
                    uniforms={{ time: { value: 0 } }}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </group>
    );
};
