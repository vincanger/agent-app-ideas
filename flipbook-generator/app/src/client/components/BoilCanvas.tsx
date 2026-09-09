import { useEffect, useRef, useState } from "react";

// Boil layer: seeded-noise displacement of the current page, pure client-side
// WebGL. A new noise seed every ~110 ms makes the lines jump rather than glide,
// which is what hand-drawn "boiling" looks like.

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() {
  v = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5);
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_amp;   // displacement amplitude in px
uniform float u_seed;  // discrete boil seed — steps, never glides
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1, 0)), f.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
    f.y
  );
}
float fbm(vec2 p) { return noise(p) * 0.65 + noise(p * 2.3) * 0.35; }
void main() {
  vec2 px = v * u_res;
  float sc = 0.035; // ~30px noise features
  vec2 off = vec2(
    fbm(px * sc + vec2(u_seed * 13.7, u_seed * 71.3)) - 0.5,
    fbm(px * sc + vec2(u_seed * 41.9 + 100.0, u_seed * 7.1 + 100.0)) - 0.5
  ) * 2.0 * u_amp;
  gl_FragColor = texture2D(u_tex, clamp((px + off) / u_res, 0.0, 1.0));
}`;

type TexEntry = { tex: WebGLTexture; w: number; h: number };

type GlState = {
  gl: WebGLRenderingContext;
  uRes: WebGLUniformLocation | null;
  uAmp: WebGLUniformLocation | null;
  uSeed: WebGLUniformLocation | null;
  textures: Map<string, TexEntry>;
};

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("could not create shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
  return s;
}

export function BoilCanvas({ src, amp }: { src: string; amp: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (amp <= 0) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 10000), 110);
    return () => clearInterval(id);
  }, [amp]);

  useEffect(() => {
    if (stateRef.current) return; // StrictMode double-mount guard
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { premultipliedAlpha: false });
    if (!canvas || !gl) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    stateRef.current = {
      gl,
      uRes: gl.getUniformLocation(prog, "u_res"),
      uAmp: gl.getUniformLocation(prog, "u_amp"),
      uSeed: gl.getUniformLocation(prog, "u_seed"),
      textures: new Map(),
    };
  }, []);

  useEffect(() => {
    const st = stateRef.current;
    if (!st || !src) return;
    const { gl } = st;
    const draw = (entry: TexEntry) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== entry.w || canvas.height !== entry.h) {
        canvas.width = entry.w;
        canvas.height = entry.h;
      }
      gl.viewport(0, 0, entry.w, entry.h);
      gl.bindTexture(gl.TEXTURE_2D, entry.tex);
      gl.uniform2f(st.uRes, entry.w, entry.h);
      gl.uniform1f(st.uAmp, amp);
      gl.uniform1f(st.uSeed, tick % 97);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const cached = st.textures.get(src);
    if (cached) {
      draw(cached);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const tex = gl.createTexture();
      if (!tex) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      const entry = { tex, w: img.naturalWidth, h: img.naturalHeight };
      st.textures.set(src, entry);
      draw(entry);
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, amp, tick]);

  return <canvas ref={canvasRef} className="boil-canvas" />;
}
