/**
 * Modelos 3D procedurales de parásitos construidos con Three.js.
 * Cada constructor devuelve { group, update(t), camDist } donde:
 *  - group: THREE.Group con la malla del parásito
 *  - update(t): anima el modelo (flagelos, pseudópodos, reptación...)
 *  - camDist: distancia sugerida de cámara
 */
import * as THREE from "three";

/* ----------------------------- utilidades ----------------------------- */

function bioMaterial(color, { opacity = 1, rough = 0.45, emissive = 0.14, metal = 0.0 } = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: c,
    roughness: rough,
    metalness: metal,
    transparent: opacity < 1,
    opacity,
    emissive: c.clone().multiplyScalar(emissive),
    side: THREE.DoubleSide,
  });
}

// Geometría de revolución a partir de un perfil radius(t), t∈[0,1] a lo largo del eje Y.
function latheProfile(radiusFn, length, { segments = 48, points = 40, yOffset = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const r = Math.max(0.0001, radiusFn(t));
    const y = (t - 0.5) * length + yOffset;
    pts.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(pts, segments);
}

// Tubo de radio variable a lo largo de una columna de puntos (planar u 3D).
function sweepTube(spine, radiusFn, { radialSegments = 16, up = new THREE.Vector3(0, 0, 1) } = {}) {
  const n = spine.length;
  const positions = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(n - 1, i + 1)];
    tangent.subVectors(next, prev).normalize();
    normal.crossVectors(up, tangent);
    if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
    normal.normalize();
    binormal.crossVectors(tangent, normal).normalize();

    const r = Math.max(0.0001, radiusFn(i / (n - 1)));
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(a) * r;
      const sin = Math.sin(a) * r;
      positions.push(
        spine[i].x + cos * normal.x + sin * binormal.x,
        spine[i].y + cos * normal.y + sin * binormal.y,
        spine[i].z + cos * normal.z + sin * binormal.z
      );
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Flagelo animado: tubo ondulante que se reconstruye cada frame.
function makeFlagellum(material, { origin, dir, length, amp = 0.35, freq = 3, phase = 0, taper = 0.05, plane = "xy", segs = 26 }) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  const d = dir.clone().normalize();
  // base perpendicular para la oscilación
  const perp = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(d, perp).normalize();
  const lift = new THREE.Vector3().crossVectors(d, side).normalize();
  function update(t) {
    const spine = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const along = d.clone().multiplyScalar(u * length);
      const wave = Math.sin(u * freq * Math.PI * 2 - t * 6 + phase) * amp * u;
      const wave2 = Math.cos(u * freq * Math.PI * 1.3 - t * 5 + phase) * amp * 0.5 * u;
      const p = new THREE.Vector3().copy(origin).add(along);
      p.addScaledVector(side, wave);
      if (plane === "3d") p.addScaledVector(lift, wave2);
      spine.push(p);
    }
    const geo = sweepTube(spine, (u) => taper * (1 - 0.6 * u) + 0.012, { radialSegments: 8 });
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }
  update(0);
  return { mesh, update };
}

function nucleus(THREE_color, radius, pos, { karyosome = true } = {}) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    bioMaterial(THREE_color, { opacity: 0.55, emissive: 0.05, rough: 0.6 })
  );
  g.add(shell);
  if (karyosome) {
    const kar = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.4, 16, 16),
      bioMaterial("#1a1a2e", { emissive: 0.2 })
    );
    g.add(kar);
  }
  g.position.copy(pos);
  return g;
}

/* ------------------------------- modelos ------------------------------- */

function buildPlasmodium(color, accent) {
  const group = new THREE.Group();
  // glóbulo rojo hospedador (disco bicóncavo translúcido)
  const rbc = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 48, 48),
    bioMaterial("#c1121f", { opacity: 0.22, emissive: 0.06, rough: 0.3 })
  );
  rbc.scale.set(1, 0.42, 1);
  group.add(rbc);
  // hendidura central
  const dimple = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 32, 32),
    bioMaterial("#9d0208", { opacity: 0.18 })
  );
  dimple.scale.set(1, 0.25, 1);
  dimple.position.y = 0.35;
  group.add(dimple);

  // trofozoíto en anillo (forma característica de anillo de sello)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.18, 20, 40), bioMaterial(accent, { emissive: 0.25 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
  // núcleo (el "sello" del anillo)
  const seal = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), bioMaterial("#6a040f", { emissive: 0.3 }));
  seal.position.set(0.85, 0.05, 0);
  group.add(seal);
  // gránulos de pigmento
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), bioMaterial("#22223b"));
    dot.position.set(Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6);
    group.add(dot);
  }
  return {
    group,
    camDist: 7,
    update(t) {
      group.rotation.y = t * 0.4;
      rbc.rotation.z = Math.sin(t) * 0.05;
    },
  };
}

