// Page textures for the canvas book: decoded page images, plus the boil
// pre-pass (the WebGL wobble shader rendered to its own canvas, which the 2D
// book then draws and warps like any other image).

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

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("could not create shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
  return s;
}

// Renders a page image through the boil shader onto an offscreen WebGL
// canvas. Call render() then drawImage(renderer.canvas) in the same frame.
export class BoilRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private uRes: WebGLUniformLocation | null = null;
  private uAmp: WebGLUniformLocation | null = null;
  private uSeed: WebGLUniformLocation | null = null;
  private textures = new Map<HTMLImageElement, WebGLTexture>();

  constructor() {
    this.canvas = document.createElement("canvas");
    // preserveDrawingBuffer so the 2D canvas can copy from it after render()
    const gl = this.canvas.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true });
    this.gl = gl;
    if (!gl) return;
    const prog = gl.createProgram();
    if (!prog) {
      this.gl = null;
      return;
    }
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
    this.uRes = gl.getUniformLocation(prog, "u_res");
    this.uAmp = gl.getUniformLocation(prog, "u_amp");
    this.uSeed = gl.getUniformLocation(prog, "u_seed");
  }

  get available(): boolean {
    return this.gl !== null;
  }

  render(img: HTMLImageElement, amp: number, seed: number): HTMLCanvasElement | null {
    const gl = this.gl;
    if (!gl) return null;
    let tex = this.textures.get(img);
    if (!tex) {
      const created = gl.createTexture();
      if (!created) return null;
      tex = created;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.textures.set(img, tex);
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform2f(this.uRes, w, h);
    gl.uniform1f(this.uAmp, amp);
    gl.uniform1f(this.uSeed, seed % 97);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const tex of this.textures.values()) gl.deleteTexture(tex);
    this.textures.clear();
  }
}

// Decoded page images by src. get() returns null until the image is ready
// and calls onReady once it is, so the draw loop can repaint.
export class PageImages {
  private images = new Map<string, HTMLImageElement>();
  private pending = new Set<string>();

  constructor(private onReady: () => void) {}

  get(src: string): HTMLImageElement | null {
    const img = this.images.get(src);
    if (img) return img.complete && img.naturalWidth > 0 ? img : null;
    if (!this.pending.has(src)) {
      this.pending.add(src);
      const el = new Image();
      el.decoding = "async";
      el.onload = () => {
        this.pending.delete(src);
        this.onReady();
      };
      el.onerror = () => this.pending.delete(src);
      el.src = src;
      this.images.set(src, el);
    }
    return null;
  }

  // Drop images that are no longer part of the book (frames get replaced as
  // drafts upgrade to full-res).
  retain(srcs: Iterable<string>): void {
    const keep = new Set(srcs);
    for (const src of this.images.keys()) if (!keep.has(src)) this.images.delete(src);
  }
}
