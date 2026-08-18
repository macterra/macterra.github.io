/**
 * Film plate, not a game level.
 * The canyon is a photograph. The canvas is a pane of rainy glass in front of it.
 */
import * as THREE from "three";

function loadTex(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t: any) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D uPlate;
uniform vec2 uRes;
uniform vec2 uPlateRes;
uniform vec2 uMouse;
uniform float uTime;
uniform float uReduced;
varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  float ra = uRes.x / max(uRes.y, 1.0);
  float ta = uPlateRes.x / max(uPlateRes.y, 1.0);
  vec2 p = uv - 0.5;
  if (ra > ta) p.y *= ta / ra;
  else p.x *= ra / ta;
  return p + 0.5;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

vec2 dropLayer(vec2 uv, float t, float scale) {
  vec2 aspect = vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  vec2 u = uv * scale * aspect;
  vec2 cell = floor(u);
  vec2 f = fract(u) - 0.5;
  float n = hash21(cell);
  float life = fract(t * (0.09 + n * 0.07) + n);
  vec2 c = vec2((n - 0.5) * 0.62, 0.45 - life * 1.15);
  vec2 d = (f - c);
  d.x *= aspect.x / scale;
  float r = length(d);
  float drop = smoothstep(0.085, 0.04, r);
  float trail = smoothstep(0.07, 0.0, abs(d.x * scale))
    * smoothstep(c.y + 0.02, c.y - 0.08, f.y)
    * smoothstep(c.y - 0.72, c.y - 0.12, f.y)
    * (1.0 - life);
  vec2 refr = d * drop * 0.28 + vec2(0.0, trail * 0.035);
  return refr / scale;
}

vec3 samplePlate(vec2 uv) {
  uv = clamp(uv, vec2(0.002), vec2(0.998));
  return texture2D(uPlate, uv).rgb;
}

vec3 aces(vec3 x) {
  x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return clamp(x, 0.0, 1.0);
}

void main() {
  vec2 uv = coverUv(vUv);

  vec2 drift = uMouse * vec2(0.022, 0.012);
  float ken = 1.0 - 0.035 * (uReduced > 0.5 ? 0.0 : (0.5 + 0.5 * sin(uTime * 0.025)));
  vec2 base = (uv - 0.5) * ken + 0.5 + drift;

  vec2 distort = vec2(0.0);
  if (uReduced < 0.5) {
    distort += dropLayer(uv, uTime, 7.0);
    distort += dropLayer(uv + 17.2, uTime * 0.85 + 3.1, 12.5) * 0.65;
    distort += dropLayer(uv + 41.7, uTime * 1.1 + 8.4, 21.0) * 0.4;
  }

  vec2 suv = base + distort;
  vec3 col = samplePlate(suv);

  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 off = vec2(cos(a), sin(a)) * 0.0065;
    vec3 s = samplePlate(suv + off);
    glow += max(s - vec3(0.52), 0.0);
  }
  col += glow * 0.16;

  float streak = 0.0;
  for (int i = -7; i <= 7; i++) {
    if (i == 0) continue;
    vec3 s = samplePlate(suv + vec2(float(i) * 0.0028, 0.0));
    streak += max(dot(s, vec3(0.3, 0.5, 0.2)) - 0.58, 0.0);
  }
  col += vec3(1.0, 0.62, 0.28) * streak * 0.035;

  if (uReduced < 0.5) {
    float sheet = fract(uv.x * 90.0 + uv.y * 18.0 - uTime * 2.4);
    float rain = smoothstep(0.97, 1.0, sheet) * 0.045 * (1.0 - uv.y);
    col += vec3(0.85, 0.78, 0.68) * rain;
  }

  col *= vec3(1.04, 0.96, 0.88);
  col = mix(vec3(0.09, 0.045, 0.025), col, 0.96);
  col = aces(col * 1.05);

  float vig = 1.0 - 0.35 * pow(length((vUv - 0.5) * vec2(1.15, 1.0)), 2.2);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Lattice {
  private renderer: any;
  private scene = new THREE.Scene();
  private camera: any;
  private mat: any;
  private canvas: HTMLCanvasElement;
  private t = 0;
  private reduced: boolean;
  static async create(canvas: HTMLCanvasElement): Promise<Lattice> {
    const plate = await loadTex("/plates/street.jpg");
    return new Lattice(canvas, plate);
  }

  private constructor(canvas: HTMLCanvasElement, plate: any) {
    this.canvas = canvas;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x140c0a, 1);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uPlate: { value: plate },
        uRes: { value: new THREE.Vector2(1, 1) },
        uPlateRes: { value: new THREE.Vector2(plate.image.width || 1920, plate.image.height || 1080) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 },
        uReduced: { value: this.reduced ? 1 : 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.scene.add(quad);

    this.layout();
    window.addEventListener("resize", () => this.layout());
  }

  private layout(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.mat.uniforms.uRes.value.set(w, h);
  }

  setPointer(_nx: number, _ny: number): void {}

  frame(dt: number, px: number, py: number): void {
    this.t += dt;
    this.mat.uniforms.uTime.value = this.t;
    const m = this.mat.uniforms.uMouse.value;
    m.x += (px - m.x) * 0.045;
    m.y += (py - m.y) * 0.045;
    this.renderer.render(this.scene, this.camera);
  }
}
