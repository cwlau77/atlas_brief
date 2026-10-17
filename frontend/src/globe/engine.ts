// Particle globe renderer: grain land and ocean, liquid cursor response,
// pulsing hotspots, drag momentum and auto-spin. Framework-free; GlobeView
// owns its lifecycle and reads hotspot screen positions via onFrame.
import * as THREE from 'three'
import { LAND_POINTS_B64 } from './landPoints'
import { decodeLandPoints, toVec3 } from './regions'

export interface GlobeHotspot { lat: number; lng: number; count: number }
export interface HotspotScreen { x: number; y: number; visible: boolean }
export interface FrameInfo { hotspots: HotspotScreen[]; readout: string | null }
export interface EngineOptions { reducedMotion: boolean; playIntro: boolean; baseSpin: number }

const CAMERA_Z = 5
const BASE_PITCH = 0.32
const PITCH_LIMIT = 0.6
const IDLE_RESUME_MS = 4000
const INTRO_MS = 1900
const OCEAN_POINTS = 5200
const DEG = Math.PI / 180

const VERT = /* glsl */ `
  attribute vec3 aRand;
  uniform float uTime, uIntro, uHover, uSize, uPR, uAlpha, uLiquid;
  uniform vec3 uMouse;
  varying float vAlpha, vFall;
  void main() {
    vec3 p = position;
    float n = sin(p.x * 5.0 + uTime * 0.35) * sin(p.y * 6.0 - uTime * 0.27) * sin(p.z * 4.5 + uTime * 0.21);
    vec3 base = p * (1.0 + n * 0.018);
    float d = distance(p, uMouse);
    float fall = exp(-d * d / 0.03) * uHover * uLiquid;
    vec3 t = p - uMouse; t = t - p * dot(t, p);
    base += p * fall * 0.11 + normalize(t + 1e-5) * fall * 0.05;
    base += p * sin(d * 30.0 - uTime * 4.2) * exp(-d * 4.5) * 0.010 * uHover * uLiquid;
    float k = clamp(uIntro * 1.45 - aRand.y * 0.45, 0.0, 1.0);
    k = 1.0 - pow(1.0 - k, 3.0);
    vec3 scattered = normalize(p + (aRand - 0.5) * 2.4) * (1.7 + aRand.z * 1.6);
    vec3 pos = mix(scattered, base, k);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    float facing = dot(normalize(wp.xyz), normalize(cameraPosition - wp.xyz));
    vAlpha = uAlpha * mix(0.55, 1.0, k) * smoothstep(-0.05, 0.45, facing);
    vFall = fall;
    vec4 mv = viewMatrix * wp;
    gl_PointSize = uSize * uPR * (1.0 + fall * 1.3) * (5.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`

const FRAG = /* glsl */ `
  uniform vec3 uColor, uHot;
  varying float vAlpha, vFall;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.18, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uHot, clamp(vFall * 1.4, 0.0, 1.0)), a);
  }`

const HOT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime, uPR, uShow;
  varying float vPulse, vFace;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vFace = smoothstep(0.0, 0.3, dot(normalize(wp.xyz), normalize(cameraPosition - wp.xyz)));
    vPulse = fract(uTime * 0.45 + aSeed);
    vec4 mv = viewMatrix * wp;
    gl_PointSize = (22.0 + 26.0 * vPulse) * aSize * uPR * uShow;
    gl_Position = projectionMatrix * mv;
  }`

const HOT_FRAG = /* glsl */ `
  varying float vPulse, vFace;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.13, 0.09, d);
    float ringR = 0.12 + vPulse * 0.36;
    float ring = smoothstep(0.03, 0.0, abs(d - ringR)) * (1.0 - vPulse);
    float a = (core + ring * 0.8) * vFace;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.71, 0.325, 0.18, a);
  }`

interface Shared {
  uTime: THREE.IUniform<number>
  uIntro: THREE.IUniform<number>
  uHover: THREE.IUniform<number>
  uMouse: THREE.IUniform<THREE.Vector3>
  uPR: THREE.IUniform<number>
  uLiquid: THREE.IUniform<number>
}

/** A color whose components reach the shader as-is (our shaders do no color-space conversion). */
function rawColor(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace)
}

function randomSphere(n: number): Float32Array {
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u)
    out[i * 3] = s * Math.cos(th); out[i * 3 + 1] = u; out[i * 3 + 2] = s * Math.sin(th)
  }
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`

