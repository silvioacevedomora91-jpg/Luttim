/**
 * Lógica principal: interfaz dinámica (independiente de WebGL) + visor 3D opcional.
 * Three.js se carga de forma diferida; si falla, la información sigue disponible.
 */
import { PARASITES, ESTADISTICAS } from "./data.js";

/* =========================== Estado global =========================== */
const state = {
  current: PARASITES[0],
  autoRotate: true,
  wireframe: false,
  model: null,
  ready: false, // motor 3D listo
};

// Referencias 3D (se asignan al cargar Three.js)
let THREE, OrbitControls, buildModel;
let scene, camera, renderer, controls, modelHolder, particles, clock;
let camTarget = 8;

/* =========================== Utilidades DOM =========================== */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const riskClass = (r) => "risk-" + r.toLowerCase().replace(/[^a-z]/g, "");

/* =========================== Interfaz =========================== */
function renderStats() {
  const wrap = document.getElementById("stats");
  ESTADISTICAS.forEach((s) => {
    const card = el("div", "stat");
    card.appendChild(el("div", "stat-value", s.valor));
    card.appendChild(el("div", "stat-label", s.etiqueta));
    wrap.appendChild(card);
  });
}

function renderSelector() {
  const wrap = document.getElementById("selector");
  PARASITES.forEach((p) => {
    const chip = el("button", "chip");
    chip.dataset.id = p.id;
    chip.style.setProperty("--c", p.color);
    chip.style.setProperty("--a", p.acento);
    chip.innerHTML = `
      <span class="chip-dot"></span>
      <span class="chip-text">
        <span class="chip-name">${p.nombre}</span>
        <span class="chip-common">${p.comun}</span>
      </span>`;
    chip.addEventListener("click", () => selectParasite(p.id));
    wrap.appendChild(chip);
  });
}

function renderGallery() {
  const wrap = document.getElementById("gallery");
  PARASITES.forEach((p) => {
    const card = el("article", "card");
    card.style.setProperty("--c", p.color);
    card.style.setProperty("--a", p.acento);
    card.innerHTML = `
      <div class="card-badge">${p.grupo}</div>
      <h3>${p.nombre}</h3>
      <p class="card-common">${p.comun}</p>
      <p class="card-resumen">${p.resumen}</p>
      <div class="card-foot">
        <span class="risk ${riskClass(p.riesgo)}">Riesgo: ${p.riesgo}</span>
        <button class="card-btn">Ver en 3D ›</button>
      </div>`;
    card.querySelector(".card-btn").addEventListener("click", () => {
      selectParasite(p.id);
      document.getElementById("lab").scrollIntoView({ behavior: "smooth" });
    });
    wrap.appendChild(card);
  });
}

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "transmision", label: "Transmisión" },
  { id: "sintomas", label: "Síntomas" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "tratamiento", label: "Tratamiento" },
  { id: "prevencion", label: "Prevención" },
  { id: "taxonomia", label: "Taxonomía" },
];
let activeTab = "resumen";