function buildTrypanosoma(color, accent) {
  const group = new THREE.Group();
  const bodyMat = bioMaterial(color, { emissive: 0.18, opacity: 0.95 });
  // cuerpo fusiforme
  const body = new THREE.Mesh(
    latheProfile((t) => Math.pow(Math.sin(Math.PI * t), 0.7) * 0.45, 4.2, { segments: 40 }),
    bodyMat
  );
  body.rotation.z = Math.PI / 2;
  group.add(body);

  // membrana ondulante (cinta lateral animada)
  const membrane = new THREE.Mesh(new THREE.BufferGeometry(), bioMaterial(accent, { opacity: 0.5, emissive: 0.2 }));
  group.add(membrane);

  // núcleo y cinetoplasto
  group.add(nucleus(accent, 0.32, new THREE.Vector3(0.2, 0, 0)));
  const kineto = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bioMaterial("#1a1a2e", { emissive: 0.25 }));
  kineto.position.set(-1.4, 0, 0);
  group.add(kineto);

  // flagelo anterior
  const flag = makeFlagellum(bioMaterial(accent, { emissive: 0.2 }), {
    origin: new THREE.Vector3(2.1, 0, 0),
    dir: new THREE.Vector3(1, 0.05, 0),
    length: 1.6,
    amp: 0.4,
    freq: 2.2,
  });
  group.add(flag.mesh);

  return {
    group,
    camDist: 7.5,
    update(t) {
      group.rotation.y = t * 0.5;
      body.rotation.x = Math.sin(t * 2) * 0.08;
      flag.update(t);
      // reconstruir membrana ondulante a lo largo del cuerpo
      const top = [];
      const bottom = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = (u - 0.5) * 4.0;
        const r = Math.pow(Math.sin(Math.PI * u), 0.7) * 0.45;
        const wave = Math.sin(u * Math.PI * 3 - t * 6) * 0.45 * Math.sin(Math.PI * u);
        bottom.push(x, 0, r * 0.2);
        top.push(x, 0.15 + r + Math.abs(wave), r * 0.2 + wave);
      }
      const pos = [];
      const idx = [];
      for (let i = 0; i <= 30; i++) {
        pos.push(bottom[i * 3], bottom[i * 3 + 1], bottom[i * 3 + 2]);
        pos.push(top[i * 3], top[i * 3 + 1], top[i * 3 + 2]);
      }
      for (let i = 0; i < 30; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      membrane.geometry.dispose();
      membrane.geometry = g;
    },
  };
}

function buildGiardia(color, accent) {
  const group = new THREE.Group();
  const face = new THREE.Group();
  group.add(face);

  // cuerpo piriforme aplanado (forma de "cara")
  const body = new THREE.Mesh(
    latheProfile((t) => {
      // ancho arriba (anterior), termina en punta abajo (cola)
      const tt = 1 - t;
      return Math.sin(Math.PI * Math.min(1, tt * 1.15)) * 1.0 * (0.35 + 0.65 * tt);
    }, 3.0),
    bioMaterial(color, { opacity: 0.92, emissive: 0.16 })
  );
  body.scale.z = 0.42; // aplanado dorsoventral
  face.add(body);

  // dos núcleos = los "ojos"
  const eyeMat = bioMaterial("#0b3d3a", { emissive: 0.25, opacity: 0.9 });
  for (const sx of [-0.42, 0.42]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), eyeMat);
    eye.scale.set(1, 1.2, 0.6);
    eye.position.set(sx, 0.85, 0.32);
    face.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bioMaterial("#02110f"));
    pupil.position.set(sx, 0.85, 0.5);
    face.add(pupil);
  }
  // cuerpos medianos = la "sonrisa"
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 12, 24, Math.PI), eyeMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.05, 0.3);
  face.add(smile);
  // disco adhesivo ventral (anillo tenue)
  const disc = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 12, 40), bioMaterial(accent, { opacity: 0.45 }));
  disc.position.set(0, 0.4, -0.32);
  face.add(disc);

  // 8 flagelos (4 pares)
  const flagMat = bioMaterial(accent, { emissive: 0.2 });
  const flagella = [];
  const flagDefs = [
    { o: [-0.5, 0.9, 0], d: [-0.6, 0.7, 0], len: 1.1 }, // anterolaterales
    { o: [0.5, 0.9, 0], d: [0.6, 0.7, 0], len: 1.1 },
    { o: [-0.4, 0.1, 0], d: [-0.5, 0.2, 0.3], len: 1.0 }, // ventrales
    { o: [0.4, 0.1, 0], d: [0.5, 0.2, 0.3], len: 1.0 },
    { o: [-0.3, -0.6, 0], d: [-0.3, -0.6, 0], len: 1.2 }, // posterolaterales
    { o: [0.3, -0.6, 0], d: [0.3, -0.6, 0], len: 1.2 },
    { o: [-0.12, -1.3, 0], d: [-0.1, -1, 0], len: 1.6 }, // caudales
    { o: [0.12, -1.3, 0], d: [0.1, -1, 0], len: 1.6 },
  ];
  flagDefs.forEach((f, i) => {
    const fl = makeFlagellum(flagMat, {
      origin: new THREE.Vector3(...f.o),
      dir: new THREE.Vector3(...f.d),
      length: f.len,
      amp: 0.28,
      freq: 2,
      phase: i * 0.8,
      plane: "3d",
    });
    face.add(fl.mesh);
    flagella.push(fl);
  });

  return {
    group,
    camDist: 7,
    update(t) {
      group.rotation.y = Math.sin(t * 0.5) * 0.5;
      face.position.y = Math.sin(t * 1.5) * 0.08;
      flagella.forEach((f) => f.update(t));
    },
  };
}