export class GlobeEngine {
  onFrame: ((info: FrameInfo) => void) | null = null

  private readonly opts: EngineOptions
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  private readonly globe = new THREE.Group()
  private readonly uniforms: Shared
  private readonly hotGeo = new THREE.BufferGeometry()
  private readonly hotMat: THREE.ShaderMaterial
  private readonly disposables: { dispose(): void }[] = []
  private readonly mouseLocal = new THREE.Vector3(9, 9, 9)
  private readonly ray = new THREE.Raycaster()
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1)
  private readonly hit = new THREE.Vector3()
  private hotVecs: THREE.Vector3[] = []
  private yaw = -0.6
  private pitch = BASE_PITCH
  private spinVel = 0
  private vyaw = 0
  private vpitch = 0
  private target: { yaw: number; pitch: number } | null = null
  private lastInteraction = -Infinity
  private hold = false
  private scanning = false
  private running = true
  private disposed = false
  private pointer: THREE.Vector2 | null = null
  private overSphere = false
  private width = 1
  private height = 1
  private raf = 0
  private last = performance.now()
  private readonly introStart = performance.now()
  private introDone: boolean

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.opts = opts
    this.introDone = !opts.playIntro || opts.reducedMotion
    // Throws when WebGL is unavailable; GlobeView catches and shows StaticGlobe.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    const pr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(pr)
    this.camera.position.set(0, 0, CAMERA_Z)
    this.globe.rotation.order = 'XYZ'
    this.scene.add(this.globe)

    this.uniforms = {
      uTime: { value: 0 },
      uIntro: { value: this.introDone ? 1 : 0 },
      uHover: { value: 0 },
      uMouse: { value: this.mouseLocal.clone() },
      uPR: { value: pr },
      uLiquid: { value: opts.reducedMotion ? 0 : 1 },
    }

    const occluderGeo = new THREE.SphereGeometry(0.975, 48, 48)
    const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false })
    const occluder = new THREE.Mesh(occluderGeo, occluderMat)
    occluder.renderOrder = -1
    this.globe.add(occluder)
    this.disposables.push(occluderGeo, occluderMat)

    this.globe.add(this.cloud(randomSphere(OCEAN_POINTS), 0x9AAA92, 1.5, 0.5))
    this.globe.add(this.cloud(decodeLandPoints(LAND_POINTS_B64), 0x3D5A45, 2.5, 0.92))

    this.hotMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: this.uniforms.uTime, uPR: this.uniforms.uPR, uShow: { value: this.introDone ? 1 : 0 } },
      vertexShader: HOT_VERT,
      fragmentShader: HOT_FRAG,
    })
    this.disposables.push(this.hotGeo, this.hotMat)
    const hotPoints = new THREE.Points(this.hotGeo, this.hotMat)
    hotPoints.frustumCulled = false
    this.globe.add(hotPoints)

    this.raf = requestAnimationFrame(this.loop)
  }

  setSize(w: number, h: number): void {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  setPointer(ndc: { x: number; y: number } | null): void {
    this.pointer = ndc ? new THREE.Vector2(ndc.x, ndc.y) : null
  }

  setHotspots(list: GlobeHotspot[]): void {
    const max = Math.max(1, ...list.map((h) => h.count))
    this.hotVecs = list.map((h) => {
      const v = toVec3(h.lat, h.lng, 1.012)
      return new THREE.Vector3(v.x, v.y, v.z)
    })
    this.hotGeo.setAttribute('position', new THREE.Float32BufferAttribute(this.hotVecs.flatMap((v) => [v.x, v.y, v.z]), 3))
    this.hotGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(list.map((h) => 0.7 + 0.6 * (h.count / max)), 1))
    this.hotGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(list.map((_, i) => i * 1.7), 1))
  }

  /** Ease the view so (lat, lng) faces the camera; snaps instantly under reduced motion. */
  focusOn(lat: number, lng: number): void {
    const yaw = -lng * DEG
    const pitch = clamp(lat * DEG, -PITCH_LIMIT, PITCH_LIMIT)
    if (this.opts.reducedMotion) {
      this.target = null
      this.yaw = yaw
      this.pitch = pitch
    } else {
      this.target = { yaw, pitch }
    }
    this.lastInteraction = performance.now()
  }

  rotateBy(dYaw: number, dPitch: number): void {
    this.target = null
    this.yaw += dYaw
    this.pitch = clamp(this.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.spinVel = 0
    this.vyaw = 0
    this.vpitch = 0
    this.lastInteraction = performance.now()
  }

  release(vYaw: number, vPitch: number): void {
    this.vyaw = this.opts.reducedMotion ? 0 : vYaw
    this.vpitch = this.opts.reducedMotion ? 0 : vPitch
    this.lastInteraction = performance.now()
  }

  setHold(on: boolean): void { this.hold = on }
  setScanning(on: boolean): void { this.scanning = on }
  setRunning(on: boolean): void { this.running = on }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.onFrame = null
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
  }

  private cloud(positions: Float32Array, color: number, size: number, alpha: number): THREE.Points {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const rnd = new Float32Array(positions.length)
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random()
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...this.uniforms,
        uSize: { value: size },
        uAlpha: { value: alpha },
        uColor: { value: rawColor(color) },
        uHot: { value: rawColor(0xB5532E) },
      },
    })
    this.disposables.push(geo, mat)
    return new THREE.Points(geo, mat)
  }

  private loop = (now: number): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (!this.running || document.hidden) return

    const u = this.uniforms
    if (!this.opts.reducedMotion) u.uTime.value += dt
    if (!this.introDone) {
      const p = Math.min(1, (now - this.introStart) / INTRO_MS)
      u.uIntro.value = p
      if (p >= 1) this.introDone = true
    }
    const show = this.hotMat.uniforms.uShow as THREE.IUniform<number>
    show.value += ((u.uIntro.value > 0.85 ? 1 : 0) - show.value) * Math.min(1, dt * 5)

    const idle = !this.hold && !this.overSphere && now - this.lastInteraction > IDLE_RESUME_MS
    if (this.target) {
      const k = Math.min(1, dt * 3)
      const dy = wrapAngle(this.target.yaw - this.yaw)
      this.yaw += dy * k
      this.pitch += (this.target.pitch - this.pitch) * k
      if (Math.abs(dy) < 0.002 && Math.abs(this.target.pitch - this.pitch) < 0.002) this.target = null
    } else {
      this.yaw += this.vyaw * dt
      this.pitch += this.vpitch * dt
      const decay = Math.pow(0.05, dt)
      this.vyaw *= decay
      this.vpitch *= decay
      const want = this.opts.reducedMotion ? 0 : this.scanning ? 0.6 : idle ? this.opts.baseSpin : 0
      this.spinVel += (want - this.spinVel) * Math.min(1, dt * 2)
      this.yaw += this.spinVel * dt
    }
    this.pitch = clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.globe.rotation.set(this.pitch, this.yaw, 0)
    this.globe.updateMatrixWorld()

    this.overSphere = false
    let readout: string | null = null
    if (this.pointer) {
      this.ray.setFromCamera(this.pointer, this.camera)
      if (this.ray.ray.intersectSphere(this.sphere, this.hit)) {
        this.overSphere = true
        const local = this.globe.worldToLocal(this.hit.clone()).normalize()
        this.mouseLocal.lerp(local, 0.18)
        readout = `${fmtCoord(Math.asin(local.y) / DEG, 'N', 'S')}  ${fmtCoord(Math.atan2(local.x, local.z) / DEG, 'E', 'W')}`
      }
    }
    u.uHover.value += ((this.overSphere ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 4)
    u.uMouse.value.copy(this.mouseLocal)

    const camDir = this.camera.position.clone().normalize()
    const hotspots = this.hotVecs.map((v) => {
      const w = v.clone().applyMatrix4(this.globe.matrixWorld)
      const visible = w.clone().normalize().dot(camDir) > 0.2 && show.value > 0.5
      w.project(this.camera)
      return { x: ((w.x + 1) / 2) * this.width, y: ((1 - w.y) / 2) * this.height, visible }
    })

    this.renderer.render(this.scene, this.camera)
    this.onFrame?.({ hotspots, readout })
  }
}
