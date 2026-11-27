// Sereno Dental: the 3D tooth in the hero (three.js).
// The tooth is modelled here, so there is no model file to load.
// If three.js or WebGL isn't available, the drawn SVG tooth in the page stays visible.
(function () {
  "use strict";
  const stage = document.querySelector("[data-tooth3d]");
  if (!stage) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The local copy works when the site is served; the CDN is the fallback when the file is opened directly.
  const load = location.protocol === "file:"
    ? import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js")
    : import("./assets/vendor/three.module.min.js");
  load.then((THREE) => init(THREE)).catch((err) => console.warn("3D tooth unavailable, showing the drawn one.", err));

  /* ---------- The shapes, described as distance fields ---------- */
  const len = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c);
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const ball = (x, y, z, cx, cy, cz, r) => len(x - cx, y - cy, z - cz) - r;
  const box = (x, y, z, cy, hx, hy, hz, r) => {
    const qx = Math.abs(x) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z) - hz;
    return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  // a limb that tapers from radius r1 at (ax, ay, az) to r2 at (bx, by, bz); sx squashes it sideways
  const limb = (x, y, z, ax, ay, az, bx, by, bz, r1, r2, sx = 1) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az, px = x - ax, py = y - ay, pz = z - az;
    const t = Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
    return len((px - dx * t) / sx, py - dy * t, pz - dz * t) - (r1 + (r2 - r1) * t);
  };

  // a molar: broad crown with four rounded cusps, and four separate roots
  const tube = (x, y, z, sx, sz) => {
    // a smoothly curved, tapering root: the nearest of a few points along its bend
    const t = Math.min(1, Math.max(0, (0.22 - y) / 1.84));
    let m = 1e9;
    for (let i = -1; i <= 1; i++) {
      const u = Math.min(1, Math.max(0, t + i * 0.05)), bow = u * (1 - u);
      const r = 0.53 - 0.4 * Math.pow(u, 0.85);
      const d = len(x - sx * (0.55 + 0.5 * bow + 0.06 * u), y - 0.22 + 1.84 * u, z - sz * (0.36 + 0.3 * bow + 0.04 * u)) - r;
      m = i === -1 ? d : smin(m, d, 0.05);
    }
    return m;
  };
  const shell = (x, y, z) => {
    const n = Math.max(0, 0.8 - y), k = 1 + n * n * 0.15;
    let d = box(x * k, y, z * k, 0.52, 0.64, 0.14, 0.44, 0.5);
    d = smin(d, ball(x, y, z, 0.63, 0.88, 0.45, 0.46), 0.19);
    d = smin(d, ball(x, y, z, -0.63, 0.9, 0.45, 0.47), 0.19);
    d = smin(d, ball(x, y, z, 0.62, 0.86, -0.45, 0.45), 0.19);
    d = smin(d, ball(x, y, z, -0.62, 0.85, -0.45, 0.45), 0.19);
    d = smax(d, -ball(x, y, z, 0, 1.58, 0, 0.6), 0.24);
    d = smax(d, -(len(y - 1.32, z) - 0.24), 0.2);
    d = smax(d, -(len(x, y - 1.34) - 0.22), 0.22);
    const g = 1 - Math.min(1, Math.abs(y - 0.85) / 0.75);
    d = smax(d, -(len(x * 1.1, Math.abs(z) - 1.17) - 0.22 * g * g * (3 - 2 * g)), 0.16);
    d = smax(d, -(len(z * 1.1, Math.abs(x) - 1.36) - 0.2 * g * g * (3 - 2 * g)), 0.16);
    const roots = smin(smin(tube(x, y, z, 1, 1), tube(x, y, z, -1, 1), 0.1), smin(tube(x, y, z, 1, -1), tube(x, y, z, -1, -1), 0.1), 0.1);
    return smin(d, roots, 0.2);
  };

  /* ---------- Turn a distance field into a mesh (surface nets) ---------- */
  function meshOf(THREE, field, step, id) {
    const min = [-1.35, -1.95, -1.15], max = [1.35, 1.5, 1.15];
    const n = min.map((m, i) => Math.ceil((max[i] - m) / step) + 1);
    const yy = n[0], zz = n[0] * n[1];
    const at = (i, j, k) => i + n[0] * (j + n[1] * k);
    const f = new Float32Array(n[0] * n[1] * n[2]);
    // in blocks: a block whose middle is far from the surface is filled without looking closer
    const B = 5, far = step * B * 1.35;
    for (let K = 0; K < n[2]; K += B) for (let J = 0; J < n[1]; J += B) for (let I = 0; I < n[0]; I += B) {
      const mid = field(min[0] + (I + 2) * step, min[1] + (J + 2) * step, min[2] + (K + 2) * step);
      const skip = Math.abs(mid) > far;
      for (let k = K; k < Math.min(K + B, n[2]); k++) for (let j = J; j < Math.min(J + B, n[1]); j++) for (let i = I; i < Math.min(I + B, n[0]); i++)
        f[at(i, j, k)] = skip ? mid : field(min[0] + i * step, min[1] + j * step, min[2] + k * step);
    }
    const vert = new Int32Array(f.length).fill(-1);
    const pos = [], nor = [], ids = [], idx = [];
    for (let k = 0; k < n[2] - 1; k++) for (let j = 0; j < n[1] - 1; j++) for (let i = 0; i < n[0] - 1; i++) {
      const q = at(i, j, k), s0 = f[q] < 0;
      if (s0 === (f[q + 1] < 0) && s0 === (f[q + yy] < 0) && s0 === (f[q + yy + 1] < 0) && s0 === (f[q + zz] < 0) && s0 === (f[q + zz + 1] < 0) && s0 === (f[q + zz + yy] < 0) && s0 === (f[q + zz + yy + 1] < 0)) continue;
      let sx = 0, sy = 0, sz = 0, c = 0;
      const v = (p) => f[at(i + p[0], j + p[1], k + p[2])];
      const edge = (p, r) => {
        const a = v(p), b = v(r);
        if ((a < 0) === (b < 0)) return;
        const t = a / (a - b);
        sx += p[0] + (r[0] - p[0]) * t; sy += p[1] + (r[1] - p[1]) * t; sz += p[2] + (r[2] - p[2]) * t; c++;
      };
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        edge([0, a, b], [1, a, b]); edge([a, 0, b], [a, 1, b]); edge([a, b, 0], [a, b, 1]);
      }
      const x = min[0] + (i + sx / c) * step, y = min[1] + (j + sy / c) * step, z = min[2] + (k + sz / c) * step, e = 0.014;
      const nx = field(x + e, y, z) - field(x - e, y, z), ny = field(x, y + e, z) - field(x, y - e, z), nz = field(x, y, z + e) - field(x, y, z - e);
      const l = len(nx, ny, nz) || 1;
      vert[q] = pos.length / 3;
      pos.push(x, y, z); nor.push(nx / l, ny / l, nz / l); ids.push(id ? id(x, y, z, nx / l, ny / l, nz / l) : 0);
    }
    const quad = (a, b, c, d, flip) => (flip ? idx.push(a, c, b, a, d, c) : idx.push(a, b, c, a, c, d));
    for (let k = 1; k < n[2] - 1; k++) for (let j = 1; j < n[1] - 1; j++) for (let i = 1; i < n[0] - 1; i++) {
      const inside = f[at(i, j, k)] < 0;
      if (inside !== (f[at(i + 1, j, k)] < 0)) quad(vert[at(i, j - 1, k - 1)], vert[at(i, j, k - 1)], vert[at(i, j, k)], vert[at(i, j - 1, k)], !inside);
      if (inside !== (f[at(i, j + 1, k)] < 0)) quad(vert[at(i - 1, j, k - 1)], vert[at(i - 1, j, k)], vert[at(i, j, k)], vert[at(i, j, k - 1)], !inside);
      if (inside !== (f[at(i, j, k + 1)] < 0)) quad(vert[at(i - 1, j - 1, k)], vert[at(i, j - 1, k)], vert[at(i, j, k)], vert[at(i - 1, j, k)], !inside);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("aId", new THREE.Float32BufferAttribute(ids, 1));
    geo.setIndex(idx);
    return geo;
  }

  /* ---------- Shaders: polished pale-blue porcelain, lit like a studio product shot ---------- */
  const VERT = /* glsl */ `
    attribute float aId;
    varying vec3 vN; varying vec3 vW; varying float vAo; varying float vY;
    void main() {
      vAo = aId; vY = position.y;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const STUDIO = /* glsl */ `
    float lamp(vec3 d, vec3 l, vec2 size, float soft, float lean) {
      l = normalize(l);
      vec3 a = normalize(cross(vec3(0.0, 1.0, 0.01), l)), b = cross(l, a);
      float k = dot(d, l);
      vec2 q = vec2(dot(d, a), dot(d, b)) / max(k, 0.001);
      q.x += q.y * lean;
      vec2 m = smoothstep(size + soft, size - soft, abs(q));
      return step(0.0, k) * m.x * m.y;
    }
    vec3 studio(vec3 d, float root) {
      vec3 floorC = mix(vec3(0.6, 0.75, 0.92), vec3(0.88, 0.95, 1.0), smoothstep(-0.95, -0.05, d.y));
      vec3 skyC = mix(vec3(0.6, 0.74, 0.91), vec3(0.86, 0.94, 1.0), smoothstep(0.1, 0.95, d.y));
      vec3 c = mix(floorC, skyC, smoothstep(0.07, 0.1, d.y));
      c = mix(c, vec3(0.42, 0.57, 0.77), lamp(d, vec3(-0.38, 0.56, 0.74), vec2(0.62, 0.52), 0.03, -0.1) * 0.8);   // dark flag
      c = mix(c, vec3(1.0), lamp(d, vec3(0.66, 0.54, 0.56), vec2(0.62, 0.44), 0.03, 0.32));                          // big window, right
      c = mix(c, vec3(0.97, 0.99, 1.0), lamp(d, vec3(-1.0, 0.3, 0.12), vec2(0.28, 0.5), 0.04, 0.0));             // window, left
      c = mix(c, vec3(0.52, 0.66, 0.85), lamp(d, vec3(-0.2, -0.42, 0.85), vec2(0.5, 0.3), 0.04, 0.12) * 0.75 * root);   // grey patch on the roots
      c = mix(c, vec3(1.0), lamp(d, vec3(-0.85, -0.3, 0.42), vec2(0.1, 0.6), 0.04, 0.0) * root);                        // and bright edges
      c = mix(c, vec3(1.0), lamp(d, vec3(0.8, -0.32, 0.5), vec2(0.12, 0.6), 0.05, 0.0) * root);
      return c;
    }`;
  const TOOTH = /* glsl */ `
    precision highp float;
    uniform vec3 uCam;
    varying vec3 vN; varying vec3 vW; varying float vAo; varying float vY;
    ${STUDIO}
    void main() {
      vec3 N = normalize(vN), V = normalize(uCam - vW);
      float nv = clamp(dot(N, V), 0.0, 1.0);
      vec3 refl = studio(reflect(-V, N), smoothstep(-0.15, -0.5, vY));
      float wrap = clamp(dot(N, normalize(vec3(0.15, 0.75, 0.65))) * 0.5 + 0.5, 0.0, 1.0);
      vec3 body = mix(vec3(0.54, 0.69, 0.88), vec3(0.96, 0.985, 1.0), smoothstep(0.1, 0.9, wrap));
      vec3 col = mix(body, refl, 0.56 + 0.44 * pow(1.0 - nv, 3.0));
      col = mix(col, vec3(0.45, 0.6, 0.81), smoothstep(0.3, 0.02, nv) * 0.5);
      float ao = smoothstep(0.0, 1.0, vAo);
      col = mix(col * vec3(0.4, 0.5, 0.64), col, ao);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;
  function init(THREE) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      console.warn("WebGL not available, showing the drawn tooth.", e);
      return;
    }
    const small = window.innerWidth < 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    stage.appendChild(renderer.domElement);

    const geo = meshOf(THREE, shell, small ? 0.046 : 0.032, (x, y, z, nx, ny, nz) => {
      const a = shell(x + nx * 0.16, y + ny * 0.16, z + nz * 0.16) / 0.16, b = shell(x + nx * 0.42, y + ny * 0.42, z + nz * 0.42) / 0.42;
      return Math.max(0, Math.min(1, 0.45 * a + 0.55 * b));
    });
    const uCam = { value: new THREE.Vector3() };
    const mat = (frag) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: { uCam } });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
    const tooth = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat(TOOTH));
    mesh.position.y = 0.2;
    tooth.add(mesh);
    const world = new THREE.Group();
    world.add(tooth);
    scene.add(world);

    /* Movement: a slow turn, a small lean towards the mouse, and drag to spin */
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    let spin = 0, spinV = 0, drag = null, time = 0, last = 0, intro = reduceMotion ? 1 : 0, W = 1, H = 1;
    if (!reduceMotion) window.addEventListener("pointermove", (e) => {
      ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    const el = renderer.domElement;
    el.addEventListener("mousedown", (e) => e.preventDefault()); // dragging must not select the text beside it
    el.addEventListener("pointerdown", (e) => { drag = e.clientX; el.setPointerCapture(e.pointerId); stage.classList.add("dragging"); });
    el.addEventListener("pointermove", (e) => {
      if (drag === null) return;
      spinV = (e.clientX - drag) * 0.009;
      spin += spinV;
      drag = e.clientX;
      if (reduceMotion) { draw(0); spinV = 0; }
    });
    const drop = () => { drag = null; stage.classList.remove("dragging"); };
    el.addEventListener("pointerup", drop);
    el.addEventListener("pointercancel", drop);

    function draw(dt) {
      time += dt;
      intro = Math.min(1, intro + dt / 2);
      const e = 1 - Math.pow(1 - intro, 4);
      ptr.x += (ptr.tx - ptr.x) * 0.05;
      ptr.y += (ptr.ty - ptr.y) * 0.05;
      if (drag === null) { spin += spinV; spinV *= 0.94; }
      const scroll = reduceMotion ? 0 : Math.min(window.scrollY / window.innerHeight, 1.2);
      tooth.rotation.y = 0.42 + spin + (1 - e) * -3.2 + Math.sin(time * 0.4) * 0.34 + ptr.x * 0.18 + scroll * 1.4;
      tooth.rotation.x = 0.13 + Math.sin(time * 0.6) * 0.03 + ptr.y * 0.07;
      tooth.rotation.z = -0.02 + Math.sin(time * 0.4) * 0.02;
      tooth.position.y = Math.sin(time * 1.05) * 0.04 + (1 - e) * -0.7;
      tooth.scale.setScalar(0.8 + 0.2 * e);
      renderer.render(scene, camera);
    }

    const resize = () => {
      W = Math.max(1, stage.clientWidth);
      H = Math.max(1, stage.clientHeight);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      const t = Math.tan((camera.fov * Math.PI) / 360);
      let dist, y;
      if (window.innerWidth > 900) {
        // wide screens: sized by height, a little below the middle, the roots reaching past the panel
        dist = Math.max(2.22 / t, 1.62 / (t * camera.aspect));
        y = -dist * t * 0.145;
      } else {
        // phones and tablets: the tooth sits between the name and the button
        const top = stage.getBoundingClientRect().top;
        const edge = (sel, side, fallback) => { const n = document.querySelector(sel); return n ? n.getBoundingClientRect()[side] - top : fallback; };
        const a = edge(".hp-word", "bottom", H * 0.3) - Math.min(46, H * 0.05), b = edge(".hp-foot", "top", H * 0.8) - 14;
        const unit = Math.max(20, Math.min((b - a) / 3.45, (W * 0.86) / 2.75));
        dist = H / (2 * t * unit);
        y = (H / 2 - (a + b) / 2) / unit;
      }
      camera.position.set(0, 0, dist);
      camera.updateProjectionMatrix();
      world.position.y = y;
      uCam.value.copy(camera.position);
      draw(0);
    };

    let visible = false, running = false;
    const step = (now) => {
      if (!visible) { running = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      // wait behind the opening curtain so the first turn is seen
      const root = document.documentElement.classList;
      draw(root.contains("is-loading") && !root.contains("pl-done") ? 0 : dt);
      requestAnimationFrame(step);
    };
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(resize));
    resize();
    stage.classList.add("gl-ready");
    if (reduceMotion) return;
    const run = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); } };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }).observe(stage);
    } else { visible = true; run(); }
  }
})();
