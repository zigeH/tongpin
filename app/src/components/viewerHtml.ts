// three.js 页面，跑在 WKWebView 里。直接用 https 加载 Convex 返回的 GLB。
// 和 App 的通信（window.ReactNativeWebView.postMessage，JSON）：
//   → { type: "loaded" } | { type: "error", message } | { type: "snapshot", dataUrl, pose }
//   ← App 调 window.capture() 请求定格。
const THREE_VERSION = "0.187.0";

export function viewerHtml(modelUrl: string): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; touch-action: none; }
  canvas { display: block; width: 100%; height: 100%; }
  #msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
         font: 14px -apple-system, sans-serif; color: #888; pointer-events: none; }
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
} }
</script>
</head>
<body>
<div id="msg">3D 加载中…</div>
<script>
  function post(message) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  window.onerror = function (message) { post({ type: "error", message: String(message) }); };
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL_URL = ${JSON.stringify(modelUrl)};
const msg = document.getElementById("msg");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

new GLTFLoader().load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);
    camera.near = size / 100;
    camera.far = size * 100;
    camera.position.set(0, size * 0.3, size * 1.2);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
    msg.remove();
    post({ type: "loaded" });
  },
  undefined,
  (error) => {
    msg.textContent = "3D 加载失败";
    post({ type: "error", message: "GLB 加载失败：" + (error && error.message ? error.message : String(error)) });
  },
);

window.capture = () => {
  renderer.render(scene, camera);
  post({
    type: "snapshot",
    dataUrl: renderer.domElement.toDataURL("image/png"),
    pose: { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov },
  });
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
</script>
</body>
</html>`;
}
