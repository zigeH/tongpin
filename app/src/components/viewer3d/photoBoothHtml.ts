// 开盒合影页：WebView 里直接开后置摄像头当背景，3D 叠在上面，拍照时在页面里合成一张 JPEG。
// 不用 expo-camera（新原生模块会让 EAS 热更新崩），只靠 WKWebView 的 getUserMedia。
// 手势：单指拖动 = 在地面上移动（往上拖走远变小）；双指 = 缩放 + 旋转。
// App → 页面：window.shoot() | window.setFur(on) | window.setExposure(v) | window.resetModel()
// 页面 → App：{type:"loaded"} | {type:"camera", ok, message?} | {type:"shot", jpeg} | {type:"error", message}
import { PHOTO_EXPOSURE, PLUSH_JS } from "./plushJs";

const THREE_VERSION = "0.187.0";

export function photoBoothHtml(modelUrl: string, options: { exposure?: number; fur?: boolean } = {}): string {
  const exposure = options.exposure ?? PHOTO_EXPOSURE;
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  html, body { margin: 0; height: 100%; background: #2a1c12; overflow: hidden; touch-action: none;
               -webkit-user-select: none; -webkit-touch-callout: none; }
  video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  canvas { position: fixed; inset: 0; display: block; width: 100%; height: 100%; touch-action: none; }
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
} }
</script>
</head>
<body>
<video id="v" playsinline muted autoplay></video>
<script>
  function post(message) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  window.onerror = function (message) { post({ type: "error", message: String(message) }); };
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL_URL = ${JSON.stringify(modelUrl)};
const EXPOSURE = ${JSON.stringify(exposure)};
let furOn = ${options.fur === false ? "false" : "true"};

// ---- 后置摄像头 ----
const video = document.getElementById("v");
(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = stream;
    await video.play().catch(() => {});
    post({ type: "camera", ok: true });
  } catch (e) {
    post({ type: "camera", ok: false, message: e && e.message ? e.message : String(e) });
  }
})();

// ---- 3D ----
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff1dd, 0x8a6444, 0.45));
const keyLight = new THREE.DirectionalLight(0xfff1de, 1.2); keyLight.position.set(2.5, 4, 3.5); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xffe0b8, 1.0); rimLight.position.set(-2, 2.5, -4); scene.add(rimLight);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.55, 4.4); camera.lookAt(0, 0.55, 0);

${PLUSH_JS}
let plush = null;

const holder = new THREE.Group(); scene.add(holder);
// 脚下柔和影子
const sc = document.createElement("canvas"); sc.width = sc.height = 128; const sx = sc.getContext("2d");
const gr = sx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(40,24,12,.55)"); gr.addColorStop(1, "rgba(40,24,12,0)");
sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; holder.add(shadow);

new GLTFLoader().load(MODEL_URL, (gltf) => {
  const g = gltf.scene;
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const s = 1.3 / (size.y || 1); // 统一高度
  const wrap = new THREE.Group(); g.position.set(-ctr.x, -box.min.y, -ctr.z); wrap.add(g); wrap.scale.setScalar(s); holder.add(wrap);
  try { plush = applyPlush(THREE, g, { exposure: EXPOSURE, fur: furOn, keyDir: keyLight.position }); } catch (e) { post({ type: "error", message: "plush: " + e.message }); }
  const fp = Math.max(size.x, size.z) * s; shadow.scale.set(fp * 1.15, fp * 0.9, 1);
  post({ type: "loaded" });
}, undefined, (e) => post({ type: "error", message: "Couldn't load the 3D model: " + (e && e.message ? e.message : String(e)) }));

// ---- 手势 ----
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
const pts = new Map(); let start = null;
const groundAt = (x, y) => { ray.setFromCamera({ x: x / innerWidth * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, camera); return ray.ray.intersectPlane(ground, hit) ? hit.clone() : null; };
function begin() {
  const p = [...pts.values()];
  if (p.length === 1) start = { mode: 1, g: groundAt(p[0].x, p[0].y), pos: holder.position.clone() };
  else if (p.length >= 2) { const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y; start = { mode: 2, d: Math.hypot(dx, dy), a: Math.atan2(dy, dx), s: holder.scale.x, r: holder.rotation.y }; }
  else start = null;
}
function move() {
  if (!start) return; const p = [...pts.values()];
  if (start.mode === 1 && p.length === 1 && start.g) { const g = groundAt(p[0].x, p[0].y);
    if (g) { holder.position.x = start.pos.x + (g.x - start.g.x); holder.position.z = Math.min(1.6, Math.max(-6, start.pos.z + (g.z - start.g.z))); } }
  if (start.mode === 2 && p.length >= 2) { const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y;
    holder.scale.setScalar(Math.min(4, Math.max(0.25, start.s * Math.hypot(dx, dy) / start.d)));
    holder.rotation.y = start.r - (Math.atan2(dy, dx) - start.a); }
}
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); begin(); });
canvas.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); move(); });
["pointerup", "pointercancel"].forEach((t) => canvas.addEventListener(t, (e) => { pts.delete(e.pointerId); begin(); }));

// ---- 拍照合成：当前相机画面（object-fit: cover，和屏幕一致）+ 3D ----
window.shoot = () => {
  try {
    renderer.render(scene, camera);
    const cw = canvas.width, ch = canvas.height, k = Math.min(1, 1440 / cw), W = Math.round(cw * k), H = Math.round(ch * k);
    const out = document.createElement("canvas"); out.width = W; out.height = H; const x = out.getContext("2d");
    if (video.videoWidth) {
      const s = Math.max(W / video.videoWidth, H / video.videoHeight), iw = video.videoWidth * s, ih = video.videoHeight * s;
      x.drawImage(video, (W - iw) / 2, (H - ih) / 2, iw, ih);
    } else { x.fillStyle = "#efe3d0"; x.fillRect(0, 0, W, H); }
    x.drawImage(canvas, 0, 0, W, H);
    post({ type: "shot", jpeg: out.toDataURL("image/jpeg", 0.88) });
  } catch (e) { post({ type: "error", message: "shoot: " + (e && e.message ? e.message : String(e)) }); }
};
window.setFur = (on) => { furOn = !!on; plush && plush.setFur(furOn); };
window.setExposure = (v) => { renderer.toneMappingExposure = v; plush && plush.setExposure(v); };
window.resetModel = () => { holder.position.set(0, 0, 0); holder.scale.setScalar(1); holder.rotation.y = 0; };

window.addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => renderer.render(scene, camera));
</script>
</body>
</html>`;
}
