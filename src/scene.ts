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

vec2 heatShimmer(vec2 uv, float t) {
  float n = hash21(floor(uv * vec2(7.0, 4.0)));
  float t2 = t * (0.85 + n * 0.7) + n * 5.4;
  float a = sin(uv.x * 38.0 + t2 * 2.6) * sin(uv.y * 26.0 - t2 * 2.0);
  float b = sin(uv.x * 67.0 - t2 * 3.5 + 2.0) * sin(uv.y * 49.0 + t2 * 2.8);
  return vec2(a * 0.5 + b * 0.25, a * 0.3 + b * 0.75) * 0.0055;
}

float neonFlicker(vec2 uv, float t) {
  vec2 id = floor(uv * vec2(14.0, 8.0));
  float n = hash21(id);
  return 0.72 + 0.28 * sin(t * (3.4 + n * 8.0) + n * 18.0);
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

  vec3 probe = samplePlate(base);
  float lum = dot(probe, vec3(0.30, 0.54, 0.16));
  float mx = max(probe.r, max(probe.g, probe.b));
  float mn = min(probe.r, min(probe.g, probe.b));
  float sat = mx - mn;
  float steam = smoothstep(0.16, 0.40, lum) * smoothstep(0.38, 0.10, sat);
  float lamp = smoothstep(0.22, 0.50, mx) * smoothstep(0.10, 0.32, sat);
  float alive = clamp(steam + lamp, 0.0, 1.0);

  vec2 distort = vec2(0.0);
  if (uReduced < 0.5) {
    distort = heatShimmer(base, uTime) * alive;
  }

  vec2 suv = base + distort;
  vec3 col = samplePlate(suv);
  if (uReduced < 0.5) {
    float boil = 0.5 + 0.5 * sin(uTime * 2.8 + base.y * 22.0 + base.x * 9.0);
    col += col * steam * boil * 0.16;
    col *= mix(1.0, neonFlicker(base, uTime), lamp);
  }

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