function listHTML(items) {
  return `<ul class="info-list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

function renderTabContent(p, tab) {
  switch (tab) {
    case "resumen":
      return `
        <p class="lead">${p.resumen}</p>
        <div class="mini-grid">
          <div><span class="mini-k">Morfología</span><p>${p.morfologia}</p></div>
          <div><span class="mini-k">Distribución</span><p>${p.distribucion}</p></div>
        </div>`;
    case "transmision":
      return `<h4>Vías de transmisión</h4>${listHTML(p.transmision)}`;
    case "sintomas":
      return `<h4>Manifestaciones clínicas</h4>${listHTML(p.sintomas)}`;
    case "diagnostico":
      return `<h4>Métodos diagnósticos</h4>${listHTML(p.diagnostico)}`;
    case "tratamiento":
      return `<h4>Tratamiento</h4>${listHTML(p.tratamiento)}`;
    case "prevencion":
      return `<h4>Prevención y control</h4>${listHTML(p.prevencion)}`;
    case "taxonomia":
      return `<h4>Clasificación taxonómica</h4>
        <table class="taxo">${Object.entries(p.taxonomia)
          .map(([k, v]) => `<tr><th>${k}</th><td><em>${v}</em></td></tr>`)
          .join("")}</table>`;
    default:
      return "";
  }
}

function renderInfo() {
  const p = state.current;
  const head = document.getElementById("info-head");
  head.style.setProperty("--c", p.color);
  head.style.setProperty("--a", p.acento);
  head.innerHTML = `
    <div class="info-titles">
      <span class="info-group">${p.grupo}</span>
      <h2>${p.nombre}</h2>
      <p class="info-common">${p.comun}</p>
    </div>
    <span class="risk ${riskClass(p.riesgo)}">${p.riesgo}</span>`;

  const tabsWrap = document.getElementById("tabs");
  tabsWrap.innerHTML = "";
  TABS.forEach((tb) => {
    const b = el("button", "tab" + (tb.id === activeTab ? " active" : ""), tb.label);
    b.addEventListener("click", () => {
      activeTab = tb.id;
      renderInfo();
    });
    tabsWrap.appendChild(b);
  });

  document.getElementById("tab-body").innerHTML = renderTabContent(p, activeTab);
  document.getElementById("info-fact").innerHTML = `<strong>¿Sabías que…?</strong> ${p.dato}`;
}

let activeStage = 0;
function renderLifecycle() {
  const p = state.current;
  const wrap = document.getElementById("lifecycle");
  const ring = document.getElementById("cycle-ring");
  wrap.innerHTML = "";
  ring.innerHTML = "";
  const n = p.cicloVida.length;
  const radius = 140;

  p.cicloVida.forEach((stage, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const node = el("button", "cycle-node" + (i === activeStage ? " active" : ""), `${i + 1}`);
    node.style.setProperty("--c", p.color);
    node.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
    node.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
    node.addEventListener("click", () => {
      activeStage = i;
      renderLifecycle();
    });
    ring.appendChild(node);

    const item = el("button", "cycle-item" + (i === activeStage ? " active" : ""));
    item.style.setProperty("--c", p.color);
    item.innerHTML = `<span class="cycle-num">${i + 1}</span><div><strong>${stage.fase}</strong><p>${stage.desc}</p></div>`;
    item.addEventListener("click", () => {
      activeStage = i;
      renderLifecycle();
    });
    wrap.appendChild(item);
  });

  const center = el("div", "cycle-center");
  center.style.setProperty("--c", p.color);
  center.innerHTML = `<span class="cycle-center-num">${activeStage + 1}</span>
    <strong>${p.cicloVida[activeStage].fase}</strong>
    <p>${p.cicloVida[activeStage].desc}</p>`;
  ring.appendChild(center);
}

/* =========================== Selección =========================== */
function selectParasite(id) {
  const p = PARASITES.find((x) => x.id === id);
  if (!p) return;
  state.current = p;
  activeTab = "resumen";
  activeStage = 0;
  document.querySelectorAll("#selector .chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.id === id);
  });
  renderInfo();
  renderLifecycle();
  document.documentElement.style.setProperty("--accent", p.color);
  document.documentElement.style.setProperty("--accent-2", p.acento);
  if (state.ready) loadModel(p);
}

/* =========================== Motor 3D (diferido) =========================== */
async function setup3D() {
  const viewer = document.getElementById("viewer");
  const loadingEl = document.getElementById("viewer-loading");
  loadingEl.classList.add("active");
  try {
    const three = await import("three");
    const oc = await import("../vendor/OrbitControls.js");
    const models = await import("./models3d.js");
    THREE = three;
    OrbitControls = oc.OrbitControls;
    buildModel = models.buildModel;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.5, 8);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.autoRotateSpeed = 1.2;

    scene.add(new THREE.HemisphereLight(0x8fd4ff, 0x14233a, 0.9));
    const keyL = new THREE.DirectionalLight(0xffffff, 1.6);
    keyL.position.set(4, 6, 5);
    scene.add(keyL);
    const fillL = new THREE.DirectionalLight(0x66ccff, 0.7);
    fillL.position.set(-5, -2, 3);
    scene.add(fillL);
    const rimL = new THREE.PointLight(0xff7ab8, 0.8, 30);
    rimL.position.set(-3, 4, -4);
    scene.add(rimL);

    // partículas de fondo
    const pGeo = new THREE.BufferGeometry();
    const pCount = 260;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 26;
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0x4ea8ff, size: 0.06, transparent: true, opacity: 0.5 })
    );
    scene.add(particles);

    modelHolder = new THREE.Group();
    scene.add(modelHolder);

    clock = new THREE.Clock();
    state.ready = true;
    resize();
    window.addEventListener("resize", resize);
    loadModel(state.current);
    animate();
  } catch (err) {
    console.error("No se pudo iniciar el visor 3D:", err);
    showViewerError();
  }
}

function showViewerError() {
  const stage = document.getElementById("viewer-stage");
  stage.querySelector(".viewer").innerHTML = `
    <div class="viewer-fallback">
      <span class="brand-mark" style="font-size:3rem">🦠</span>
      <h3>Visor 3D no disponible</h3>
      <p>No se pudo cargar el motor gráfico (se requiere conexión y WebGL).<br>
      Toda la información clínica e interactiva sigue disponible más abajo.</p>
    </div>`;
}

function disposeGroup(obj) {
  obj.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

function loadModel(parasite) {
  if (!state.ready) return;
  const loadingEl = document.getElementById("viewer-loading");
  loadingEl.classList.add("active");
  while (modelHolder.children.length) {
    const child = modelHolder.children[0];
    modelHolder.remove(child);
    disposeGroup(child);
  }
  requestAnimationFrame(() => {
    const m = buildModel(parasite.id, parasite.color, parasite.acento);
    state.model = m;
    modelHolder.add(m.group);
    applyWireframe();
    camTarget = m.camDist || 8;
    setTimeout(() => loadingEl.classList.remove("active"), 250);
  });
}

function applyWireframe() {
  if (!state.model) return;
  state.model.group.traverse((c) => {
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => (m.wireframe = state.wireframe));
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  if (state.model) state.model.update(t);
  if (particles) particles.rotation.y = t * 0.02;
  const dir = camera.position.clone().sub(controls.target).normalize();
  const curDist = camera.position.distanceTo(controls.target);
  const newDist = curDist + (camTarget - curDist) * 0.06;
  camera.position.copy(controls.target).addScaledVector(dir, newDist);
  controls.autoRotate = state.autoRotate;
  controls.update();
  renderer.render(scene, camera);
}

function resize() {
  if (!renderer) return;
  const viewer = document.getElementById("viewer");
  const w = viewer.clientWidth || 1;
  const h = viewer.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* =========================== Controles del visor =========================== */
function setupViewerControls() {
  document.getElementById("ctrl-rotate").addEventListener("click", (e) => {
    state.autoRotate = !state.autoRotate;
    e.currentTarget.classList.toggle("on", state.autoRotate);
  });
  document.getElementById("ctrl-wire").addEventListener("click", (e) => {
    state.wireframe = !state.wireframe;
    e.currentTarget.classList.toggle("on", state.wireframe);
    applyWireframe();
  });
  document.getElementById("ctrl-zoom-in").addEventListener("click", () => (camTarget = Math.max(3, camTarget - 1.2)));
  document.getElementById("ctrl-zoom-out").addEventListener("click", () => (camTarget = Math.min(18, camTarget + 1.2)));
  document.getElementById("ctrl-reset").addEventListener("click", () => {
    if (controls) controls.target.set(0, 0, 0);
    camTarget = state.model?.camDist || 8;
  });
  document.getElementById("ctrl-full").addEventListener("click", () => {
    const stage = document.getElementById("viewer-stage");
    if (!document.fullscreenElement) stage.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
}

/* =========================== Navegación / scroll =========================== */
function setupNav() {
  document.querySelectorAll("[data-scroll]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(a.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    });
  });
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("in")),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((n) => io.observe(n));

  const io2 = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.querySelectorAll(".stat-value").forEach((v) => v.classList.add("pop"));
          io2.unobserve(en.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  io2.observe(document.getElementById("stats"));
}

/* =========================== Init =========================== */
function init() {
  renderStats();
  renderSelector();
  renderGallery();
  setupViewerControls();
  setupNav();
  selectParasite(PARASITES[0].id); // pinta la UI de inmediato
  setup3D(); // carga el motor 3D en segundo plano
}
init();