function buildEntamoeba(color, accent) {
  const group = new THREE.Group();
  const detail = 4;
  const geo = new THREE.IcosahedronGeometry(2.0, detail);
  const base = geo.attributes.position.array.slice();
  const body = new THREE.Mesh(geo, bioMaterial(color, { opacity: 0.85, emissive: 0.14, rough: 0.5 }));
  group.add(body);

  // núcleo con cariosoma central excéntrico
  group.add(nucleus("#9c2b1b", 0.5, new THREE.Vector3(0.7, 0.6, 0.4)));
  // eritrocitos fagocitados (hematófago)
  const rbcs = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), bioMaterial("#c1121f", { emissive: 0.1 }));
    r.position.set(Math.cos(i) * 0.8, Math.sin(i * 1.7) * 0.6, Math.cos(i * 2) * 0.7);
    group.add(r);
    rbcs.push(r);
  }

  const pos = geo.attributes.position;
  return {
    group,
    camDist: 7.5,
    update(t) {
      group.rotation.y = t * 0.25;
      // flujo citoplasmático: desplazamiento tipo pseudópodo
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
        const n =
          Math.sin(bx * 1.3 + t * 1.4) * 0.18 +
          Math.cos(by * 1.1 - t * 1.1) * 0.18 +
          Math.sin(bz * 1.5 + t * 0.9) * 0.16;
        const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
        const s = 1 + n / 2;
        pos.array[ix] = bx * s;
        pos.array[ix + 1] = by * s;
        pos.array[ix + 2] = bz * s;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

function buildTaenia(color, accent) {
  const group = new THREE.Group();
  const chain = new THREE.Group();
  group.add(chain);

  // escólex (cabeza) con ventosas y rostelo
  const scolex = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 28), bioMaterial(accent, { emissive: 0.18 }));
  scolex.position.x = -3.4;
  chain.add(scolex);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const sucker = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 12, 20), bioMaterial("#2c3e50"));
    sucker.position.set(-3.55, Math.cos(a) * 0.4, Math.sin(a) * 0.4);
    sucker.rotation.y = Math.PI / 2;
    chain.add(sucker);
  }
  // rostelo con ganchos
  const rostellum = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 18), bioMaterial("#34495e"));
  rostellum.rotation.z = Math.PI / 2;
  rostellum.position.x = -3.85;
  chain.add(rostellum);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), bioMaterial("#1a1a2e"));
    hook.position.set(-4.0, Math.cos(a) * 0.18, Math.sin(a) * 0.18);
    hook.rotation.z = -Math.PI / 2;
    chain.add(hook);
  }

  // proglótides (segmentos) crecientes
  const segMat = bioMaterial(color, { emissive: 0.12, opacity: 0.95 });
  const segs = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const w = 0.35 + (i / count) * 0.55;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), segMat);
    seg.scale.set(0.28, w, w * 0.55);
    seg.position.x = -2.9 + i * 0.42;
    chain.add(seg);
    segs.push(seg);
    // línea genital lateral tenue
    const pore = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), bioMaterial("#2c3e50"));
    pore.position.set(seg.position.x, 0, w * 0.55 + 0.02);
    chain.add(pore);
  }

  return {
    group,
    camDist: 9,
    update(t) {
      group.rotation.y = Math.sin(t * 0.4) * 0.3 + 0.2;
      segs.forEach((s, i) => {
        s.position.y = Math.sin(t * 2 + i * 0.5) * 0.18;
        s.position.z = Math.cos(t * 1.6 + i * 0.4) * 0.12;
      });
    },
  };
}

