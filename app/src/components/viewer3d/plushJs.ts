// 毛绒材质 + 短绒（shell fur），注入到 viewerHtml / photoBoothHtml 的 <script type="module"> 里。
// 来自 capy3d-kit 的 remix-director skill 第 9 节：
// - 底层：MeshPhysicalMaterial + sheen，ACES 色调映射，亮度（exposure）一个参数控制
// - 短绒只长在"角色本体"：材质遮罩（粗糙、不金属）+ 颜色遮罩（贴图里面积最大的毛绒主色）
// - 短绒细、密、半透明，根暗尖亮，颜色和底层融在一起
// 用法：在模块脚本里 `${PLUSH_JS}` 之后调用 applyPlush(THREE, gltf.scene, { exposure, fur, keyLight })。
export const DEFAULT_EXPOSURE = 0.68; // 预览：越小越暗
export const PHOTO_EXPOSURE = 0.66; // 和真实照片合成时再暗一点，太亮会显得假

const FUR_VS = "uniform float shell,len;varying vec2 vUv;varying vec3 vP;varying vec3 vN;varying vec3 vV;\nvoid main(){vec3 n=normalize(normal);vec3 p=position+n*len*shell;vP=position;vUv=uv;vec4 w=modelMatrix*vec4(p,1.0);\nw.y-=len*0.35*shell*shell;vN=normalize(mat3(modelMatrix)*n);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}";
const FUR_FS = "uniform sampler2D map,mrMap;uniform float shell,density,useMask,useBody,hueTol,exposure;uniform vec3 bodyHsv,keyDir;\nvarying vec2 vUv;varying vec3 vP;varying vec3 vN;varying vec3 vV;\nfloat h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nvoid main(){float plush=1.0;\nif(useMask>0.5){vec3 mr=texture2D(mrMap,vUv).rgb;plush=smoothstep(0.55,0.72,mr.g)*(1.0-smoothstep(0.12,0.3,mr.b));if(plush<0.4)discard;}\nif(useBody>0.5){vec3 cb=texture2D(map,vUv).rgb;float mx=max(cb.r,max(cb.g,cb.b)),mn=min(cb.r,min(cb.g,cb.b)),dl=mx-mn;float hh=0.0;\n if(dl>1e-4){if(mx==cb.r)hh=mod((cb.g-cb.b)/dl,6.0);else if(mx==cb.g)hh=(cb.b-cb.r)/dl+2.0;else hh=(cb.r-cb.g)/dl+4.0;}hh/=6.0;\n float dh=abs(hh-bodyHsv.x);dh=min(dh,1.0-dh);float sat=mx>0.0?dl/mx:0.0;\n plush*=(1.0-smoothstep(hueTol,hueTol+0.03,dh))*smoothstep(0.12,0.22,sat)*smoothstep(bodyHsv.z*0.45,bodyHsv.z*0.6,mx);if(plush<0.4)discard;}\nvec3 q=vP*density;vec3 c=floor(q);vec3 f=fract(q)-0.5;float r=h(c);vec3 off=vec3(h(c+1.3),h(c+2.7),h(c+4.1))-0.5;\nfloat ln=0.55+0.45*r;if(shell>ln)discard;float t=shell/ln;if(length(f-off*0.45)>(1.0-t)*0.62+0.04)discard;\nvec3 base=texture2D(map,vUv).rgb;vec3 N=normalize(vN);float d=max(dot(N,keyDir),0.0);float edge=pow(1.0-abs(dot(N,normalize(vV))),2.2);\nvec3 col=base*(0.6+0.68*d)*mix(0.78,1.08,t)+base*vec3(1.0,0.9,0.76)*edge*(0.35+0.5*t);\ncol*=exposure;col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);\ngl_FragColor=vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),(1.0-t*t)*0.9*plush);}";

export const PLUSH_JS = `
const FUR_SHELLS = 32;
const furVs = ${JSON.stringify(FUR_VS)};
const furFs = ${JSON.stringify(FUR_FS)};
function plushImgData(tex, W = 128) {
  try { const c = document.createElement("canvas"); c.width = c.height = W; const x = c.getContext("2d");
    x.drawImage(tex.image, 0, 0, W, W); return x.getImageData(0, 0, W, W).data; } catch (e) { return null; }
}
function plushHsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d > 0) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; }
  return [h / 6, mx ? d / mx : 0, mx]; }
// 毛绒区域里面积最大的颜色 = 角色本体主色
function plushBodyColor(THREE, map, mr) {
  const a = plushImgData(map), m = mr ? plushImgData(mr) : null; if (!a) return null;
  const bins = new Array(36).fill(0), acc = [];
  for (let i = 0; i < a.length; i += 4) {
    if (m && (m[i + 1] / 255 < 0.6 || m[i + 2] / 255 > 0.2)) continue;
    const [h, s, v] = plushHsv(a[i] / 255, a[i + 1] / 255, a[i + 2] / 255); if (s < 0.15 || v < 0.2) continue;
    const k = Math.floor(h * 36) % 36; bins[k]++; acc.push([k, h, s, v]);
  }
  let best = 0; bins.forEach((n, k) => { if (n > bins[best]) best = k; });
  const sel = acc.filter((x) => Math.abs(x[0] - best) <= 1); if (!sel.length) return null;
  const avg = (i) => sel.reduce((s, x) => s + x[i], 0) / sel.length;
  return new THREE.Vector3(avg(1), avg(2), avg(3));
}
// 返回 { setFur(on), setFurLength(v), setExposure(v) }
function applyPlush(THREE, root, opts) {
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const big = Math.max(size.x, size.y, size.z) || 1;
  const U = { len: { value: (opts.furLength ?? 0.0073) * big }, keyDir: { value: (opts.keyDir || new THREE.Vector3(2.5, 4, 3.5)).clone().normalize() }, exposure: { value: opts.exposure } };
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); }); // 先收集再改，免得把 shell 也当成模型
  const shells = [];
  meshes.forEach((o) => {
    const old = o.material;
    const m = new THREE.MeshPhysicalMaterial({ map: old.map, normalMap: old.normalMap, roughness: 1, metalness: 0,
      sheen: 0.7, sheenRoughness: 0.6, sheenColor: new THREE.Color("#d9a273"), envMapIntensity: 0.3 });
    if (m.normalMap) m.normalScale = new THREE.Vector2(0.6, 0.6);
    o.material = m;
    if (!old.map) return;
    const mr = old.roughnessMap || old.metalnessMap;
    const body = plushBodyColor(THREE, old.map, mr);
    for (let i = 1; i <= FUR_SHELLS; i++) {
      const sm = new THREE.Mesh(o.geometry, new THREE.ShaderMaterial({ vertexShader: furVs, fragmentShader: furFs, transparent: true, depthWrite: false,
        uniforms: { map: { value: old.map }, mrMap: { value: mr || old.map }, useMask: { value: mr ? 1 : 0 }, useBody: { value: body ? 1 : 0 },
          bodyHsv: { value: body || new THREE.Vector3() }, hueTol: { value: 0.06 }, shell: { value: i / FUR_SHELLS },
          len: U.len, keyDir: U.keyDir, exposure: U.exposure, density: { value: 420 / big } } }));
      sm.renderOrder = i; sm.visible = opts.fur !== false; o.add(sm); shells.push(sm);
    }
  });
  return {
    setFur: (on) => shells.forEach((s) => (s.visible = !!on)),
    setExposure: (v) => (U.exposure.value = v),
  };
}

`;
