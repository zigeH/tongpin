// three.js page that runs inside WKWebView. Loads the GLB straight from the Convex URL.
// Messages to the app (window.ReactNativeWebView.postMessage, JSON):
//   { type: "loaded" } | { type: "progress", ratio } | { type: "error", message } | { type: "snapshot", dataUrl, pose }
// Calls from the app: window.capture(), window.setAutoRotate(on)
import type { CameraPose } from "../../lib/backend";
import { DEFAULT_EXPOSURE, PLUSH_JS } from "./plushJs";

const THREE_VERSION = "0.187.0";

export type ViewerOptions = {
  autoRotate: boolean;
  autoRotateSpeed: number;
  interactive: boolean;
  initialPose?: CameraPose;
  // 毛绒效果：短绒开关和亮度（越小越暗）
  fur?: boolean;
  exposure?: number;
};

export function viewerHtml(modelUrl: string, options: ViewerOptions): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; touch-action: none;
               -webkit-user-select: none; -webkit-touch-callout: none; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
} }
</script>
</head>
<body>
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
const OPTIONS = ${JSON.stringify(options)};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = OPTIONS.exposure ?? ${DEFAULT_EXPOSURE};
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff1dd, 0x8a6444, 0.45));
const keyLight = new THREE.DirectionalLight(0xfff1de, 1.2); keyLight.position.set(2.5, 4, 3.5); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xffe0b8, 1.0); rimLight.position.set(-2, 2.5, -4); scene.add(rimLight);
${PLUSH_JS}
let plush = null;
window.setFur = (on) => plush && plush.setFur(on);
window.setExposure = (v) => { renderer.toneMappingExposure = v; plush && plush.setExposure(v); };
const camera = new THREE.PerspectiveCamera(OPTIONS.initialPose ? OPTIONS.initialPose.fov : 40, window.innerWidth / window.innerHeight, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.enabled = OPTIONS.interactive;
controls.autoRotate = OPTIONS.autoRotate;
controls.autoRotateSpeed = OPTIONS.autoRotateSpeed;

let wantAutoRotate = OPTIONS.autoRotate;
let resumeTimer = null;
controls.addEventListener("start", () => {
  controls.autoRotate = false;
  clearTimeout(resumeTimer);
});
controls.addEventListener("end", () => {
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { controls.autoRotate = wantAutoRotate; }, 2500);
});
window.setAutoRotate = (on) => {
  wantAutoRotate = !!on;
  controls.autoRotate = wantAutoRotate;
};

new GLTFLoader().load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);
    try { plush = applyPlush(THREE, model, { exposure: OPTIONS.exposure ?? ${DEFAULT_EXPOSURE}, fur: OPTIONS.fur !== false, keyDir: keyLight.position }); }
    catch (e) { post({ type: "error", message: "plush: " + (e && e.message ? e.message : String(e)) }); }
    camera.near = size / 100;
    camera.far = size * 100;
    controls.minDistance = size * 0.45;
    controls.maxDistance = size * 3;
    const pose = OPTIONS.initialPose;
    if (pose) {
      camera.position.fromArray(pose.position);
      controls.target.fromArray(pose.target);
      camera.fov = pose.fov;
    } else {
      const radius = size / 2;
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.2;
      camera.position.set(0, distance * 0.22, distance).setLength(distance);
      controls.target.set(0, 0, 0);
    }
    camera.updateProjectionMatrix();
    controls.update();
    post({ type: "loaded" });
  },
  (event) => {
    if (event.total) post({ type: "progress", ratio: event.loaded / event.total });
  },
  (error) => {
    post({ type: "error", message: "Couldn't load the 3D model: " + (error && error.message ? error.message : String(error)) });
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
