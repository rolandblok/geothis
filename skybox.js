/**
 * skybox.js
 * Procedural WebGL starfield skybox generator for globe.gl.
 *
 * Renders an equirectangular texture containing:
 *   • Point stars  — hash-grid distributed, 3 rotated layers (~8 000 stars)
 *   • Bright stars — seeded, exponential glow with colour tints
 *   • Nebulae      — seeded, 6-octave domain-warped value noise
 *   • Sun          — seeded position, wide soft corona (space-3d sun.glsl technique)
 *
 * Technique adapted from space-3d by Rye Terrell
 * https://github.com/wwwtyro/space-3d  (Unlicense / public domain)
 *
 * Usage:
 *   const dataUrl = generateSkybox({ seed: 42, numNebulae: 2, numBrightStars: 10 });
 *   globe.backgroundImageUrl(dataUrl);
 */
(function (global) {
    'use strict';

    /* ── Seeded LCG RNG ─────────────────────────────────────────────────── */

    /* Convert any seed value to an integer (matches space-3d's hashcode). */
    function hashSeed(seed) {
        if (typeof seed === 'number') return seed >>> 0;
        let h = 0;
        const s = String(seed);
        for (let i = 0; i < s.length; i++) h += (i + 1) * s.charCodeAt(i);
        return h >>> 0;
    }

    function makeLCG(seed) {
        let s = (seed >>> 0) || 1;
        return function rand() {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 0xFFFFFFFF;
        };
    }

    /* Uniform random point on the unit sphere (Marsaglia's method). */
    function randomOnSphere(rng) {
        let x, y, s;
        do { x = rng() * 2 - 1; y = rng() * 2 - 1; s = x * x + y * y; }
        while (s >= 1);
        const r = 2 * Math.sqrt(1 - s);
        return [x * r, y * r, 1 - 2 * s];
    }

    /* ── Vertex shader ──────────────────────────────────────────────────── */
    const VERT = `
attribute vec2 aPosition;
varying   vec2 vUV;
void main() {
    vUV         = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

    /* ── Fragment shader template ────────────────────────────────────────── */
    /* {{NB}} = numBrightStars  {{NN}} = numNebulae (replaced at runtime)    */
    const FRAG = `
#ifdef GL_ES
precision highp float;
#endif
#define PI  3.14159265358979
#define TAU 6.28318530717959
#define NB {{NB}}
#define NN {{NN}}

varying vec2 vUV;

uniform vec3  uBPos   [NB];
uniform vec3  uBColor [NB];
uniform float uBSize  [NB];
uniform float uBFall  [NB];

uniform vec3  uNOff   [NN];
uniform float uNScale [NN];
uniform vec3  uNColor [NN];
uniform float uNInt   [NN];
uniform float uNFall  [NN];

uniform vec3  uSunPos;
uniform vec3  uSunColor;
uniform float uSunSize;
uniform float uSunFall;

uniform float uPS0, uPS1, uPS2;

/* ── Hash functions (David Hoskins / public domain) ─────────────────── */
float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2  h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float h3f(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}

/* ── 3-D value noise ─────────────────────────────────────────────────── */
float n3(vec3 p){
    vec3 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(
        mix(mix(h3f(i),             h3f(i+vec3(1,0,0)), f.x),
            mix(h3f(i+vec3(0,1,0)), h3f(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(h3f(i+vec3(0,0,1)), h3f(i+vec3(1,0,1)), f.x),
            mix(h3f(i+vec3(0,1,1)), h3f(i+vec3(1,1,1)), f.x), f.y), f.z);
}

/* ── Domain-warped fractal nebula noise (after wwwtyro/space-3d) ─────── */
float nebNoise(vec3 p){
    vec3  d  = vec3(0.0);
    float sc = 64.0;
    for(int i=0;i<6;i++){
        d  = vec3(n3(p.xyz*sc+d), n3(p.yzx*sc+d), n3(p.zxy*sc+d));
        sc *= 0.5;
    }
    return n3(p*sc+d);
}

/* ── Equirectangular UV → unit 3-D direction ─────────────────────────── */
vec3 uvDir(vec2 uv){
    float ph=uv.x*TAU-PI, th=uv.y*PI-PI*0.5, ct=cos(th);
    return vec3(ct*cos(ph), sin(th), ct*sin(ph));
}

/* ── One layer of hash-grid point stars ──────────────────────────────── */
float psLayer(vec3 dir, float seed){
    float ph = atan(dir.z, dir.x) / TAU + 0.5;
    float th = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    const float G = 90.0;
    vec2  cell = floor(vec2(ph, th) * G);
    float acc  = 0.0;
    for(int dx=-1;dx<=1;dx++){
        for(int dy=-1;dy<=1;dy++){
            vec2  c    = cell + vec2(float(dx), float(dy));
            vec2  sp   = (c + h22(c + seed)) / G;
            float sph  = (sp.x - 0.5) * TAU;
            float sth  = (sp.y - 0.5) * PI;
            vec3  sd   = normalize(vec3(cos(sth)*cos(sph), sin(sth), cos(sth)*sin(sph)));
            float ang  = 1.0 - dot(normalize(dir), sd);
            float br   = pow(h12(c + seed), 4.0);       /* skew toward dim */
            float sz   = 0.00000018 * (1.0 + br * 3.0);
            acc += br * smoothstep(sz * 2.5, 0.0, ang);
        }
    }
    return clamp(acc, 0.0, 1.0);
}

void main(){
    vec3 dir = uvDir(vUV);
    vec3 col = vec3(0.0);

    /* Point stars — 3 rotated layers */
    col += vec3(psLayer(dir,     uPS0) * 1.00
              + psLayer(dir.zyx, uPS1) * 0.65
              + psLayer(dir.yzx, uPS2) * 0.45);

    /* Bright stars with exponential glow */
    for(int i=0;i<NB;i++){
        float d     = 1.0 - clamp(dot(normalize(dir), normalize(uBPos[i])), 0.0, 1.0);
        float inten = clamp(exp(-(d - uBSize[i]) * uBFall[i]), 0.0, 2.0);
        col += uBColor[i] * inten;
    }

    /* Nebulae */
    for(int i=0;i<NN;i++){
        vec3  p = normalize(dir) * uNScale[i] + uNOff[i];
        float c = min(1.0, nebNoise(p) * uNInt[i]);
        col += uNColor[i] * pow(c, uNFall[i]);
    }

    /* Sun — wide soft corona (after wwwtyro/space-3d sun.glsl) */
    float sunD = 1.0 - clamp(dot(normalize(dir), normalize(uSunPos)), 0.0, 1.0);
    float sunI = clamp(exp(-(sunD - uSunSize) * uSunFall), 0.0, 4.0);
    col += uSunColor * sunI;

    gl_FragColor = vec4(min(col, vec3(4.0)), 1.0);
}`;

    /* ── WebGL helpers ──────────────────────────────────────────────────── */
    function compileShader(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error('[skybox] shader compile error:', gl.getShaderInfoLog(s));
            gl.deleteShader(s);
            return null;
        }
        return s;
    }

    function buildProgram(gl, vertSrc, fragSrc) {
        const vs = compileShader(gl, gl.VERTEX_SHADER,   vertSrc);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('[skybox] program link error:', gl.getProgramInfoLog(prog));
            return null;
        }
        return prog;
    }

    /* ── 2-D canvas fallback (no WebGL) ─────────────────────────────────── */
    function fallback2D(w, h, seed) {
        const cv  = document.createElement('canvas');
        cv.width  = w;
        cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#00001a';
        ctx.fillRect(0, 0, w, h);
        const rng = makeLCG(seed);
        for (let i = 0; i < 3000; i++) {
            const x = rng() * w, y = rng() * h, r = 0.5 + rng() * 1.5, a = 0.3 + rng() * 0.7;
            ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        return cv.toDataURL('image/webp', 0.92);
    }

    /* ── Public API ─────────────────────────────────────────────────────── */
    /**
     * generateSkybox(options) → equirectangular data URL
     *
     * Pass the result directly to globe.backgroundImageUrl().
     *
     * @param {object} [opts]
     * @param {number} [opts.width=2048]          Texture width  in pixels
     * @param {number} [opts.height=1024]         Texture height in pixels
     * @param {number} [opts.seed=42]             Integer seed (change for different scenes)
     * @param {number}  [opts.numNebulae=2]        Number of nebulae  (1–4)
     * @param {number}  [opts.numBrightStars=10]   Number of bright stars (1–16)
     * @param {boolean} [opts.sun=true]            Whether to render a sun
     */
    function generateSkybox({ width = 2048, height = 1024, seed = 42, numNebulae = 2, numBrightStars = 10, sun = true } = {}) {
        const NB = Math.max(1, Math.min(16, numBrightStars));
        const NN = Math.max(1, Math.min(4,  numNebulae));
        const S  = hashSeed(seed);

        const cv  = document.createElement('canvas');
        cv.width  = width;
        cv.height = height;

        const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
        if (!gl) {
            console.warn('[skybox] WebGL unavailable, using 2D canvas fallback.');
            return fallback2D(width, height, S);
        }

        const fragSrc = FRAG.replace(/\{\{NB\}\}/g, NB).replace(/\{\{NN\}\}/g, NN);
        const prog    = buildProgram(gl, VERT, fragSrc);
        if (!prog) return fallback2D(width, height, seed);

        gl.useProgram(prog);

        /* Fullscreen quad (triangle strip) */
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const U = name => gl.getUniformLocation(prog, name);

        /* Point-star layer seeds (one float per layer) */
        const psRng = makeLCG(S ^ 0xABCDEF12);
        gl.uniform1f(U('uPS0'), psRng());
        gl.uniform1f(U('uPS1'), psRng());
        gl.uniform1f(U('uPS2'), psRng());

        /* Bright stars */
        const bRng  = makeLCG(S ^ 0x3A6F9C00);
        const TINTS = [[1,1,1],[0.8,0.9,1],[1,1,0.75],[1,0.85,0.6]];
        const bPos = [], bCol = [], bSz = [], bFall = [];
        for (let i = 0; i < NB; i++) {
            bPos.push(...randomOnSphere(bRng));
            bCol.push(...TINTS[Math.floor(bRng() * TINTS.length)]);
            bSz.push(bRng() * 0.000004 + 0.0000008);
            bFall.push(bRng() * 120000 + 80000);
        }
        gl.uniform3fv(U('uBPos'),   bPos);
        gl.uniform3fv(U('uBColor'), bCol);
        gl.uniform1fv(U('uBSize'),  bSz);
        gl.uniform1fv(U('uBFall'),  bFall);

        /* Sun */
        const sRng   = makeLCG(S ^ 0xF00DCAFE);
        const sunPos = randomOnSphere(sRng);
        const sunHue = sRng();
        // Warm yellow-white tint, seeded
        const sunColor = sun ? [1.0, 0.85 + sunHue * 0.12, 0.55 + sunHue * 0.25] : [0, 0, 0];
        gl.uniform3fv(U('uSunPos'),   sunPos);
        gl.uniform3fv(U('uSunColor'), sunColor);
        gl.uniform1f(U('uSunSize'),   sRng() * 0.0005 + 0.005);   // disc size  (0.0001–0.0002)
        gl.uniform1f(U('uSunFall'),   sRng() * 32.0   + 16.0);      // corona falloff (8–24)

        /* Nebulae */
        const nRng = makeLCG(S ^ 0x1B2C3D4E);
        const nOff = [], nSc = [], nCol = [], nInt = [], nFall = [];
        for (let i = 0; i < NN; i++) {
            nOff.push(nRng() * 2000 - 1000, nRng() * 2000 - 1000, nRng() * 2000 - 1000);
            nSc.push(nRng() * 0.5 + 0.2);
            nCol.push(nRng(), nRng(), nRng());
            nInt.push(nRng() * 0.25 + 0.85);
            nFall.push(nRng() * 3.0 + 3.5);
        }
        gl.uniform3fv(U('uNOff'),   nOff);
        gl.uniform1fv(U('uNScale'), nSc);
        gl.uniform3fv(U('uNColor'), nCol);
        gl.uniform1fv(U('uNInt'),   nInt);
        gl.uniform1fv(U('uNFall'),  nFall);

        /* Render */
        gl.viewport(0, 0, width, height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return cv.toDataURL('image/webp', 0.92);
    }

    global.generateSkybox = generateSkybox;

}(window));