function buildAscaris(color, accent) {
  const group = new THREE.Group();
  const worm = new THREE.Mesh(new THREE.BufferGeometry(), bioMaterial(color, { emissive: 0.12, rough: 0.4 }));
  group.add(worm);
  const N = 70;
  // línea lateral característica
  const line = new THREE.Mesh(new THREE.BufferGeometry(), bioMaterial("#b5651d", { opacity: 0.6 }));
  group.add(line);

  return {
    group,
    camDist: 8.5,
    update(t) {
      const spine = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = (u - 0.5) * 7.5;
        const y = Math.sin(u * Math.PI * 2.2 - t * 3) * 1.1 * Math.sin(Math.PI * u);
        const z = Math.cos(u * Math.PI * 1.6 - t * 2.4) * 0.5 * Math.sin(Math.PI * u);
        spine.push(new THREE.Vector3(x, y, z));
      }
      const radiusFn = (u) => 0.42 * Math.pow(Math.sin(Math.PI * u), 0.35); // extremos afilados
      const geo = sweepTube(spine, radiusFn, { radialSegments: 18 });
      worm.geometry.dispose();
      worm.geometry = geo;
    },
  };
}

function buildLeishmania(color, accent) {
  const group = new THREE.Group();
  // promastigote: cuerpo fusiforme con flagelo anterior largo
  const body = new THREE.Mesh(
    latheProfile((t) => Math.pow(Math.sin(Math.PI * t), 0.75) * 0.38, 2.6),
    bioMaterial(color, { emissive: 0.18, opacity: 0.95 })
  );
  body.rotation.z = Math.PI / 2;
  group.add(body);
  group.add(nucleus(accent, 0.26, new THREE.Vector3(0.1, 0, 0)));
  const kineto = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), bioMaterial("#1a1a2e", { emissive: 0.25 }));
  kineto.position.set(0.9, 0, 0);
  group.add(kineto);

  const flag = makeFlagellum(bioMaterial(accent, { emissive: 0.22 }), {
    origin: new THREE.Vector3(1.35, 0, 0),
    dir: new THREE.Vector3(1, 0, 0),
    length: 2.2,
    amp: 0.5,
    freq: 2.4,
    plane: "3d",
  });
  group.add(flag.mesh);

  return {
    group,
    camDist: 7,
    update(t) {
      group.rotation.y = t * 0.5;
      body.rotation.x = Math.sin(t * 2) * 0.12;
      flag.update(t);
    },
  };
}

function buildToxoplasma(color, accent) {
  const group = new THREE.Group();
  const taqui = new THREE.Mesh(new THREE.BufferGeometry(), bioMaterial(color, { emissive: 0.18, opacity: 0.95 }));
  group.add(taqui);
  // cuerpo en media luna (taquizoíto), más afilado en el extremo apical
  const N = 50;
  const spine = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = (u - 0.5) * Math.PI * 0.9;
    spine.push(new THREE.Vector3(Math.sin(a) * 2.2, Math.cos(a) * 1.3 - 0.6, 0));
  }
  // radio mínimo > 0 para que el cuerpo no desaparezca y conecte con el complejo apical
  taqui.geometry = sweepTube(
    spine,
    (u) => Math.max(0.08, 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.25)), 0.6)),
    { radialSegments: 20 }
  );
  // complejo apical (extremo anterior puntiagudo), solapado y alineado con la tangente
  const tip = spine[N];
  const apexDir = new THREE.Vector3().subVectors(tip, spine[N - 4]).normalize();
  const apex = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 18), bioMaterial(accent, { emissive: 0.25 }));
  apex.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), apexDir);
  apex.position.copy(tip).addScaledVector(apexDir, 0.12); // base dentro del cuerpo, punta hacia afuera
  group.add(apex);
  // núcleo posterior
  group.add(nucleus(accent, 0.32, new THREE.Vector3(spine[4].x, spine[4].y, 0)));

  return {
    group,
    camDist: 7,
    update(t) {
      group.rotation.y = t * 0.5;
      group.rotation.z = Math.sin(t * 1.5) * 0.12;
    },
  };
}

/* ------------------------------ registro ------------------------------- */

const BUILDERS = {
  plasmodium: buildPlasmodium,
  trypanosoma: buildTrypanosoma,
  giardia: buildGiardia,
  entamoeba: buildEntamoeba,
  taenia: buildTaenia,
  ascaris: buildAscaris,
  leishmania: buildLeishmania,
  toxoplasma: buildToxoplasma,
};

export function buildModel(id, color, accent) {
  const fn = BUILDERS[id] || buildEntamoeba;
  return fn(color, accent);
}
