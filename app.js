// Three.js Fishing Game
const triggerHaptic = p => { if (navigator.vibrate) navigator.vibrate(p); };
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xa0d2eb, 0.007);
scene.background = new THREE.Color(0x7ec0ee);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.75, 3.5);
camera.lookAt(0, 1.4, -6);
SoundManager.attachCamera(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const container = document.getElementById('game');
container.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';

// Scenic Lighting
const sun = new THREE.DirectionalLight(0xfff5e6, 1.8);
sun.position.set(45, 75, 30);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 250;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0005;
scene.add(sun);

const hemiLight = new THREE.HemisphereLight(0x90d7ff, 0x3b582b, 0.75);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xddeeff, 0.35);
scene.add(ambientLight);

// Lake bed / underwater terrain bowl
const lakeBedGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
const lbPos = lakeBedGeo.attributes.position;
const lbColors = new Float32Array(lbPos.count * 3);
const cDeep = new THREE.Color(0x27311e);
const cMid = new THREE.Color(0x3d5a2d);
const cSand = new THREE.Color(0x8a7a55);
const cGrass = new THREE.Color(0x4f7a35);
const _bedCol = new THREE.Color();
for (let i = 0; i < lbPos.count; i++) {
  const x = lbPos.getX(i);
  const y = lbPos.getY(i); // in plane local space, y is horizontal before rotation
  const dist = Math.hypot(x, y);
  let depth = -3.8;
  if (dist < 18) {
    depth = -2.2 - (dist / 18) * 1.5 + Math.sin(x * 0.3) * 0.2;
  } else if (dist < 32) {
    const t = (dist - 18) / 14;
    depth = -3.7 + t * 4.2 + (Math.sin(x * 0.2) + Math.cos(y * 0.2)) * 0.5;
  } else {
    depth = 0.5 + Math.min(8, (dist - 32) * 0.4) + Math.sin(x * 0.15) * 0.8;
  }
  lbPos.setZ(i, depth);
  // Depth-based tint: deep bowl -> underwater green -> sandy shore -> grass bank
  if (depth < -1) _bedCol.lerpColors(cDeep, cMid, Math.min(1, (depth + 3.8) / 2.8));
  else if (depth < 0.3) _bedCol.lerpColors(cMid, cSand, (depth + 1) / 1.3);
  else _bedCol.lerpColors(cSand, cGrass, Math.min(1, (depth - 0.3) / 2));
  lbColors[i * 3] = _bedCol.r;
  lbColors[i * 3 + 1] = _bedCol.g;
  lbColors[i * 3 + 2] = _bedCol.b;
}
lakeBedGeo.setAttribute('color', new THREE.BufferAttribute(lbColors, 3));
lakeBedGeo.computeVertexNormals();
const lakeBedMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0.05,
  flatShading: true
});
const lakeBedMesh = new THREE.Mesh(lakeBedGeo, lakeBedMat);
lakeBedMesh.rotation.x = -Math.PI / 2;
lakeBedMesh.position.y = -0.05;
lakeBedMesh.receiveShadow = true;
scene.add(lakeBedMesh);

// Wooden Dock Structure (matching player position & dock collision)
const dockGroup = new THREE.Group();
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85, metalness: 0.1 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2715, roughness: 0.9 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 });

// Dock planks
const plankGeo = new THREE.BoxGeometry(3.8, 0.12, 0.42);
for (let z = 1.1; z <= 6.9; z += 0.48) {
  const plank = new THREE.Mesh(plankGeo, woodMat);
  plank.position.set((Math.random() - 0.5) * 0.04, 0.24, z);
  plank.rotation.y = (Math.random() - 0.5) * 0.02;
  plank.castShadow = true;
  plank.receiveShadow = true;
  dockGroup.add(plank);
}
// Support beams
const beamGeo = new THREE.BoxGeometry(0.2, 0.2, 6.2);
const beamL = new THREE.Mesh(beamGeo, darkWoodMat);
beamL.position.set(-1.7, 0.12, 4.0);
beamL.castShadow = true;
dockGroup.add(beamL);
const beamR = beamL.clone();
beamR.position.x = 1.7;
dockGroup.add(beamR);

// Dock pilings (wooden posts into water)
const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 3.2, 10);
const postPositions = [
  [-1.8, 1.2], [1.8, 1.2],
  [-1.8, 3.8], [1.8, 3.8],
  [-1.8, 6.6], [1.8, 6.6]
];
postPositions.forEach(([px, pz]) => {
  const post = new THREE.Mesh(postGeo, darkWoodMat);
  post.position.set(px, -0.4, pz);
  post.castShadow = true;
  post.receiveShadow = true;
  dockGroup.add(post);

  // Rope mooring ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 12), metalMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(px > 0 ? px + 0.1 : px - 0.1, 0.5, pz);
  dockGroup.add(ring);
});

// Dock accessories: wooden crate and bucket
const crateGeo = new THREE.BoxGeometry(0.65, 0.55, 0.65);
const crate = new THREE.Mesh(crateGeo, woodMat);
crate.position.set(1.35, 0.55, 3.0);
crate.rotation.y = 0.35;
crate.castShadow = true;
dockGroup.add(crate);

const bucketGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.35, 12);
const bucket = new THREE.Mesh(bucketGeo, metalMat);
bucket.position.set(-1.3, 0.45, 2.5);
bucket.castShadow = true;
dockGroup.add(bucket);

// Pier lantern with cozy warm light
const lanternMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
const lanternGlassMat = new THREE.MeshBasicMaterial({ color: 0xffe088 });
const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8), lanternMat);
lanternPost.position.set(-1.7, 0.9, 6.7);
dockGroup.add(lanternPost);
const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 8), lanternGlassMat);
lanternGlass.position.set(-1.7, 1.5, 6.7);
dockGroup.add(lanternGlass);
const dockLight = new THREE.PointLight(0xffb84d, 0.8, 8);
dockLight.position.set(-1.7, 1.55, 6.7);
dockGroup.add(dockLight);

scene.add(dockGroup);

// Rolling green background hills
const terrainObjects = [lakeBedMesh];
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const upY = new THREE.Vector3(0, 1, 0);
const _nMat = new THREE.Matrix3();
const _nrm = new THREE.Vector3();

// Per-seed dome noise; fade keeps the rim flat so hills seal into the ground
const makeHillGeo = seed => {
  const g = new THREE.SphereGeometry(25, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fade = 1 - (x * x + z * z) / 625;
    const n =
      Math.sin(x * 0.22 + seed) +
      Math.sin(z * 0.26 - seed * 1.7) +
      Math.sin((x + z) * 0.11 + seed * 2.3) * 0.7;
    p.setXYZ(i, x, y + n * 1.8 * fade, z);
  }
  g.computeVertexNormals();
  return g;
};

const hillGeos = Array.from({ length: 6 }, (_, i) => makeHillGeo(i * 1.37 + 0.5));
const hillColors = [0x2f4c22, 0x3d5a2d, 0x486b32, 0x28421c];
const hillMats = hillColors.map(c => new THREE.MeshStandardMaterial({
  color: c,
  roughness: 0.85,
  flatShading: true
}));

// [n, distMin, distMax, radiusScale, heightScale, baseY, plantable]: foothills + distant ridge
[[6, 62, 86, 1.1, 1.7, 0.45, 0.75, -3, true],
 [16, 105, 165, 2.2, 4.4, 0.6, 1.3, -5, false]].forEach(
  ([n, d0, d1, r0, r1, h0, h1, by, plant]) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * (Math.PI / n);
      const d = d0 + Math.random() * (d1 - d0);
      const h = new THREE.Mesh(
        hillGeos[Math.random() * hillGeos.length | 0],
        hillMats[Math.random() * hillMats.length | 0]
      );
      h.position.set(Math.cos(a) * d, by, Math.sin(a) * d);
      h.scale.set(
        r0 + Math.random() * (r1 - r0),
        h0 + Math.random() * (h1 - h0),
        r0 + Math.random() * (r1 - r0)
      );
      h.rotation.y = Math.random() * Math.PI;
      h.userData.isHill = true;
      h.userData.plant = plant;
      scene.add(h);
      terrainObjects.push(h);
    }
  }
);
scene.updateMatrixWorld(true); // static terrain: one matrix pass is enough for all raycasts

// Distant alpine mountains with snow caps
const mG = new THREE.ConeGeometry(22, 48, 7);
const mPos = mG.attributes.position;

for (let i = 0; i < mPos.count; i++) {
  const x = mPos.getX(i);
  const y = mPos.getY(i);
  const z = mPos.getZ(i);

  if (y < 24) {
    const noise = (Math.sin(x * 0.25) + Math.sin(z * 0.25)) * 3.5;
    mPos.setXYZ(i, x + noise, y, z + noise);
  }
}

mG.computeVertexNormals();

const mColors = [0x3c4c5e, 0x475669, 0x344252, 0x4e586b];
const mMats = mColors.map(c => new THREE.MeshStandardMaterial({
  color: c,
  roughness: 0.85,
  flatShading: true
}));

const sG = new THREE.ConeGeometry(8, 12, 7);
const sM = new THREE.MeshStandardMaterial({
  color: 0xf2f7fa,
  roughness: 0.4,
  flatShading: true
});

for (let i = 0; i < 14; i++) {
  const a = i / 14 * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
  const d = 210 + Math.random() * 90;

  const m = new THREE.Mesh(mG, mMats[i % mMats.length]);

  m.position.set(
    Math.cos(a) * d,
    14 + Math.random() * 8,
    Math.sin(a) * d
  );

  m.scale.set(
    1.6 + Math.random() * 1.2,
    1.1 + Math.random() * 1.1,
    1.6 + Math.random() * 1.2
  );

  m.rotation.y = Math.random() * Math.PI * 2;

  scene.add(m);
  terrainObjects.push(m);

  if (Math.random() > 0.15) {
    const snow = new THREE.Mesh(sG, sM);

    snow.position.set(
      m.position.x,
      m.position.y + m.scale.y * 22,
      m.position.z
    );

    snow.scale.set(
      m.scale.x * 0.72,
      m.scale.y * 0.72,
      m.scale.z * 0.72
    );

    snow.rotation.y = m.rotation.y;
    scene.add(snow);
  }
}

const trunkM = new THREE.MeshStandardMaterial({
  color: 0x3d2b1f,
  roughness: 0.9
});

const foliageColors = [
  0x1a5e1a,
  0x228b22,
  0x2d5a2d,
  0x3a7a3a,
  0x0f4a0f,
  0x347a2a
];

const foliageMaterials = foliageColors.map(color =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8
  })
);

function createTree(x, z, onHill = false) {
  const group = new THREE.Group();

  const d = Math.hypot(x, z);
  const baseScale = 1.0 + Math.random() * 2.5;
  const isNearWater = d < 35;

  const trunkHeight = isNearWater ? 6 : 2;

  const trunkRadius =
    0.2 * (onHill ? 1 : (1 + (baseScale - 1) * 0.5));

  const trunkGeo = new THREE.CylinderGeometry(
    trunkRadius,
    trunkRadius * 1.5,
    trunkHeight,
    8
  );

  const trunk = new THREE.Mesh(trunkGeo, trunkM);

  trunk.position.y = isNearWater
    ? trunkHeight / 2 - 1.5
    : trunkHeight / 2;

  trunk.castShadow = true;
  trunk.receiveShadow = true;

  group.add(trunk);

  const layers = 3 + (Math.random() * 3 | 0);
  const material =
    foliageMaterials[
      Math.random() * foliageMaterials.length | 0
    ];

  for (let j = 0; j < layers; j++) {
    const layerG = new THREE.ConeGeometry(
      2 - j * 0.4,
      3 - j * 0.2,
      8
    );

    const foliage = new THREE.Mesh(layerG, material);

    foliage.position.y =
      (isNearWater ? trunkHeight - 1.5 : trunkHeight)
      + j * 1.2;

    foliage.castShadow = true;
    foliage.receiveShadow = true;

    group.add(foliage);
  }

  group.scale.set(baseScale, baseScale, baseScale);

  // Raycast down onto terrain so every tree roots at the true surface height
  raycaster.set(new THREE.Vector3(x, 150, z), down);
  const hit = raycaster.intersectObjects(terrainObjects)[0];
  if (!hit) return;

  if (onHill) {
    // Must land on the intended hill dome, not the lake bed or a neighbor
    if (!hit.object.userData.isHill) return;
    // Keep clear of the waterline so foothill trees stay on dry slopes
    if (d < 30) return;
  }

  // Reject steep slopes that would tip the tree
  _nMat.getNormalMatrix(hit.object.matrixWorld);
  _nrm.copy(hit.face.normal).applyMatrix3(_nMat).normalize();
  if (_nrm.y < 0.72) return;

  // Sink the trunk base slightly below the surface so trees root into the
  // terrain instead of floating or clipping through it
  const yPos = hit.point.y - 0.15 * baseScale;

  group.position.set(x, yPos, z);
  group.rotation.y = Math.random() * Math.PI * 2;

  scene.add(group);
}

// Trees: lakeside ring + scattered across plantable foothill surfaces
for (let i = 0; i < 64; i++) {
  const a = Math.random() * Math.PI * 2;
  const d = 25 + Math.random() * 35;
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (z > 0 && Math.abs(x) < 7 && d < 35) continue; // keep dock sightline clear
  createTree(x, z);
}

const foothills = terrainObjects.filter(o => o.userData.plant);
// Hill surface: y = baseY + sqrt(R² - r²) * scaleY. Only plant where the dome
// rises above the lake-bed bank (y ≈ 8.5) so trees sit on visible slopes.
const BANK_Y = 8.5;
for (let i = 0; i < 44; i++) {
  const h = foothills[i % foothills.length];
  const emerge = (BANK_Y - h.position.y) / h.scale.y;
  if (emerge >= 25) continue; // dome stays buried under the bank
  const rMax = Math.sqrt(625 - emerge * emerge);
  const r = Math.sqrt(Math.random()) * rMax * 0.9, t = Math.random() * Math.PI * 2;
  createTree(
    h.position.x + Math.cos(t) * r * h.scale.x,
    h.position.z + Math.sin(t) * r * h.scale.z,
    true
  );
}

// Grass tufts on plantable hill slopes
const grassGeo = new THREE.ConeGeometry(0.12, 0.5, 5);
const grassMats = [0x4f7a35, 0x5d8a3a, 0x6b9a45].map(c =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })
);
for (let i = 0; i < 60; i++) {
  const h = foothills[i % foothills.length];
  const emerge = (BANK_Y - h.position.y) / h.scale.y;
  if (emerge >= 25) continue;
  const rMax = Math.sqrt(625 - emerge * emerge);
  const r = Math.sqrt(Math.random()) * rMax * 0.95, t = Math.random() * Math.PI * 2;
  const gx = h.position.x + Math.cos(t) * r * h.scale.x;
  const gz = h.position.z + Math.sin(t) * r * h.scale.z;
  raycaster.set(new THREE.Vector3(gx, 150, gz), down);
  const gHit = raycaster.intersectObjects(terrainObjects)[0];
  if (!gHit || !gHit.object.userData.isHill) continue;
  const tuft = new THREE.Mesh(grassGeo, grassMats[i % grassMats.length]);
  tuft.position.set(gx, gHit.point.y + 0.22, gz);
  tuft.rotation.y = Math.random() * Math.PI;
  tuft.scale.setScalar(0.7 + Math.random() * 0.9);
  scene.add(tuft);
}

// Shore rocks (20)
const rocksNearShore = [];

const rG = new THREE.DodecahedronGeometry(0.8, 0);
const rM = new THREE.MeshStandardMaterial({
  color: 0x666666,
  roughness: 0.8
});

for (let i = 0; i < 20; i++) {
  const a = Math.random() * Math.PI * 2;
  const d = 8 + Math.random() * 12;

  const r = new THREE.Mesh(rG, rM);

  r.position.set(
    Math.cos(a) * d,
    0.2,
    Math.sin(a) * d
  );

  r.scale.set(
    0.5 + Math.random() * 1.5,
    0.3 + Math.random() * 0.8,
    0.5 + Math.random() * 1.5
  );

  r.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  r.castShadow = r.receiveShadow = true;

  scene.add(r);
  rocksNearShore.push(r);
}

// Underwater rocks and bushes on the lake floor
const uRockG = new THREE.DodecahedronGeometry(0.8, 0), uRockM = new THREE.MeshStandardMaterial({ color: 0x5a4f3d, roughness: 0.9 });
for (let i = 0; i < 25; i++) {
  const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 18;
  const r = new THREE.Mesh(uRockG, uRockM);
  r.position.set(Math.cos(a) * d, -0.9, Math.sin(a) * d);
  r.scale.set(0.4 + Math.random(), 0.3 + Math.random() * 0.5, 0.4 + Math.random());
  r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(r);
}
const uBushG = new THREE.SphereGeometry(0.3, 8, 6), uBushM = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.7 });
for (let i = 0; i < 18; i++) {
  const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 16;
  const b = new THREE.Mesh(uBushG, uBushM);
  b.position.set(Math.cos(a) * d, -0.7, Math.sin(a) * d);
  b.scale.set(0.5 + Math.random(), 0.4 + Math.random() * 0.6, 0.5 + Math.random());
  scene.add(b);
}

// Reeds near dock (30 reeds, avoiding front view)
const rdG = new THREE.CylinderGeometry(
  0.02, 0.04, 2, 4
);

const rdM = new THREE.MeshStandardMaterial({
  color: 0x6b8e23,
  roughness: 0.7
});

for (let i = 0; i < 30; i++) {
  const a = Math.random() * Math.PI * 2;
  const d = 5 + Math.random() * 4;

  const x = Math.cos(a) * d;
  const z = Math.sin(a) * d;

  if (z < 2 && Math.abs(x) < 2) continue;

  const reed = new THREE.Mesh(rdG, rdM);

  reed.position.set(x, 1, z);
  reed.rotation.z =
    (Math.random() - 0.5) * 0.2;

  scene.add(reed);
}

// Lily pads on water (15 lily pads, avoiding front view)
const pG = new THREE.CircleGeometry(0.4, 8);

const pM = new THREE.MeshStandardMaterial({
  color: 0x2d5a2d,
  side: THREE.DoubleSide,
  roughness: 0.6
});

for (let i = 0; i < 15; i++) {
  const a = Math.random() * Math.PI * 2;
  const d = 3 + Math.random() * 8;

  const x = Math.cos(a) * d;
  const z = Math.sin(a) * d;

  if (z < 2 && Math.abs(x) < 2) continue;

  const pad = new THREE.Mesh(pG, pM);

  pad.position.set(x, 0.05, z);
  pad.rotation.x = -Math.PI / 2;

  scene.add(pad);
}

const fishColors = [0xff6b35, 0xffd700, 0x4169e1, 0x32cd32, 0xff1493, 0x00ced1];
const fish = [];

function createFish(color, size) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 100 });
  
  // Body: Tapered shape using LatheGeometry for a more natural fish silhouette
  const points = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    // Tapered profile: narrow at nose, wide at 0.3, narrow at tail
    const r = size * 0.5 * Math.sin(t * Math.PI * 0.8 + 0.2);
    points.push(new THREE.Vector2(r, (t - 0.5) * size * 2.5));
  }
  const bodyGeom = new THREE.LatheGeometry(points, 12);
  const body = new THREE.Mesh(bodyGeom, mat);
  body.rotation.z = Math.PI / 2;
  group.add(body);

  // Tail fin: More elegant triangular shape
  const tailGeom = new THREE.ConeGeometry(size * 0.7, size * 1.2, 3);
  tailGeom.scale(0.1, 1, 1.2); // Flatten it
  const tail = new THREE.Mesh(tailGeom, mat);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = size * 1.3;
  group.add(tail);
  group.userData.tail = tail;
  group.userData.mat = mat;
  group.userData.segs = [];

  // Dorsal fin: Tapered and swept back
  const dorsalGeom = new THREE.ConeGeometry(size * 0.2, size * 0.8, 3);
  dorsalGeom.scale(0.1, 1, 1);
  const dorsal = new THREE.Mesh(dorsalGeom, mat);
  dorsal.position.set(-size * 0.1, size * 0.5, 0);
  dorsal.rotation.z = 0.4;
  group.add(dorsal);

  // Pectoral fins: Smaller and angled
  const finMat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.7 });
  const pfinGeom = new THREE.BoxGeometry(size * 0.5, size * 0.02, size * 0.4);
  const pfin = new THREE.Mesh(pfinGeom, finMat);
  pfin.position.set(-size * 0.5, -size * 0.2, size * 0.5);
  pfin.rotation.set(0.5, 0, 0.5);
  group.add(pfin);
  const pfin2 = pfin.clone();
  pfin2.position.z = -size * 0.5;
  pfin2.rotation.x = -0.5;
  group.add(pfin2);

  // Eyes: Slightly larger and more forward
  const eyeMat = new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 100 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.14, 8, 8), eyeMat);
  eye.position.set(-size * 1.05, size * 0.15, size * 0.3);
  group.add(eye);
  const eye2 = eye.clone();
  eye2.position.z = -size * 0.3;
  group.add(eye2);

  return group;
}

function spawnAmbientFish() {
  const size = 0.15 + Math.random() * 0.35;
  const f = createFish(fishColors[Math.floor(Math.random() * fishColors.length)], size);
  f.userData = {
    ...f.userData,
    radius: 8 + Math.random() * 25,
    speed: 0.3 + Math.random() * 0.5,
    angle: Math.random() * Math.PI * 2,
    depth: -1 - Math.random() * 3,
    bobSpeed: 1 + Math.random() * 2,
    bobAmp: 0.2 + Math.random() * 0.3,
    tailPhase: Math.random() * Math.PI * 2,
    size
  };
  scene.add(f);
  fish.push(f);
  return f;
}
for (let i = 0; i < 18; i++) spawnAmbientFish();

for (let i = 0; i < 30; i++) {
  const f = createFish(0xcccccc, 0.08);
  f.userData = {
    ...f.userData,
    radius: 15 + Math.random() * 10,
    speed: 0.8 + Math.random() * 0.4,
    angle: Math.random() * Math.PI * 2,
    depth: -0.5 - Math.random() * 1.5,
    bobSpeed: 2 + Math.random() * 2,
    bobAmp: 0.1,
    tailPhase: Math.random() * Math.PI * 2,
    school: true
  };
  scene.add(f);
  fish.push(f);
}

// Rod, line, bobber
const rod = new THREE.Group();
const corkMat = new THREE.MeshPhongMaterial({ color: 0x8B5A2B, shininess: 20 });
const blankMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 70, specular: 0x666666 });
const reelMat = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 90, specular: 0xbbbbbb });
const spoolMat = new THREE.MeshPhongMaterial({ color: 0xcc2222, shininess: 60 });
const guideMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 120, specular: 0xffffff });

const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.75, 14), corkMat);
handle.position.y = -0.375;
rod.add(handle);

const buttCap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 14), reelMat);
buttCap.position.y = -0.78;
rod.add(buttCap);

const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.13, 2.0, 12), blankMat);
blank.position.y = 1.0;
rod.add(blank);

const reelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 18), reelMat);
reelBody.rotation.z = Math.PI / 2;
reelBody.position.set(0.24, -0.2, 0);
rod.add(reelBody);

const reelSpool = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 18), spoolMat);
reelSpool.rotation.z = Math.PI / 2;
reelSpool.position.set(0.24, -0.2, 0);
rod.add(reelSpool);

const reelHandle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), guideMat);
reelHandle.position.set(0.32, -0.2, 0.08);
rod.add(reelHandle);

for (let i = 0; i < 5; i++) {
  const t = i / 4;
  const y = 0.25 + t * 1.7;
  const size = 0.05 - t * 0.03;
  const guide = new THREE.Mesh(new THREE.TorusGeometry(size, 0.008, 6, 12), guideMat);
  guide.position.set(0, y, 0);
  guide.rotation.x = Math.PI / 2;
  rod.add(guide);
}

const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), guideMat);
tipCap.position.y = 2.0;
rod.add(tipCap);

rod.position.set(0.6, 1.3, 2.8);
rod.rotation.z = -0.15;
rod.rotation.x = -1.3;
scene.add(rod);

const isMobile = matchMedia('(max-width:768px)').matches;
if (isMobile) {
  rod.position.set(0.15, 1.2, 2.6);
  rod.rotation.z = -0.08;
}

const lineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0.8, 1.8, 3.5), new THREE.Vector3(0.8, 1.8, 3.5), new THREE.Vector3(0.8, 1.8, 3.5)
]);
const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
const line = new THREE.Line(lineGeo, lineMat);
scene.add(line);

const bobber = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 8, 8),
  new THREE.MeshPhongMaterial({ color: 0xff2222, shininess: 80 })
);
bobber.visible = false;
scene.add(bobber);

const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
const ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 24), rippleMat);
ripple.rotation.x = -Math.PI / 2;
ripple.visible = false;
scene.add(ripple);

const splashGeo = new THREE.SphereGeometry(0.08, 6, 6);
function spawnSplash(x, z, count = 14, color = 0xffffff) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(splashGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    m.position.set(x, 0.1, z);
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 3;
    m.userData = { vx: Math.cos(a) * sp * 0.6, vy: sp, vz: Math.sin(a) * sp * 0.6, life: 0.8 + Math.random() * 0.4 };
    scene.add(m);
    particles.push(m);
  }
}

function spawnLandDust(x, y, z, count = 10, isWood = false) {
  const col = isWood ? 0xb08958 : 0x7c6a46;
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(splashGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
    m.position.set(x + (Math.random() - 0.5) * 0.2, y + 0.05, z + (Math.random() - 0.5) * 0.2);
    const a = Math.random() * Math.PI * 2;
    const sp = 1.2 + Math.random() * 2.2;
    m.userData = { vx: Math.cos(a) * sp * 0.5, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * sp * 0.5, life: 0.4 + Math.random() * 0.35 };
    scene.add(m);
    particles.push(m);
  }
}

function playBounceSound(isWood = false, intensity = 1) {
  try {
    const ctx = window.AudioContext ? (window.__audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()) : null;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isWood ? 'triangle' : 'sine';
    const baseFreq = isWood ? 240 : 160;
    osc.frequency.setValueAtTime(baseFreq * (0.8 + intensity * 0.4), ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(Math.min(0.25, 0.15 * intensity), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}

function playSplashSound(x, y, z) {
  // Kept for existing call sites; playback now handled by the shared Sound layer.
  SoundManager.play('splash', { x, y, z });
}

function getWaterSurfaceY(x, z, timeVal) {
  return Math.sin(timeVal * 1.5 + x * 0.2 + z * 0.2) * 0.15 + Math.cos(timeVal * 2 + x * 0.1) * 0.1;
}

function getGroundElevation(x, z) {
  let elevation = -999;
  let isDock = false;
  let isRock = false;

  // Dock bounding check: dock is at (0, 0.15, 4), width 4 (x: -2 to 2), length 6 (z: 1 to 7), top surface y = 0.30
  if (Math.abs(x) <= 2.05 && z >= 0.95 && z <= 7.05) {
    elevation = Math.max(elevation, 0.30);
    isDock = true;
  }

  // Shore rocks check
  for (let i = 0; i < rocksNearShore.length; i++) {
    const r = rocksNearShore[i];
    const dx = x - r.position.x;
    const dz = z - r.position.z;
    const distSq = dx * dx + dz * dz;
    const radius = Math.max(r.scale.x, r.scale.z) * 0.8;
    if (distSq < radius * radius) {
      const rockTop = r.position.y + r.scale.y * 0.7;
      if (rockTop > elevation) {
        elevation = rockTop;
        isRock = true;
      }
    }
  }

  // Terrain / hills check
  if (terrainObjects.length > 0) {
    raycaster.set(new THREE.Vector3(x, 100, z), down);
    const hits = raycaster.intersectObjects(terrainObjects);
    if (hits.length > 0 && hits[0].point.y > elevation) {
      elevation = hits[0].point.y;
    }
  }

  // Shore bank: beyond lake basin (d >= 24)
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter >= 24) {
    const bankH = Math.min(6, (distFromCenter - 24) * 0.35 + 0.05);
    elevation = Math.max(elevation, bankH);
  }

  return { elevation, isDock, isRock, isLand: elevation >= 0 };
}

const clouds = [];
const cloudMat = new THREE.MeshPhongMaterial({ color: 0xf4f6ff, transparent: true, opacity: 0.85 });
for (let i = 0; i < 10; i++) {
  const g = new THREE.Group();
  const puffs = 5 + Math.floor(Math.random() * 3);
  for (let p = 0; p < puffs; p++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(2.4 + Math.random() * 2.6, 12, 8), cloudMat);
    s.position.set((p - (puffs - 1) / 2) * (2.0 + Math.random() * 0.9), Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
    s.scale.y = 0.4 + Math.random() * 0.2;
    g.add(s);
  }
  g.position.set((Math.random() - 0.5) * 160, 20 + Math.random() * 20, -30 - Math.random() * 70);
  g.userData = { speed: 0.4 + Math.random() * 0.5 };
  scene.add(g);
  clouds.push(g);
}

// Weather system: Clear, Rain, Foggy
const WEATHER_TYPES = ['Clear', 'Rain', 'Foggy'];
const WEATHER_ICONS = { Clear: '🌤', Rain: '🌧', Foggy: '🌫' };
let currentWeather = 'Clear';
let weatherTimer = 12 + Math.random() * 10;
let curFogDensity = 0.008;

function setWeather(w) {
  currentWeather = w;
  rain.visible = (w === 'Rain');
  const rs = SoundManager.get('rain1');
  if (w === 'Rain') { if (rs && !rs.voices.size) rs.play(); }
  else if (rs) rs.stop();
  const wEl = $('weather');
  const wIcon = $('weatherIcon');
  if (wEl) wEl.textContent = w;
  if (wIcon) wIcon.textContent = WEATHER_ICONS[w] || '🌤';
}

function pickNextWeather() {
  const others = WEATHER_TYPES.filter(w => w !== currentWeather);
  return others[Math.floor(Math.random() * others.length)];
}

const RAIN_COUNT = 600;
const rainPos = new Float32Array(RAIN_COUNT * 3);
const rainVel = new Float32Array(RAIN_COUNT);
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({ color: 0x9db8d0, size: 0.08, transparent: true, opacity: 0.7 });
const rain = new THREE.Points(rainGeo, rainMat);
rain.visible = false;
scene.add(rain);

// Low-lying fog mist puffs
const FOG_PUFF_COUNT = 30;
const fogPuffs = [];
const fogPuffGeo = new THREE.PlaneGeometry(12, 6);
const fogPuffTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const fogPuffMat = new THREE.MeshBasicMaterial({
  color: 0xd6e6f2,
  map: fogPuffTex,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide
});
for (let i = 0; i < FOG_PUFF_COUNT; i++) {
  const m = new THREE.Mesh(fogPuffGeo, fogPuffMat.clone());
  m.rotation.x = -Math.PI * 0.45;
  m.position.set(
    (Math.random() - 0.5) * 70,
    0.2 + Math.random() * 1.2,
    -5 - Math.random() * 45
  );
  m.userData = {
    baseX: m.position.x,
    speed: 0.4 + Math.random() * 0.6,
    baseOpacity: 0.15 + Math.random() * 0.15,
    phase: Math.random() * Math.PI * 2
  };
  scene.add(m);
  fogPuffs.push(m);
}

function resetRainDrop(i) {
  rainPos[i * 3] = (Math.random() - 0.5) * 80;
  rainPos[i * 3 + 1] = 10 + Math.random() * 20;
  rainPos[i * 3 + 2] = -10 - Math.random() * 60;
  rainVel[i] = 18 + Math.random() * 10;
}
for (let i = 0; i < RAIN_COUNT; i++) resetRainDrop(i);

// Lightning system
const boltGeo = new THREE.BufferGeometry();
const boltMat = new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.9 });
const bolt = new THREE.Line(boltGeo, boltMat);
bolt.visible = false;
scene.add(bolt);
const flash = new THREE.PointLight(0xcfe8ff, 0, 200);
  flash.position.set(0, 30, -30);
  scene.add(flash);
  let boltTimer = 0, boltLife = 0;
function strikeLightning() {
  const x = (Math.random() - 0.5) * 50, z = -10 - Math.random() * 40;
  const segs = 8, pts = [];
  let y = 30;
  for (let i = 0; i <= segs; i++) {
    pts.push(new THREE.Vector3(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3));
    y -= 30 / segs;
  }
  boltGeo.setFromPoints(pts);
  bolt.visible = true;
  flash.position.set(x, 20, z);
  flash.intensity = 3;
  boltLife = 0.12;
  SoundManager.play('thunder', { x, y: 20, z });
}

const birds = [];
const birdGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.2, 0, 0), new THREE.Vector3(0, 0, 0.1), new THREE.Vector3(0.2, 0, 0)]);
const birdMat = new THREE.LineBasicMaterial({ color: 0x000000 });
function spawnBird() {
  const b = new THREE.Line(birdGeo, birdMat);
  const far = Math.random() < 0.6;
  const z = far ? -30 - Math.random() * 40 : -8 - Math.random() * 12;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const t = (z - camera.position.z) / dir.z;
  const hh = Math.tan(camera.fov * Math.PI / 360) * t;
  const hw = hh * camera.aspect;
  const cx = camera.position.x + dir.x * t;
  const cy = camera.position.y + dir.y * t;
  const side = Math.random() > 0.5 ? 1 : -1;
  const yOff = far ? hh * (0.4 + Math.random() * 0.5) : (Math.random() * 2 - 1) * hh * 0.3;
  b.position.set(cx + side * (hw + 1), cy + yOff, z);
  const s = far ? 0.2 + Math.random() * 0.4 : 1.5 + Math.random() * 2;
  b.scale.set(s, s, s);
  b.userData = { vx: (far ? 1 + Math.random() * 1.5 : 3 + Math.random() * 4) * -side, phase: Math.random() * Math.PI * 2, exitX: cx - side * (hw + 1) };
  scene.add(b);
  birds.push(b);
}

// Game state
const S = { IDLE: 0, CHARGING: 1, CASTING: 2, WAITING: 3, NIBBLE: 4, BITE: 5, REELING: 6, RESULT: 7, LAND: 8 };
let state = S.IDLE;
let aim = 0.5, aimDir = 1, power = 0;
let bobberX = 0, bobberZ = 0;
let castT = 0;
let hapticT = 0;
const CAST_DURATION = 0.6;
let bobberPos = new THREE.Vector3();
let bobberVel = new THREE.Vector3();
let bounceCount = 0;
let biteTimer = 0, biteWindow = 0, biteActive = false, fakeBite = false;
let currentFish = null, lastCatch = null, hookedFish = null, nibbleFish = null;
let tension = 0, stamina = 0, reel = 0, adrenaline = 0, escapeProgress = 0, initialReelDist = 0;
let dashTimer = 0, isDashing = false, dashDuration = 0, maxStamina = 100;
let fightBackTimer = 0, fightStamina = 0, isFightingBack = false, fightBackDuration = 0;
let oscPhaseA = 0, oscPhaseB = 0;
const fightBackDir = { x: 0, z: 0 };
let reeling = false, gear = 1, reelLockout = 0, canReel = false;
let reelSoundOn = false;
/* Loop reelsound1.wav only while the input is held; stop on release/pause or while the fish fights back. */
const syncReelSound = () => {
  /* Reel audio yields to the fight so the fish's pull is audible, then resumes if input is still held. */
  const on = canReel && state === S.REELING && !isFightingBack && !isGamePaused;
  if (on === reelSoundOn) return;
  reelSoundOn = on;
  const s = SoundManager.get('reel');
  on ? s.play() : s.stop();
};
let coins = 0, caught = [], records = {}, bait = 'Worm', equippedRod = 'Starter Rod', ownedRods = ['Starter Rod'];
let shake = 0, shakeIntensity = 0;
let jiggleT = 0, jiggleCooldown = 0, waitingWithoutProdTimer = 0;
const particles = [];
let dayTime = 0;
const ROD = {
  [S.IDLE]:     { x: -1.3,  z: -0.15 },
  [S.CHARGING]: { x: -1.0,  z: -0.15 },
  [S.CASTING]:  { x: -1.55, z: -0.15 },
  [S.WAITING]:  { x: -1.4,  z: -0.15 },
  [S.NIBBLE]:   { x: -1.45, z: -0.10 },
  [S.BITE]:     { x: -1.5,  z: -0.05 },
  [S.REELING]:  { x: -1.35, z: -0.15 },
  [S.RESULT]:   { x: -1.3,  z: -0.15 },
  [S.LAND]:     { x: -1.3,  z: -0.15 }
};
const rodT = { x: -1.3, z: -0.15 };
const rodTip = new THREE.Vector3();

const RODS = [
  { id: 'starter',   name: 'Starter Rod',       icon: '🎣', cost: 0,   reelBonus: 0,    lineBonus: 0,   desc: 'A humble wooden rod for beginners',               blankColor: 0x111111, corkColor: 0x8B5A2B, reelColor: 0x2a2a2a, spoolColor: 0xcc2222 },
  { id: 'bamboo',    name: 'Bamboo Cane',       icon: '🎋', cost: 75,  reelBonus: 0.15, lineBonus: 1,   desc: 'Flexible & natural bamboo with snappy flex',      blankColor: 0xd4a373, corkColor: 0xb98b53, reelColor: 0x5a4a3a, spoolColor: 0x8b5a2b },
  { id: 'fiberglass',name: 'Fiberglass Flex',   icon: '🪡', cost: 160, reelBonus: 0.30, lineBonus: 2,   desc: 'Durable composite build with balanced tension',   blankColor: 0x2dd4bf, corkColor: 0x334155, reelColor: 0x0f766e, spoolColor: 0x14b8a6 },
  { id: 'graphite',  name: 'Graphite Pro',      icon: '⚡', cost: 280, reelBonus: 0.45, lineBonus: 3,   desc: 'Ultra-light high-modulus carbon fiber core',      blankColor: 0x334155, corkColor: 0x1e293b, reelColor: 0x64748b, spoolColor: 0x38bdf8 },
  { id: 'rivermaster',name:'River Master',      icon: '🌊', cost: 420, reelBonus: 0.60, lineBonus: 4,   desc: 'Tuned specifically for fast currents and river fish', blankColor: 0x0284c7, corkColor: 0x0c4a6e, reelColor: 0x0369a1, spoolColor: 0x7dd3fc, perk: 'currentResist' },
  { id: 'obsidian',  name: 'Obsidian Caster',   icon: '🖤', cost: 600, reelBonus: 0.80, lineBonus: 5,   desc: 'Forged from deep volcanic mineral composite',    blankColor: 0x18181b, corkColor: 0x27272a, reelColor: 0xa855f7, spoolColor: 0x7e22ce, perk: 'safeHi' },
  { id: 'goldensun', name: 'Golden Sunburst',   icon: '☀️', cost: 850, reelBonus: 1.05, lineBonus: 6,   desc: 'Gilded tournament rod crafted for maximum power', blankColor: 0xf59e0b, corkColor: 0x78350f, reelColor: 0xd97706, spoolColor: 0xfde047 },
  { id: 'titanium',  name: 'Titanium Abyss',    icon: '🔱', cost: 1150,reelBonus: 1.30, lineBonus: 8,   desc: 'Aerospace-grade titanium withstands brutal monsters', blankColor: 0x64748b, corkColor: 0x334155, reelColor: 0x0284c7, spoolColor: 0x06b6d4 },
  { id: 'dragon',    name: 'Dragon Spire',      icon: '🐉', cost: 1600,reelBonus: 1.60, lineBonus: 10,  desc: 'Infused with fiery dragon scales and fury',       blankColor: 0xdc2626, corkColor: 0x450a0a, reelColor: 0x991b1b, spoolColor: 0xf97316, perk: 'staminaDrain' },
  { id: 'neon',      name: 'Cyber Neon 2088',   icon: '🌌', cost: 2200,reelBonus: 2.00, lineBonus: 12,  desc: 'Pulsing luminescent carbon synth-weave',          blankColor: 0xec4899, corkColor: 0x4c1d95, reelColor: 0x8b5cf6, spoolColor: 0x06b6d4, perk: 'biteWindow' },
  { id: 'krakenking',name: 'Kraken King',       icon: '👑', cost: 3000,reelBonus: 2.50, lineBonus: 15,  desc: 'Mythical leviathan rod that conquers any sea',   blankColor: 0x6366f1, corkColor: 0x312e81, reelColor: 0x4338ca, spoolColor: 0xa855f7 },
  { id: 'aurora',    name: 'Aurora Prism',      icon: '🌈', cost: 4000,reelBonus: 2.90, lineBonus: 18,  desc: 'Refracts light into prismatic casting arcs',       blankColor: 0x34d399, corkColor: 0x0f766e, reelColor: 0x2dd4bf, spoolColor: 0xfbbf24 },
  { id: 'voidweave', name: 'Void Weaver',      icon: '🕳️', cost: 5500,reelBonus: 3.40, lineBonus: 22,  desc: 'Threads the fabric of spacetime itself',            blankColor: 0x1e1b4b, corkColor: 0x312e81, reelColor: 0x7c3aed, spoolColor: 0xf5f3ff }
];

function updateRodVisuals() {
  const cur = RODS.find(r => r.name === equippedRod) || RODS[0];
  if (blankMat) blankMat.color.setHex(cur.blankColor);
  if (corkMat) corkMat.color.setHex(cur.corkColor);
  if (reelMat) reelMat.color.setHex(cur.reelColor);
  if (spoolMat) spoolMat.color.setHex(cur.spoolColor);
  const rn = $('rodName'), srn = $('shopRodName');
  if (rn) rn.textContent = cur.name;
  if (srn) srn.textContent = cur.name;
}

const SPECIES = [
  { name: 'Bluegill', rarity: 'Common', color: 0xff6b35, strength: 2, stamina: 2, value: 10, weight: [0.3, 1.0], biteDelay: [1.5, 3], biteWindow: 2.0, bait: 'Worm', lore: 'A feisty panfish with iridescent scales. Known for its boldness, the bluegill will strike almost any lure.' },
  { name: 'Bass', rarity: 'Uncommon', color: 0x32cd32, strength: 5, stamina: 5, value: 35, weight: [1.0, 3.0], biteDelay: [2, 5], biteWindow: 2.0, bait: 'Worm', lore: 'The undisputed king of freshwater sport. Lunkers lurk in submerged timber, striking with explosive power.' },
  { name: 'Catfish', rarity: 'Rare', color: 0x4169e1, strength: 7, stamina: 8, value: 80, weight: [3.0, 8.0], biteDelay: [3, 7], biteWindow: 2.0, bait: 'Minnow', lore: 'A whiskered bottom-dweller that hunts by scent. Can grow to enormous sizes in deep, murky waters.' },
  { name: 'Golden Koi', rarity: 'Epic', color: 0xffd700, strength: 6, stamina: 7, value: 180, weight: [2.0, 5.0], biteDelay: [4, 8], biteWindow: 2.0, bait: 'Shrimp', lore: 'A living jewel said to bring fortune. Ancient legends claim these fish can transform into dragons.' },
  { name: 'Lake Monster', rarity: 'Legendary', color: 0x00ced1, strength: 10, stamina: 10, value: 500, weight: [10, 30], biteDelay: [5, 10], biteWindow: 2.0, bait: 'Minnow', lore: 'A prehistoric leviathan thought extinct. Sonar anomalies and broken lines are all that remain.' },
  { name: 'Perch', rarity: 'Common', color: 0xc4a747, strength: 3, stamina: 3, value: 15, weight: [0.4, 1.2], biteDelay: [1.5, 3], biteWindow: 2.0, bait: 'Bread', lore: 'Schooling ambush predators with tiger-like stripes. Their sharp dorsal spines deter all but the hungriest birds.' },
  { name: 'Crappie', rarity: 'Common', color: 0xb0c4de, strength: 2, stamina: 3, value: 12, weight: [0.3, 0.9], biteDelay: [1.5, 3.5], biteWindow: 2.0, bait: 'Corn', lore: 'Spotted and shy, crappie gather in suspended schools near brush piles. A favorite among panfish anglers.' },
  { name: 'Carp', rarity: 'Common', color: 0xa9a9a9, strength: 4, stamina: 6, value: 20, weight: [2.0, 6.0], biteDelay: [2, 4], biteWindow: 2.0, bait: 'Corn', lore: 'An industrious bottom feeder that stirs up sediment. Revered as a delicacy in many cultures worldwide.' },
  { name: 'Trout', rarity: 'Uncommon', color: 0xfa8072, strength: 4, stamina: 4, value: 40, weight: [1.0, 3.5], biteDelay: [2, 5], biteWindow: 2.0, bait: 'Salmon Egg', lore: 'A cold-water athlete with a pink lateral stripe. Requires pristine oxygen-rich streams to thrive.' },
  { name: 'Salmon', rarity: 'Uncommon', color: 0xe9967a, strength: 6, stamina: 6, value: 55, weight: [2.0, 5.0], biteDelay: [2.5, 5.5], biteWindow: 2.0, bait: 'Salmon Egg', lore: 'Famous for epic upstream runs. Navigate thousands of miles by magnetic fields and scent memory.' },
  { name: 'Pike', rarity: 'Uncommon', color: 0x6b8e23, strength: 7, stamina: 5, value: 60, weight: [2.0, 6.0], biteDelay: [2, 5], biteWindow: 2.0, bait: 'Frog', lore: 'The water wolf — an ambush predator with rows of glass-like teeth. Strikes with terrifying speed.' },
  { name: 'Walleye', rarity: 'Rare', color: 0x8fbc8f, strength: 6, stamina: 7, value: 90, weight: [2.0, 6.0], biteDelay: [3, 6], biteWindow: 2.0, bait: 'Leech', lore: 'Named for its reflective tapetum lucidum that lets it hunt in near darkness. Prized for its flaky flesh.' },
  { name: 'Sturgeon', rarity: 'Rare', color: 0x708090, strength: 8, stamina: 9, value: 120, weight: [5.0, 15.0], biteDelay: [3, 7], biteWindow: 2.0, bait: 'PowerBait', lore: 'A living fossil unchanged for 200 million years. Bony scutes armor its body; its roe becomes caviar.' },
  { name: 'Swordfish', rarity: 'Epic', color: 0x4682b4, strength: 8, stamina: 8, value: 220, weight: [5.0, 12.0], biteDelay: [4, 8], biteWindow: 2.0, bait: 'Squid', lore: 'A pelagic hunter whose bill slices through prey. Can dive 2,800 feet in pursuit of squid.' },
  { name: 'Kraken', rarity: 'Legendary', color: 0x4b0082, strength: 9, stamina: 9, value: 450, weight: [8.0, 25.0], biteDelay: [5, 9], biteWindow: 2.0, bait: 'Squid', lore: 'The abyssal titan of sailor nightmares. Its bioluminescent tentacles glow with an otherworldly violet light.' },
  { name: 'Sunfish', rarity: 'Common', color: 0xffa500, strength: 1, stamina: 2, value: 8, weight: [0.2, 0.8], biteDelay: [1, 2.5], biteWindow: 2.0, bait: 'Worm', lore: 'A brightly colored panfish that basks near the surface in warm shallows. Easy to catch and fun for beginners.' },
  { name: 'Tilapia', rarity: 'Common', color: 0x778899, strength: 3, stamina: 3, value: 14, weight: [0.5, 1.5], biteDelay: [1.5, 3], biteWindow: 2.0, bait: 'Bread', lore: 'A hardy tropical fish farmed worldwide. Thrives in warm, low-oxygen waters where few species survive.' },
  { name: 'Rainbow Trout', rarity: 'Uncommon', color: 0xff69b4, strength: 5, stamina: 5, value: 45, weight: [1.0, 3.5], biteDelay: [2, 4.5], biteWindow: 2.0, bait: 'Fly Lure', lore: 'Its lateral stripe shimmers like a prism in sunlight. A prized catch for fly anglers across North America.' },
  { name: 'Piranha', rarity: 'Uncommon', color: 0xdc143c, strength: 6, stamina: 4, value: 50, weight: [0.8, 2.5], biteDelay: [1, 3], biteWindow: 1.5, bait: 'Maggot', lore: 'A razor-toothed scavenger of the Amazon basin. Feeds in frenzied schools when blood is detected in the water.' },
  { name: 'Muskie', rarity: 'Rare', color: 0x2e8b57, strength: 9, stamina: 7, value: 110, weight: [5.0, 14.0], biteDelay: [4, 8], biteWindow: 1.8, bait: 'Frog', lore: 'The fish of ten thousand casts. This apex predator strikes with explosive force and fights with raw power.' },
  { name: 'Arowana', rarity: 'Rare', color: 0xdaa520, strength: 7, stamina: 6, value: 100, weight: [3.0, 8.0], biteDelay: [3, 6], biteWindow: 2.0, bait: 'Cricket', lore: 'A dragon fish that leaps from the water to snatch insects from low branches. Considered a symbol of prosperity in Asia.' },
  { name: 'Arapaima', rarity: 'Epic', color: 0xb22222, strength: 10, stamina: 8, value: 250, weight: [15.0, 40.0], biteDelay: [5, 9], biteWindow: 2.0, bait: 'Shrimp', lore: 'The giant of the Amazon, breathing air at the surface. Can grow over 3 meters and weigh more than a car.' },
  { name: 'Marlin', rarity: 'Epic', color: 0x1e90ff, strength: 9, stamina: 9, value: 280, weight: [10.0, 25.0], biteDelay: [4, 8], biteWindow: 2.0, bait: 'Squid', lore: 'An ocean speedster with a spear-like bill. Leaps clear of the water in spectacular fights against anglers.' },
  { name: 'Coelacanth', rarity: 'Legendary', color: 0x483d8b, strength: 8, stamina: 10, value: 600, weight: [12.0, 35.0], biteDelay: [6, 10], biteWindow: 1.5, bait: 'PowerBait', lore: 'A living fossil thought extinct for 65 million years. Its discovery in 1938 shocked the scientific world.' },
  { name: 'Whale Shark', rarity: 'Legendary', color: 0x5f9ea0, strength: 10, stamina: 10, value: 700, weight: [50.0, 120.0], biteDelay: [7, 12], biteWindow: 1.5, bait: 'Minnow', lore: 'The largest fish in the ocean, a gentle filter feeder spanning 12 meters. Spotting one is a once-in-a-lifetime event.' }
];

const WORM_ICON = '<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" style=\"vertical-align:middle\"><path d=\"M4 15c1-3 3-3 5 0s4 3 6 0 4-3 5 0\" stroke=\"#a16207\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M7 13.5l0.1 0.1M11 16.5l0.1 0.1M15 13.5l0.1 0.1\" stroke=\"#7c2d12\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>';
const FLY_ICON = '<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" style=\"vertical-align:middle\"><ellipse cx=\"12\" cy=\"14\" rx=\"2.5\" ry=\"3.5\" fill=\"#111827\"/><path d=\"M9 11.5Q4 7 3 9.5Q4 12 9 12.5Z\" fill=\"#d1d5db\" opacity=\"0.8\"/><path d=\"M15 11.5Q20 7 21 9.5Q20 12 15 12.5Z\" fill=\"#d1d5db\" opacity=\"0.8\"/><circle cx=\"11\" cy=\"12.5\" r=\"0.6\" fill=\"#fff\"/><circle cx=\"13\" cy=\"12.5\" r=\"0.6\" fill=\"#fff\"/></svg>';
const BAITS = [
  { name: 'Worm',         icon: WORM_ICON, cost: 0,   bonus: ['Bluegill', 'Bass'] },
  { name: 'Minnow',       icon: '🐟', cost: 50,  bonus: ['Catfish', 'Lake Monster'] },
  { name: 'Shrimp',       icon: '🦐', cost: 100, bonus: ['Golden Koi'] },
  { name: 'Cricket',      icon: '🦗', cost: 30,  bonus: ['Bass'] },
  { name: 'Bread',        icon: '🍞', cost: 10,  bonus: ['Perch', 'Crappie'] },
  { name: 'Corn',         icon: '🌽', cost: 15,  bonus: ['Crappie', 'Carp'] },
  { name: 'Cheese',       icon: '🧀', cost: 40,  bonus: ['Carp', 'Bass'] },
  { name: 'Leech',        icon: '🐛', cost: 60,  bonus: ['Walleye', 'Pike'] },
  { name: 'Salmon Egg',   icon: '🔴', cost: 80,  bonus: ['Trout', 'Salmon'] },
  { name: 'PowerBait',    icon: '🧪', cost: 150, bonus: ['Sturgeon', 'Golden Koi'] },
  { name: 'Frog',         icon: '🐸', cost: 120, bonus: ['Pike', 'Bass'] },
  { name: 'Nightcrawler', icon: '🐍', cost: 90,  bonus: ['Trout', 'Walleye'] },
  { name: 'Squid',        icon: '🦑', cost: 200, bonus: ['Swordfish', 'Kraken', 'Lake Monster'] },
  { name: 'Fly Lure',     icon: FLY_ICON, cost: 180, bonus: ['Trout', 'Pike'] },
  { name: 'Jig Lure',     icon: '🧲', cost: 125, bonus: ['Bass', 'Trout'] },
  { name: 'Maggot',       icon: '🪱', cost: 20,  bonus: ['Catfish', 'Perch'] },
  { name: 'Minnow Fry',   icon: '🐠', cost: 35,  bonus: ['Bluegill', 'Crappie'] },
  { name: 'Gold Flake',   icon: '✨', cost: 140, bonus: ['Golden Koi', 'Sturgeon'] }
];

const UPGRADES = [
  { id: 'rod',  name: 'Better Rod',     icon: '🎣', desc: 'Faster reel progress',         max: 5, baseCost: 100, costMul: 1.8 },
  { id: 'line', name: 'Stronger Line',  icon: '🧵', desc: 'Higher tension limit',         max: 5, baseCost: 120, costMul: 1.8 },
  { id: 'reel', name: 'Improved Reel',  icon: '🔧', desc: 'Lower stamina drain',          max: 5, baseCost: 150, costMul: 1.8 },
  { id: 'bait', name: 'Lucky Bait',     icon: '🍀', desc: 'Increased rare-fish chance',   max: 5, baseCost: 200, costMul: 2.0 }
];
const upgradeCost = u => Math.floor(u.baseCost * Math.pow(u.costMul, upgrades[u.id] || 0));
const upgradeVal = (id, base) => {
  const lvl = upgrades[id] || 0;
  if (id === 'rod')  return base * (1 + lvl * 0.15);
  if (id === 'line') return base + lvl * 1.5;
  if (id === 'reel') return base * Math.max(0.4, 1 - lvl * 0.1);
  if (id === 'bait') return base * (1 + lvl * 0.2);
  return base;
};

let upgrades = { rod: 0, line: 0, reel: 0, bait: 0 };
let settings = { sfx: true, music: true, volume: 80, shake: true, safe: true, motion: false, quality: 'high', blur: true };
let totalCoinsEarned = 0;
let streak = 0, streakIdle = 0;
const streakMult = () => 1 + Math.min(streak, 10) * 0.1;
let tutorialsSeen = {};
let isGamePaused = true;
try {
  const s = JSON.parse(localStorage.getItem('fishSave') || '{}');
  coins = s.coins || 0; caught = s.caught || []; records = s.records || {}; bait = s.bait || 'Worm';
  for (const k in records) if (typeof records[k] === 'number') records[k] = { maxWeight: records[k], maxLength: records[k] * 30, totalCaught: 1 };
  if (s.equippedRod) equippedRod = s.equippedRod;
  if (Array.isArray(s.ownedRods)) ownedRods = s.ownedRods;
  if (!ownedRods.includes('Starter Rod')) ownedRods.unshift('Starter Rod');
  if (s.upgrades) upgrades = Object.assign(upgrades, s.upgrades);
  if (s.settings) settings = Object.assign(settings, s.settings);
  if (s.tutorialsSeen) tutorialsSeen = Object.assign(tutorialsSeen, s.tutorialsSeen);
  totalCoinsEarned = s.totalCoinsEarned || 0; streak = s.streak || 0;
} catch(e) {}
SoundManager.setVolume(settings.volume);

const $ = id => document.getElementById(id);
const aimMeter = $('aimMeter'), powerMeter = $('powerMeter');
const tensionMeter = $('tensionMeter'), staminaMeter = $('staminaMeter');
const reelMeter = $('reelMeter'), adrenalineMeter = $('adrenalineMeter');
const fightMeter = $('fightMeter');
const adrenalineBtn = $('adrenalineBtn');

let hintBase = '', hintCls = '', hintAnim = false, hintDotT = 0, hintDots = 0;
const syncHint = () => { const b = $('bottom').getBoundingClientRect(); hint.style.bottom = (innerHeight - b.top + 12) + 'px'; };
const setHint = (t, c, anim) => { hintBase = t; hintCls = c || ''; hintAnim = !!anim; hintDots = 0; hintDotT = 0; hint.textContent = t; hint.className = 'hint ' + hintCls; syncHint(); };
const idleHint = () => setHint(isTouch ? 'Tap & hold to charge cast' : 'Hold LMB to charge cast', 'hint-aim');
const setMeter = (el, v) => { el.style.width = Math.max(0, Math.min(100, v)) + '%'; };
const save = () => localStorage.setItem('fishSave', JSON.stringify({ coins, caught, records, bait, equippedRod, ownedRods, upgrades, settings, totalCoinsEarned, tutorialsSeen, streak }));
const updateStreakBadge = () => { const b = $('streakBadge'); if (!b) return; if (streak <= 0) { b.style.display = 'none'; return; } b.style.display = ''; b.textContent = '🔥×' + streakMult().toFixed(1); b.title = streak + '-catch streak'; b.classList.toggle('hot', streak >= 5); b.classList.toggle('warn', streakIdle > 6); };

function parseMarkdown(md) {
  if (!md) return '';
  const lines = md.trim().split('\n');
  let html = '';
  let inList = false;
  let inCards = false;

  const inline = t => {
    return t
      .replace(/\[kbd\](.*?)\[\/kbd\]/g, '<span class="md-key">$1</span>')
      .replace(/`([^`]+)`/g, '<span class="md-key">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<span class="md-strong">$1</span>')
      .replace(/\*([^*]+)\*/g, '<span class="md-em">$1</span>')
      .replace(/\[badge:([^\]]+)\]/g, '<span class="md-badge-pill">$1</span>');
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) {
      if (inList) { html += '</div>'; inList = false; }
      if (inCards) { html += '</div>'; inCards = false; }
      continue;
    }

    if (raw.startsWith(':::cards')) {
      if (inList) { html += '</div>'; inList = false; }
      html += '<div class="md-card-grid">';
      inCards = true;
      continue;
    }
    if (raw.startsWith(':::card')) {
      const parts = raw.replace(/^:::card\s*/, '').split('|');
      const icon = parts[0] || '🎣';
      const title = parts[1] || '';
      const desc = parts[2] || '';
      html += `<div class="md-card"><span class="md-card-icon">${icon}</span><span class="md-card-title">${inline(title)}</span><span class="md-card-desc">${inline(desc)}</span></div>`;
      continue;
    }
    if (raw === ':::') {
      if (inCards) { html += '</div>'; inCards = false; }
      continue;
    }

    if (raw.startsWith('> tip:')) {
      if (inList) { html += '</div>'; inList = false; }
      const text = raw.replace(/^>\s*tip:\s*/i, '');
      html += `<div class="md-tip"><span class="md-tip-icon">💡</span><div>${inline(text)}</div></div>`;
      continue;
    }

    if (/^\d+\.\s/.test(raw)) {
      if (inCards) { html += '</div>'; inCards = false; }
      if (!inList) { html += '<div class="md-list">'; inList = true; }
      const match = raw.match(/^(\d+)\.\s+(\*\*([^*]+)\*\*[:\s]*)?(.*)$/);
      const num = match ? match[1] : '1';
      const title = match && match[3] ? match[3] : '';
      const text = match ? (match[4] || '') : raw.replace(/^\d+\.\s+/, '');
      html += `<div class="md-step-item"><div class="md-step-num">${num}</div><div class="md-step-content">${title ? `<div class="md-step-title">${inline(title)}</div>` : ''}<div>${inline(text)}</div></div></div>`;
      continue;
    }

    if (raw.startsWith('#### ')) {
      if (inList) { html += '</div>'; inList = false; }
      html += `<h4 class="md-h4">${inline(raw.slice(5))}</h4>`;
    } else if (raw.startsWith('### ')) {
      if (inList) { html += '</div>'; inList = false; }
      html += `<h3 class="md-h3">${inline(raw.slice(4))}</h3>`;
    } else if (raw.startsWith('## ')) {
      if (inList) { html += '</div>'; inList = false; }
      html += `<h2 class="md-h2">${inline(raw.slice(3))}</h2>`;
    } else if (raw.startsWith('# ')) {
      if (inList) { html += '</div>'; inList = false; }
      html += `<h1 class="md-h1">${inline(raw.slice(2))}</h1>`;
    } else {
      if (inList) { html += '</div>'; inList = false; }
      html += `<p class="md-p">${inline(raw)}</p>`;
    }
  }
  if (inList) html += '</div>';
  if (inCards) html += '</div>';
  return html;
}

let guideModalInstance = null;
let currentGuideCallback = null;
let currentGuideNeverCallback = null;

function showGuideModal({ badge = '🎣 HOW TO PLAY', title = 'Fishing Guide', subtitle = '', markdown = '', theme = '', showNever = false, onDismiss = null, onNever = null } = {}) {
  const modalEl = $('guideModal');
  if (!modalEl) return;
  
  const contentEl = modalEl.querySelector('.guide-modal-content');
  if (contentEl) contentEl.classList.toggle('guide-danger', theme === 'danger');

  if ($('guideBadge')) $('guideBadge').textContent = badge;
  if ($('guideTitle')) $('guideTitle').textContent = title;
  if ($('guideSubtitle')) $('guideSubtitle').textContent = subtitle;
  if ($('guideBody')) $('guideBody').innerHTML = parseMarkdown(markdown);

  const neverBtn = $('guideNeverBtn');
  if (neverBtn) {
    neverBtn.style.display = showNever ? 'inline-flex' : 'none';
  }

  isGamePaused = true;
  currentGuideCallback = onDismiss;
  currentGuideNeverCallback = onNever;

  if (!guideModalInstance) {
    guideModalInstance = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
  }

  modalEl.addEventListener('shown.bs.modal', function onShown() {
    modalEl.removeEventListener('shown.bs.modal', onShown);
    const bd = document.querySelector('.modal-backdrop');
    if (bd) bd.classList.add('guide-backdrop');
  });

  guideModalInstance.show();
}

function dismissGuideModal(isNever = false) {
  if (guideModalInstance) {
    guideModalInstance.hide();
  }
  isGamePaused = false;
  if (isNever && typeof currentGuideNeverCallback === 'function') {
    const ncb = currentGuideNeverCallback;
    currentGuideNeverCallback = null;
    currentGuideCallback = null;
    ncb();
  } else if (typeof currentGuideCallback === 'function') {
    const cb = currentGuideCallback;
    currentGuideCallback = null;
    currentGuideNeverCallback = null;
    cb();
  }
}

if ($('guideGotItBtn')) {
  $('guideGotItBtn').addEventListener('click', () => dismissGuideModal(false));
}
if ($('guideNeverBtn')) {
  $('guideNeverBtn').addEventListener('click', () => dismissGuideModal(true));
}
if ($('guideModal')) {
  $('guideModal').addEventListener('hidden.bs.modal', () => {
    isGamePaused = false;
    if (state === S.WAITING) {
      setHint('Waiting for fish', 'hint-cast', true);
    } else if (state === S.IDLE) {
      idleHint();
    }
  });
}
function pickFish() {
  const rarityWeights = { Common: 50, Uncommon: 30, Rare: 12, Epic: 6, Legendary: 2 };
  const luckyMult = 1 + (upgrades.bait || 0) * 0.5;
  const bd = BAITS.find(b => b.name === bait);
  const weights = SPECIES.map(s => {
    let w = rarityWeights[s.rarity] || 10;
    if (s.rarity !== 'Common') w *= luckyMult;
    if (bd && bd.bonus.includes(s.name)) w *= 3;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SPECIES.length; i++) {
    r -= weights[i];
    if (r <= 0) return { ...SPECIES[i] };
  }
  return { ...SPECIES[0] };
}
function startBitePhase() {
  biteTimer = 0;
  biteActive = false;
  fakeBite = false;
  setHint('Waiting for fish', 'hint-cast', true);
}

function triggerBite() {
  if (!currentFish) return;
  biteWindow = currentFish.biteWindow * ((RODS.find(r => r.name === equippedRod) || RODS[0]).perk === 'biteWindow' ? 1.5 : 1);
  biteActive = true;
  triggerHaptic([100, 50, 100]);
  setHint('🎣 BITE! CLICK NOW!', 'hint-bite-active');
  spawnSplash(bobberX, bobberZ, 25, 0xffffff);
  shake = 1.5;
  shakeIntensity = Math.max(shakeIntensity, 0.4);
  setTimeout(() => {
    if (state === S.BITE && biteActive) {
      biteActive = false;
      state = S.WAITING;
      streak = 0; streakIdle = 0; updateStreakBadge();
      setHint('Too slow! Fish escaped...', 'hint-miss');
      if (nibbleFish) {
        const nd = nibbleFish.userData;
        nd.isInterested = undefined;
        nd.curiosity = 0;
        nibbleFish.position.x = Math.cos(nd.angle) * nd.radius;
        nibbleFish.position.z = Math.sin(nd.angle) * nd.radius;
        nibbleFish.rotation.y = Math.PI / 2 - nd.angle;
      }
      nibbleFish = null;
      currentFish = null;
      setTimeout(() => {
        if (state === S.WAITING) {
          state = S.IDLE;
          bobber.visible = false;
          ripple.visible = false;
          bobberX = 0; bobberZ = 0;
idleHint();
        }
      }, 1500);
    }
  }, biteWindow * 1000);
}

function makeTextSprite(text) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = 'bold 48px system-ui, sans-serif';
  c.width = Math.ceil(g.measureText(text).width) + 48;
  c.height = 76;
  g.font = 'bold 48px system-ui, sans-serif';
  g.fillStyle = 'rgba(8,18,28,0.78)';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  const h = 0.22;
  s.scale.set(h * c.width / c.height, h, 1);
  s.renderOrder = 999;
  return s;
}

function dropHookedFish() {
  if (!hookedFish) return;
  const l = hookedFish.userData.label;
  if (l) { scene.remove(l); l.material.map.dispose(); l.material.dispose(); }
  scene.remove(hookedFish);
  hookedFish = null;
}

function startReel() {
  state = S.REELING;
  SoundManager.play('splash2', { x: bobberX, y: bobber.position.y, z: bobberZ });
  maxStamina = currentFish.stamina * 10;
  fightStamina = currentFish.stamina * 8;
tension = 0; stamina = maxStamina; reel = 0; adrenaline = 0; escapeProgress = 0; reelLockout = 0.5;
  initialReelDist = Math.sqrt(bobberX * bobberX + (bobberZ - 4) * (bobberZ - 4)) || 1;
  dashTimer = 1.5 + Math.random() * 2; isDashing = false; dashDuration = 0;
  oscPhaseA = Math.random() * Math.PI * 2; oscPhaseB = Math.random() * Math.PI * 2;
  fightBackTimer = 2 + Math.random() * 2; isFightingBack = false; fightBackDuration = 0;
  hookedFish = createFish(currentFish.color, 0.25);
  const barMat = new THREE.MeshBasicMaterial({ color: 0x33ff33 });
  const barMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.06), barMat);
  barMesh.position.set(0, 0.5, 0);
  hookedFish.add(barMesh);
  hookedFish.userData.bar = barMesh;
  const label = makeTextSprite(currentFish.name);
  label.position.set(bobberX, 0.65, bobberZ);
  scene.add(label);
  hookedFish.userData.label = label;
  hookedFish.position.set(bobberX, -0.2, bobberZ);
  hookedFish.rotation.y = Math.atan2(-bobberX, 4 - bobberZ);
  scene.add(hookedFish);
setHint(isTouch ? 'Hold REEL button — keep tension in green zone!' : 'Hold LEFT CLICK to reel — keep tension in green zone!', 'hint-reel');
}

function endCatch(success) {
  state = S.RESULT;
  if (success) {
    const w = currentFish.weight[0] + Math.random() * (currentFish.weight[1] - currentFish.weight[0]);
    const len = w * 30 + Math.random() * 10;
    const reward = Math.floor(currentFish.value * (0.8 + Math.random() * 0.4) * streakMult());
    streak++; streakIdle = 0; updateStreakBadge();
    coins += reward;
    totalCoinsEarned += reward;
    const isNew = !caught.includes(currentFish.name);
    if (isNew) caught.push(currentFish.name);
    const rec = records[currentFish.name] || (records[currentFish.name] = { maxWeight: 0, maxLength: 0, totalCaught: 0 });
    rec.totalCaught++; rec.lastCaught = Date.now();
    if (w > rec.maxWeight) rec.maxWeight = w;
    if (len > rec.maxLength) rec.maxLength = len;
    lastCatch = { fish: currentFish, weight: w, length: len, reward, isNew };
    save();
    spawnSplash(bobberX, bobberZ, 28, currentFish.color);
    shakeIntensity = Math.max(shakeIntensity, 0.35);
    showCatchModal(currentFish, w, len, reward);
    SoundManager.play('fishcatch');
    triggerHaptic([50, 100, 150]);
  } else {
    streak = 0; streakIdle = 0; updateStreakBadge();
    triggerHaptic(400);
    SoundManager.play('linesnap');
    const sf = $('snapFlash'); sf.classList.remove('go'); void sf.offsetWidth; sf.classList.add('go');
    tensionMeter.classList.remove('snap'); void tensionMeter.offsetWidth; tensionMeter.classList.add('snap');
    setHint('💔 LINE SNAPPED! The fish got away...', 'hint-charge');
    spawnSplash(bobberX, bobberZ, 12, 0x88aacc);
    shakeIntensity = 0;
    rodT.x = ROD[S.IDLE].x;
    rodT.z = ROD[S.IDLE].z;
    window.reelPhase = 0;
    reeling = false;
    isFightingBack = false;
    setTimeout(() => {
      state = S.IDLE;
      idleHint();
      showLineSnapGuide();
    }, 800);
  }
  dropHookedFish();
  currentFish = null;
  bobber.visible = false;
  ripple.visible = false;
}

function showCatchModal(fish, weight, length, reward) {
  $('catchName').textContent = fish.name;
  $('catchRarity').textContent = fish.rarity;
  $('catchRarity').className = 'catch-rarity-badge rarity-' + fish.rarity.toLowerCase();
  $('catchWeight').textContent = (weight * 2.20462).toFixed(2) + ' lb';
  $('catchLength').textContent = (length * 0.393701).toFixed(1) + ' in';
  $('catchStrength').textContent = fish.strength;
  $('catchStamina').textContent = fish.stamina;
  $('catchBait').textContent = bait;
  $('catchValue').textContent = fish.value;
  $('catchCoins').textContent = reward;
  $('coins').textContent = coins;
$('collectionCount').textContent = caught.length + '/' + SPECIES.length;
  refreshLeftPanel();
  const preview = $('fishPreview');
  preview.innerHTML = '';
  const ms = new THREE.Scene();
  const mc = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  mc.position.set(0, 0, 3);
  const mf = createFish(fish.color, 0.5);
  ms.add(mf);
  ms.add(new THREE.AmbientLight(0xffffff, 0.8));
  const ml = new THREE.DirectionalLight(0xffffff, 1);
  ml.position.set(2, 2, 2);
  ms.add(ml);
  const mr = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  mr.setSize(200, 200);
  preview.appendChild(mr.domElement);
  (function spin() {
    mf.rotation.y += 0.02;
    mr.render(ms, mc);
    if ($('catchModal').classList.contains('show')) requestAnimationFrame(spin);
  })();
  $('catchPB').textContent = lastCatch.isNew ? ' ✨ NEW DISCOVERY!' : (records[fish.name].maxWeight === weight ? ' 🏆 NEW PB!' : '');
  $('catchSubtitle').textContent = fish.lore || 'A fine specimen';
  new bootstrap.Modal($('catchModal')).show();
}

// Input
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const canvas = renderer.domElement;
canvas.style.touchAction = 'none';

const handlePrimaryDown = e => {
  if (isGamePaused) return;
  if (e.target !== canvas) return;
  e.preventDefault();
  if (state === S.IDLE) {
    state = S.CHARGING; power = 0;
    setHint(isTouch ? 'Release to cast!' : 'Release to cast!', 'hint-charge');
  } else if (state === S.LAND) {
    resetToIdle();
  } else if (state === S.WAITING && jiggleCooldown <= 0) {
    jiggleT = 0.3; jiggleCooldown = 1.5; waitingWithoutProdTimer = 0;
    spawnSplash(bobberX, bobberZ, 5, 0xffffff);
    SoundManager.play('splash3', { x: bobberX, y: bobber.position.y, z: bobberZ });
  } else if (state === S.NIBBLE) {
    if (nibbleFish) {
      const nd = nibbleFish.userData;
      nd.isInterested = undefined;
      nd.curiosity = 0;
      nibbleFish.position.x = Math.cos(nd.angle) * nd.radius;
      nibbleFish.position.z = Math.sin(nd.angle) * nd.radius;
      nibbleFish.rotation.y = Math.PI / 2 - nd.angle;
    }
    nibbleFish = null;
    currentFish = null;
    state = S.WAITING;
    setHint('You scared the fish away!', 'hint-miss');
  } else if (state === S.REELING) {
    reeling = true;
  } else if (state === S.BITE && biteActive) {
    biteActive = false;
    if (fakeBite) {
      setHint('Fake bite! Wait...', 'hint-fake');
      state = S.WAITING;
      setTimeout(() => { if (state === S.WAITING) startBitePhase(); }, 1200);
    } else {
      startReel();
      reeling = true;
    }
  }
};
const handlePrimaryUp = e => {
  if (isGamePaused) return;
  if (e.target !== canvas) return;
  e.preventDefault();
  if (state === S.CHARGING) {
    const dist = 5 + power * 15;
    const halfHFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    const angle = (aim - 0.5) * 2 * halfHFov;
    bobberX = Math.sin(angle) * dist;
    bobberZ = 4 - Math.cos(angle) * dist;
    rodTip.set(0, 2, 0).applyEuler(rod.rotation).add(rod.position);
    bobber.position.set(rodTip.x, rodTip.y, rodTip.z);
    bobberPos.copy(rodTip);
    // Initial projectile launch velocity towards target point (bobberX, 0, bobberZ)
    const flightTime = CAST_DURATION;
    bobberVel.set(
      (bobberX - rodTip.x) / flightTime,
      (0 - rodTip.y + 0.5 * 18 * flightTime * flightTime) / flightTime,
      (bobberZ - rodTip.z) / flightTime
    );
    bounceCount = 0;
    bobber.visible = true;
    state = S.CASTING;
    castT = 0;
    waitingWithoutProdTimer = 0;
    triggerHaptic(20);
    setHint('Casting...', 'hint-cast');
  }
};

addEventListener('mousedown', e => {
  if (isGamePaused || e.button !== 0) return;
  handlePrimaryDown(e);
});
addEventListener('mouseup', e => {
  if (isGamePaused || e.button !== 0) return;
  if (state === S.REELING) reeling = false;
  handlePrimaryUp(e);
});
canvas.addEventListener('touchstart', e => { if (!isGamePaused) handlePrimaryDown(e); }, { passive: false });
canvas.addEventListener('touchend', e => { if (!isGamePaused) handlePrimaryUp(e); }, { passive: false });
canvas.addEventListener('touchcancel', e => { if (!isGamePaused) handlePrimaryUp(e); }, { passive: false });
// Touch reel: hold finger on canvas during REELING state
canvas.addEventListener('touchstart', e => {
  if (isGamePaused) return;
  if (state === S.REELING) { reeling = true; e.preventDefault(); }
}, { passive: false });
canvas.addEventListener('touchend', e => {
  if (isGamePaused) return;
  if (state === S.REELING) { reeling = false; e.preventDefault(); }
}, { passive: false });
canvas.addEventListener('touchcancel', e => {
  if (isGamePaused) return;
  if (state === S.REELING) { reeling = false; e.preventDefault(); }
}, { passive: false });

addEventListener('keydown', e => {
  if (isGamePaused) return;
  if (e.code === 'Space') {
    if (state === S.WAITING && jiggleCooldown <= 0) {
      jiggleT = 0.3; jiggleCooldown = 1.5; waitingWithoutProdTimer = 0;
      spawnSplash(bobberX, bobberZ, 5, 0xffffff);
    }
    e.preventDefault();
  }
  if ((e.code === 'KeyE' || e.code === 'KeyQ') && adrenaline >= 100 && state === S.REELING && !reelLockout) {
    adrenaline = 0; reel += 25;
    setHint('⚡ ADRENALINE BURST!', 'hint-burst');
  }
});

// Start main ambience loop on first user gesture (audio unlock).
addEventListener('pointerdown', () => {
  const a = SoundManager.get('ambience1');
  if (a && !a.voices.size) a.play();
}, { once: true });

// Touch aim: swipe horizontally on canvas during IDLE to adjust aim
let touchAimStartX = null;
canvas.addEventListener('touchstart', e => {
  if (isGamePaused) return;
  const t = e.touches ? e.touches[0] : null;
  if (t) touchAimStartX = t.clientX;
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  if (isGamePaused || touchAimStartX === null || state !== S.IDLE) return;
  const t = e.touches ? e.touches[0] : null;
  if (!t) return;
  const dx = t.clientX - touchAimStartX;
  aim = Math.max(0.25, Math.min(0.75, aim + dx * 0.003));
  touchAimStartX = t.clientX;
}, { passive: false });
canvas.addEventListener('touchend', () => { touchAimStartX = null; }, { passive: false });
canvas.addEventListener('touchcancel', () => { touchAimStartX = null; }, { passive: false });
function resetToIdle() {
  state = S.IDLE;
  reeling = false; reelLockout = 0; canReel = false;
  currentFish = null;
  dropHookedFish();
  ripple.visible = false;
  bobber.visible = false;
  bobberX = 0; bobberZ = 0; distanceReel = 0;
  bobberPos.set(0, 0, 0); bobberVel.set(0, 0, 0); bounceCount = 0;
tension = 0; stamina = 0; reel = 0; adrenaline = 0; escapeProgress = 0;
  dashTimer = 0; isDashing = false; dashDuration = 0;
  fightBackTimer = 0; fightStamina = 0; isFightingBack = false; fightBackDuration = 0;
  biteTimer = 0; biteActive = false; fakeBite = false;
  power = 0; castT = 0; shake = 0; shakeIntensity = 0;
  window.reelPhase = 0;
  rodT.x = ROD[S.IDLE].x;
  rodT.z = ROD[S.IDLE].z;
  setMeter(tensionMeter, 0);
  setMeter(staminaMeter, 0);
  setMeter(reelMeter, 0);
  setMeter(adrenalineMeter, 0);
  setMeter(fightMeter, 0);
  setMeter(powerMeter, 0);
  reelMeter.parentElement.classList.remove('reeling-active', 'reeling-danger');
  adrenalineBtn.disabled = true;
  idleHint();
}

addEventListener('contextmenu', e => { e.preventDefault(); resetToIdle(); });
addEventListener('mousedown', e => { if (e.button === 2) { e.preventDefault(); resetToIdle(); } });
document.querySelectorAll('.gear-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gear-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gear = parseInt(btn.dataset.gear);
  });
});
adrenalineBtn.addEventListener('click', () => {
  if (adrenaline >= 100 && state === S.REELING && !reelLockout) { adrenaline = 0; reel += 25; }
});

$('keepBtn').addEventListener('click', () => bootstrap.Modal.getInstance($('catchModal'))?.hide());
$('releaseBtn').addEventListener('click', () => {
  if (lastCatch) {
    coins = Math.max(0, coins - Math.floor(lastCatch.reward * 0.3));
    $('coins').textContent = coins; save();
  }
  bootstrap.Modal.getInstance($('catchModal'))?.hide();
});

$('catchModal').addEventListener('hidden.bs.modal', () => {
  state = S.IDLE;
idleHint();
});

$('settingsBtn').addEventListener('click', () => {
  populateShop();
  new bootstrap.Modal($('settingsModal')).show();
});

const RARITY_ORDER = { Common:0, Uncommon:1, Rare:2, Epic:3, Legendary:4 };
const RARITY_COLOR = { Common:0x94a3b8, Uncommon:0x4ade80, Rare:0x38bdf8, Epic:0xa855f7, Legendary:0xfbbf24 };
const rodRarity = c => c<=100?'Common':c<=500?'Uncommon':c<=1500?'Rare':c<=3000?'Epic':'Legendary';
const baitRarity = c => c<=30?'Common':c<=80?'Uncommon':c<=150?'Rare':c<=250?'Epic':'Legendary';
let invState = { cat:'all', sort:'name', q:'', sel:null };

function buildInvItems() {
  const fish = Object.keys(records).map(k => {
    const sp = SPECIES.find(s=>s.name===k); const r = records[k];
    return { id:'fish:'+k, cat:'fish', name:k, icon:'🐟', rarity:sp?.rarity||'Common',
      value:sp?.value||0, qty:r.totalCaught, time:r.lastCaught||0,
      desc:`Best ${r.maxWeight.toFixed(2)}kg - ${r.maxLength.toFixed(0)}cm`,
      color:sp?.color||0xffffff };
  });
  const rods = ownedRods.map(name => {
    const r = RODS.find(x=>x.name===name); if(!r) return null;
    return { id:'rod:'+name, cat:'rod', name, icon:r.icon, rarity:rodRarity(r.cost),
      value:r.cost, qty:1, time:0, desc:r.desc,
      stats:[['Reel','+'+Math.round((r.reelBonus||0)*100)+'%'],['Line','+'+(r.lineBonus||0)]] };
  }).filter(Boolean);
  const baits = BAITS.map(b => ({
    id:'bait:'+b.name, cat:'bait', name:b.name, icon:b.icon, rarity:baitRarity(b.cost),
    value:b.cost, qty:1, time:0, desc:'Bonus: '+b.bonus.join(', '),
    equipped:b.name===bait }));
  return [...fish,...rods,...baits];
}

const coinSVG = '<svg class="coin-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/><circle cx="12" cy="12" r="7" fill="none" stroke="#fde68a" stroke-width="1"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#92400e">¢</text></svg>';

function renderInv() {
  const all = buildInvItems();
  const {cat,q,sort,sel} = invState;
  let items = all.filter(i=>(cat==='all'||i.cat===cat)&&(!q||i.name.toLowerCase().includes(q)));
  const cmp = {
    name:(a,b)=>a.name.localeCompare(b.name),
    '-name':(a,b)=>b.name.localeCompare(a.name),
    rarity:(a,b)=>RARITY_ORDER[a.rarity]-RARITY_ORDER[b.rarity]||a.name.localeCompare(b.name),
    value:(a,b)=>b.value-a.value||a.name.localeCompare(b.name),
    qty:(a,b)=>b.qty-a.qty||a.name.localeCompare(b.name),
    '-time':(a,b)=>b.time-a.time||a.name.localeCompare(b.name),
  }[sort]||((a,b)=>0);
  items = [...items].sort(cmp);
  const grid = $('invGrid'), empty = $('invEmpty'), sum = $('invSummary');
  if(!grid) return;
  const fc = all.filter(i=>i.cat==='fish').length;
  const rc = all.filter(i=>i.cat==='rod').length;
  const bc = all.filter(i=>i.cat==='bait').length;
  if(sum) sum.innerHTML = `<span>\u{1F41F} ${fc}</span><span>\u{1F3A3} ${rc}</span><span>\u{1FAB1} ${bc}</span><span>\u{1F4B0} ${all.reduce((a,i)=>a+i.value,0)}</span>`;
  grid.innerHTML = items.map(i=>`<div class="inv-card inv-${i.cat}${i.id===sel?' inv-sel':''}${i.equipped?' inv-equipped':''}" data-id="${i.id}" style="--rc:${hex(RARITY_COLOR[i.rarity]||0xffffff)}"><div class="inv-card-head"><span class="inv-card-icon">${i.icon}</span><span class="inv-card-cat">${i.cat}</span></div><div class="inv-card-name">${i.name}</div><div class="inv-card-rarity rarity-${i.rarity.toLowerCase()}">${i.rarity}</div><div class="inv-card-meta">${i.qty>1?'<span>\u00D7'+i.qty+'</span>':''}<span>${i.value?coinSVG+i.value:'Free'}</span></div></div>`).join('');
  if(empty) empty.style.display = items.length?'none':'';
  grid.querySelectorAll('.inv-card').forEach(c=>c.addEventListener('click',()=>selectInv(c.dataset.id)));
}

function selectInv(id) {
  const all = buildInvItems(); const item = all.find(i=>i.id===id);
  invState.sel = id; renderInv();
  const det = $('invDetail'); if(!det||!item) return;
  det.innerHTML = `<div class="inv-det-head"><span class="inv-det-icon">${item.icon}</span><div><div class="inv-det-name">${item.name}</div><div class="inv-det-rarity rarity-${item.rarity.toLowerCase()}">${item.rarity} ${item.cat}</div></div></div><p class="inv-det-desc">${item.desc}</p>${item.stats?'<div class="inv-det-stats">'+item.stats.map(s=>'<span><b>'+s[0]+':</b> '+s[1]+'</span>').join('')+'</div>':''}${item.equipped?'<span class="inv-det-badge">Equipped</span>':''}`;
}

$('inventoryBtn').addEventListener('click', () => {
  renderInv();
  new bootstrap.Modal($('inventoryModal')).show();
});

document.querySelectorAll('.inv-cat').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.inv-cat').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    invState.cat = btn.dataset.cat; invState.sel = null;
    renderInv();
  });
});

$('invSearch')?.addEventListener('input', e => { invState.q = e.target.value.toLowerCase(); renderInv(); });
$('invSort')?.addEventListener('change', e => { invState.sort = e.target.value; renderInv(); });

function populateShop() {
  const rShop = $('rodShop');
  if (rShop) {
    rShop.innerHTML = '';
    RODS.forEach(r => {
      const isOwned = ownedRods.includes(r.name);
      const isEquipped = r.name === equippedRod;
      const canAfford = coins >= r.cost;
      const card = document.createElement('div');
      card.className = 'shop-card' + (isEquipped ? ' equipped' : '') + (!isOwned && !canAfford ? ' locked' : '');
      const bonusText = (r.reelBonus ? '+' + Math.round(r.reelBonus * 100) + '% Reel Speed' : '') + (r.reelBonus && r.lineBonus ? ' • ' : '') + (r.lineBonus ? '+' + r.lineBonus + ' Line Tension' : (r.reelBonus ? '' : 'Standard'));
      card.innerHTML = '<div class=\"shop-card-icon\">' + r.icon + '</div>' +
        '<div class=\"shop-card-title\">' + r.name + '</div>' +
        '<div class=\"shop-card-desc\">' + r.desc + '<br><small style="color:#fff">' + bonusText + '</small></div>' +
        '<div class=\"shop-card-meta\">' +
          '<span class=\"price ' + (isOwned ? 'free' : (canAfford ? 'afford' : '')) + '\">' + (isOwned ? (isEquipped ? 'Equipped' : 'Owned') : (r.cost === 0 ? 'Free' : '<svg class=\"coin-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#fbbf24\" stroke=\"#b45309\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"none\" stroke=\"#fde68a\" stroke-width=\"1\"/><text x=\"12\" y=\"16\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#92400e\">¢</text></svg> ' + r.cost)) + '</span>' +
          (isEquipped ? '<span class=\"badge bg-success\">Equipped</span>' : (isOwned ? '<button class=\"btn btn-xs btn-outline-info py-0 px-1\">Equip</button>' : '')) +
        '</div>';
      card.addEventListener('click', () => {
        if (r.name === equippedRod) return;
        if (ownedRods.includes(r.name)) {
          equippedRod = r.name;
          updateRodVisuals();
          save(); populateShop();
          toast('Equipped ' + r.name);
          return;
        }
        if (coins < r.cost) { toast('Not enough coins!'); return; }
        coins -= r.cost;
        ownedRods.push(r.name);
        equippedRod = r.name;
        updateRodVisuals();
        $('coins').textContent = coins;
        $('shopCoins').textContent = coins;
        save(); populateShop();
        toast('Purchased & equipped ' + r.name + '!');
      });
      rShop.appendChild(card);
    });
  }

  const shop = $('baitShop');
  shop.innerHTML = '';
  BAITS.forEach(b => {
    const owned = b.name === bait;
    const card = document.createElement('div');
    card.className = 'shop-card' + (owned ? ' equipped' : '') + (b.cost > coins && !owned ? ' locked' : '');
    card.innerHTML = '<div class=\"shop-card-icon\">' + b.icon + '</div>' +
      '<div class=\"shop-card-title\">' + b.name + '</div>' +
      '<div class=\"shop-card-desc\">Bonus: ' + b.bonus.join(', ') + '</div>' +
      '<div class=\"shop-card-meta\">' +
'<span class=\"price ' + (b.cost === 0 ? 'free' : (coins >= b.cost ? 'afford' : '')) + '\">' + (b.cost === 0 ? 'Free' : '<svg class=\"coin-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#fbbf24\" stroke=\"#b45309\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"none\" stroke=\"#fde68a\" stroke-width=\"1\"/><text x=\"12\" y=\"16\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#92400e\">¢</text></svg> ' + b.cost) + '</span>' +
        (owned ? '<span class=\"badge bg-success\">Equipped</span>' : '') +
      '</div>';
    card.addEventListener('click', () => {
      if (b.name === bait) return;
      if (coins < b.cost) { toast('Not enough coins!'); return; }
      coins -= b.cost; bait = b.name;
      $('coins').textContent = coins;
      $('baitName').textContent = bait;
      $('shopBaitName').textContent = bait;
      $('shopCoins').textContent = coins;
      save(); populateShop();
      toast('Equipped ' + bait);
    });
    shop.appendChild(card);
  });

  const upg = $('upgradeShop');
  upg.innerHTML = '';
  UPGRADES.forEach(u => {
    const lvl = upgrades[u.id] || 0;
    const maxed = lvl >= u.max;
    const cost = upgradeCost(u);
    const card = document.createElement('div');
    card.className = 'shop-card' + (maxed ? ' equipped' : (cost > coins ? ' locked' : ''));
    const dots = Array.from({ length: u.max }, (_, i) => '<i class=\"' + (i < lvl ? 'on' : '') + '\"></i>').join('');
    card.innerHTML = '<div class=\"shop-card-icon\">' + u.icon + '</div>' +
      '<div class=\"shop-card-title\">' + u.name + '</div>' +
      '<div class=\"shop-card-desc\">' + u.desc + '</div>' +
      '<div class=\"lvl-dots\">' + dots + '</div>' +
      '<div class=\"shop-card-meta\">' +
'<span class=\"price ' + (maxed ? 'free' : (coins >= cost ? 'afford' : '')) + '\">' + (maxed ? 'MAX' : '<svg class=\"coin-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#fbbf24\" stroke=\"#b45309\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"none\" stroke=\"#fde68a\" stroke-width=\"1\"/><text x=\"12\" y=\"16\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#92400e\">¢</text></svg> ' + cost) + '</span>' +
        '<span class=\"badge bg-secondary\">Lv ' + lvl + '/' + u.max + '</span>' +
      '</div>';
    card.addEventListener('click', () => {
      if (maxed) return;
      if (coins < cost) { toast('Not enough coins!'); return; }
      coins -= cost;
      upgrades[u.id] = lvl + 1;
      $('coins').textContent = coins;
      $('shopCoins').textContent = coins;
      save(); populateShop();
      toast(u.name + ' → Lv ' + upgrades[u.id]);
    });
    upg.appendChild(card);
  });

  $('shopCoins').textContent = coins;
  $('shopBaitName').textContent = bait;
  if ($('shopRodName')) $('shopRodName').textContent = equippedRod;
  populateStats();
}

function populateStats() {
  $('statCaught').textContent = caught.length;
  $('statCoinsEarned').textContent = totalCoinsEarned;
  let best = null;
  for (const [k, r] of Object.entries(records)) if (!best || r.maxWeight > best.w) best = { k, w: r.maxWeight };
  $('statBest').textContent = best ? best.w.toFixed(2) + ' kg' : '—';
  const totalUp = Object.values(upgrades).reduce((a, b) => a + b, 0);
  const maxUp = UPGRADES.length * UPGRADES[0].max;
  $('statUpgrades').textContent = totalUp + '/' + maxUp;
  const det = $('statsDetails');
  const recs = Object.keys(records);
  let html = '<h6 class="mt-3">Personal Records</h6>';
  if (recs.length === 0) html += '<p class="small text-white-50">No catches yet — go cast a line!</p>';
  else html += recs.map(k => '<div class="d-flex justify-content-between small py-1"><span>' + k + ' <small class="text-white-50">×' + records[k].totalCaught + '</small></span><b>' + records[k].maxWeight.toFixed(2) + ' kg</b></div>').join('');
  det.innerHTML = html;
  renderPedia();
}

function toast(msg) {
  const stack = $('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; el.style.transition = 'all .3s'; }, 1400);
  setTimeout(() => el.remove(), 1800);
}

document.querySelectorAll('.shop-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.shop-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    $('tab-' + target).classList.add('active');
  });
});

const applyToggle = (id, key) => {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    settings[key] = !settings[key];
    btn.classList.toggle('on', settings[key]);
    btn.setAttribute('aria-pressed', settings[key]);
    save();
  });
};
applyToggle('toggleSfx', 'sfx');
applyToggle('toggleMusic', 'music');
applyToggle('toggleShake', 'shake');
applyToggle('toggleSafe', 'safe');
applyToggle('toggleMotion', 'motion');
applyToggle('toggleBlur', 'blur');

$('volumeRange').addEventListener('input', e => { settings.volume = +e.target.value; SoundManager.setVolume(settings.volume); save(); });
$('qualitySelect').addEventListener('change', e => { settings.quality = e.target.value; save(); });

$('exportBtn').addEventListener('click', () => {
  const data = JSON.stringify({ coins, caught, records, bait, equippedRod, ownedRods, upgrades, settings, totalCoinsEarned }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'fishing-save.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Save exported');
});

$('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset all progress? This cannot be undone.')) return;
  localStorage.removeItem('fishSave');
  coins = 0; caught = []; records = {}; bait = 'Worm'; equippedRod = 'Starter Rod'; ownedRods = ['Starter Rod'];
  upgrades = { rod: 0, line: 0, reel: 0, bait: 0 };
  settings = { sfx: true, music: true, volume: 80, shake: true, safe: true, motion: false, quality: 'high', blur: true };
  SoundManager.setVolume(settings.volume);
  tutorialsSeen = {};
  $('coins').textContent = coins;
  $('baitName').textContent = bait;
  if ($('rodName')) $('rodName').textContent = equippedRod;
  $('collectionCount').textContent = '0/5';
  populateShop();
  toast('Progress reset');
});

$('coins').textContent = coins;
$('baitName').textContent = bait;
if ($('rodName')) $('rodName').textContent = equippedRod;
updateRodVisuals();
$('collectionCount').textContent = caught.length + '/' + SPECIES.length;
const L = kg => (kg * 2.20462).toFixed(1);
const renderCollection = () => {
  const el = $('collection');
  if (!el) return;
  el.innerHTML = SPECIES.map(sp => {
    const got = caught.includes(sp.name);
    const r = records[sp.name];
    return '<div class="sp"><span class="' + (got ? 'rarity-' + sp.rarity.toLowerCase() : '') + '" style="opacity:' + (got ? 1 : .5) + '">' + (got ? '✓ ' : '? ') + sp.name + '</span><b style="font-size:.7rem;opacity:.7">' + (got && r ? L(r.maxWeight) + ' lb' : sp.rarity) + '</b></div>';
  }).join('');
};
const renderRecords = () => {
  const el = $('records');
  if (!el) return;
  const keys = Object.keys(records);
  if (keys.length === 0) { el.innerHTML = '<div class="sp" style="opacity:.5"><span>No records yet</span></div>'; return; }
  const medal = ['🥇','🥈','🥉'];
  el.innerHTML = keys.sort((a, b) => records[b].maxWeight - records[a].maxWeight).slice(0, 5).map((k, i) =>
    '<div class="sp"><span>' + (medal[i] ? medal[i] + ' ' : '') + k + '</span><b>' + L(records[k].maxWeight) + ' lb</b></div>'
  ).join('');
};
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function renderPedia(name) {
  const grid = $('pediaGrid');
  if (!grid) return;
  const cnt = $('pediaCount');
  if (cnt) cnt.textContent = caught.length + '/' + SPECIES.length;
  grid.innerHTML = SPECIES.map(sp => {
    const got = !!records[sp.name];
    return '<button class="pedia-card' + (got ? '' : ' fish-silhouette') + (name === sp.name ? ' sel' : '') + '" data-name="' + sp.name + '" style="--fc:' + hex(sp.color) + '" title="' + (got ? sp.name : '???') + '"><span class="pedia-icon">🐟</span><span class="pedia-name">' + (got ? sp.name : '???') + '</span></button>';
  }).join('');
  const det = $('pediaDetail');
  const sp = SPECIES.find(s => s.name === name);
  if (det) det.innerHTML = (sp && records[sp.name])
    ? '<h6 class="rarity-' + sp.rarity.toLowerCase() + '">' + sp.name + ' <small>· ' + sp.rarity + '</small></h6>' +
      '<p class="pedia-lore">' + sp.lore + '</p>' +
      '<div class="pedia-bests"><span>⚖️ Best ' + records[sp.name].maxWeight.toFixed(2) + 'kg</span>' +
      '<span>📏 Longest ' + records[sp.name].maxLength.toFixed(0) + 'cm</span>' +
      '<span>🎣 Caught ' + records[sp.name].totalCaught + '×</span></div>'
    : '<p class="text-white-50 small">' + (sp ? 'Not yet discovered — cast a line to reveal its secrets.' : 'Select a species to view its lore and your personal bests.') + '</p>';
}
$('pediaGrid')?.addEventListener('click', e => {
  const b = e.target.closest('.pedia-card');
  if (b) renderPedia(b.dataset.name);
});
renderCollection();
renderRecords();
const refreshLeftPanel = () => { $('collectionCount').textContent = caught.length + '/' + SPECIES.length; renderCollection(); renderRecords(); renderPedia(lastCatch?.fish?.name); };
idleHint();
const clock = new THREE.Clock();
let time = 0;

// Water surface mesh (animated in animate loop)
// Beginning screen: top-down water with swimming fish, destroyed on transition to fishing scene.
const titleScreenEl = $('titleScreen'), titleBtn = $('titleBtn');
const hasSave = coins > 0 || (caught && caught.length > 0) || Object.keys(records).length > 0;
titleBtn.textContent = hasSave ? 'Continue' : 'Start';
const titleScene = new THREE.Scene();
titleScene.background = new THREE.Color(0x08405a);
titleScene.fog = new THREE.Fog(0x08405a, 14, 34);
const titleCam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
const titleWaterGeo = new THREE.PlaneGeometry(80, 80, 40, 40);
const titleWaterMesh = new THREE.Mesh(titleWaterGeo, new THREE.MeshPhongMaterial({ color: 0x0d4f6e, emissive: 0x03141f, specular: 0x99ddff, shininess: 80, flatShading: false }));
titleWaterMesh.rotation.x = -Math.PI / 2;
titleScene.add(titleWaterMesh);
const titleTw = titleWaterGeo.attributes.position.array;
const titleTB = Float32Array.from(titleTw);
const titleLight = new THREE.DirectionalLight(0xcfeeff, 1.5);
titleLight.position.set(6, 18, 4);
titleScene.add(titleLight, new THREE.AmbientLight(0x6fb7d8, 0.7));
const titleFish = [];
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group();
  const len = 0.5 + Math.random() * 0.9;
  const body = new THREE.Mesh(new THREE.ConeGeometry(len * 0.22, len, 6), new THREE.MeshStandardMaterial({ color: [0x2b6f8f, 0x3f8f7a, 0x8f7a3f, 0x6f4f8f][i % 4], roughness: 0.6, metalness: 0.2, flatShading: true }));
  body.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(len * 0.16, len * 0.4, 4), body.material);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = len * 0.6;
  g.add(body, tail);
  g.position.set((Math.random() - 0.5) * 26, -0.4 - Math.random() * 1.4, (Math.random() - 0.5) * 26);
  g.userData = { ang: Math.random() * Math.PI * 2, spd: 0.35 + Math.random() * 0.55, rad: 3 + Math.random() * 9, cx: g.position.x, cz: g.position.z, ph: Math.random() * 6.28, tail };
  titleScene.add(g);
  titleFish.push(g);
}
titleCam.position.set(0, 13, 4.2);
titleCam.lookAt(0, 0, 0);
let titleActive = true, titleT = 0;
function updateTitleScene(dt) {
  titleT += dt;
  for (let i = 0; i < titleTB.length; i += 3) titleTw[i + 2] = Math.sin(titleT * 1.1 + titleTB[i] * 0.22 + titleTB[i + 1] * 0.18) * 0.16 + Math.cos(titleT * 0.7 + titleTB[i] * 0.1) * 0.1;
  titleWaterGeo.attributes.position.needsUpdate = true;
  titleFish.forEach(f => {
    const d = f.userData;
    d.ang += d.spd * dt * 0.5;
    f.position.x = d.cx + Math.cos(d.ang) * d.rad;
    f.position.z = d.cz + Math.sin(d.ang) * d.rad * 0.7;
    f.rotation.y = Math.PI / 2 - d.ang;
    d.tail.rotation.y = Math.sin(titleT * 8 + d.ph) * 0.6;
  });
  titleCam.position.x = Math.sin(titleT * 0.17) * 0.5 + Math.sin(titleT * 0.41) * 0.12;
  titleCam.position.y = 13 + Math.sin(titleT * 0.23) * 0.35;
  titleCam.lookAt(Math.sin(titleT * 0.19) * 0.6, 0, Math.cos(titleT * 0.13) * 0.6);
}
function disposeTitleScene() {
  titleScene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}
function leaveTitleScene() {
  if (!titleActive) return;
  titleActive = false;
  titleScreenEl.classList.add('title-hide');
  document.body.classList.add('in-game');
  setTimeout(() => { titleScreenEl.remove(); disposeTitleScene(); }, 750);
  isGamePaused = false;
  idleHint();
  setTimeout(() => showFirstTimeGuide(false), 900);
}
titleBtn.addEventListener('click', () => {
  triggerHaptic(20);
  const a = SoundManager.get('ambience1');
  if (a && !a.voices.size) a.play();
  leaveTitleScene();
});
addEventListener('resize', () => { titleCam.aspect = innerWidth / innerHeight; titleCam.updateProjectionMatrix(); });

const waterGeo = new THREE.PlaneGeometry(160, 160, 64, 64);
const waterMat = new THREE.MeshPhongMaterial({
  color: 0x125d7c,
  emissive: 0x052233,
  specular: 0x99ddff,
  shininess: 90,
  transparent: true,
  opacity: 0.92,
  side: THREE.DoubleSide,
  flatShading: false
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.receiveShadow = true;
scene.add(waterMesh);
const waterVerts = waterGeo.attributes.position.array;
const waterBaseY = [];
for (let i = 0; i < waterGeo.attributes.position.count; i++) {
  waterBaseY.push(0);
}
function animate() {

  requestAnimationFrame(animate);
  syncReelSound();
  const rawDt = clock.getDelta();
  if (isGamePaused) {
    if (titleActive) { updateTitleScene(Math.min(rawDt, 0.1)); renderer.render(titleScene, titleCam); }
    else renderer.render(scene, camera);
    return;
  }
  const dt = Math.min(rawDt, 0.1);
  time += dt;
  if (streak > 0 && state === S.IDLE) { streakIdle += dt; if (streakIdle > 20) { streak = 0; streakIdle = 0; } updateStreakBadge(); } else if (streak > 0 && streakIdle > 0) { streakIdle = 0; updateStreakBadge(); }
  dayTime = (dayTime + dt * 0.02) % 1;
  const timeOfDay = $('timeOfDay');
  timeOfDay.textContent = dayTime < 0.25 ? 'Dawn' : dayTime < 0.5 ? 'Day' : dayTime < 0.75 ? 'Dusk' : 'Night';

    jiggleCooldown = Math.max(0, jiggleCooldown - dt);
    jiggleT = Math.max(0, jiggleT - dt);

    let hasFishSwimmingBy = false;
    fish.forEach(f => {
      const d = f.userData;
      if (f === hookedFish) return;
      if (!d.school && d.species === undefined) { d.species = pickFish(); d.mat.color.setHex(d.species.color); }
      const toBobber = new THREE.Vector3(bobberX - f.position.x, 0, bobberZ - f.position.z);
      const dist = toBobber.length();
      
      if (state === S.WAITING && bobber.visible && dist < 10) {
        hasFishSwimmingBy = true;
      }
      
      if (state === S.WAITING && bobber.visible && dist < 8 && !d.school) {
        if (d.isInterested === undefined) d.isInterested = Math.random() < 0.4;
        if (jiggleT > 0 && dist < 6) {
          d.isInterested = true;
          d.curiosity = (d.curiosity || 0) + dt * 4;
        }
      } else if (state !== S.NIBBLE && state !== S.BITE) {
        d.isInterested = undefined;
      }

    if (d.isInterested) {
      d.curiosity = (d.curiosity || 0) + dt;
      const targetAngle = Math.atan2(toBobber.x, toBobber.z) + Math.PI;
      const dirX = dist > 0.001 ? toBobber.x / dist : 0;
      const dirZ = dist > 0.001 ? toBobber.z / dist : 0;
      if (dist > 2.2) {
        // close the gap: actually swim toward the bait instead of hovering in place
        const step = (2.2 + (d.size || 0.3)) * dt * Math.min(1, 0.5 + dist / 8);
        f.position.x += dirX * step;
        f.position.z += dirZ * step;
      } else {
        // within reach: circle the bobber like a fish inspecting the hook
        d.orbit = (d.orbit || 0) + dt * (1.1 + Math.min(2, d.curiosity) * 0.25);
        const r = 1.3 + Math.sin(d.curiosity * 0.8) * 0.4;
        f.position.x = THREE.MathUtils.lerp(f.position.x, bobberX + Math.cos(d.orbit) * r, Math.min(1, dt * 4));
        f.position.z = THREE.MathUtils.lerp(f.position.z, bobberZ + Math.sin(d.orbit) * r, Math.min(1, dt * 4));
      }
      f.rotation.y = THREE.MathUtils.lerp(f.rotation.y, targetAngle, Math.min(1, dt * 4));
      if (state === S.WAITING && dist < 1.6 && d.curiosity > 2) {
        state = S.NIBBLE;
        nibbleFish = f;
        currentFish = d.species;
        setHint('Something is nibbling...', 'hint-nibble');
        spawnSplash(bobberX, bobberZ, 8, 0xffffff);
        SoundManager.play('splash2', { x: bobberX, y: bobber.position.y, z: bobberZ });
        shake = 0.5;
        setTimeout(() => {
          if (state === S.NIBBLE && nibbleFish === f) {
            state = S.BITE;
            currentFish = d.species;
            d.curiosity = -5;
            d.isInterested = false;
            triggerBite();
          }
        }, 2000);
  }
    } else {
      d.curiosity = Math.max(0, (d.curiosity || 0) - dt);
      d.angle += d.speed * dt * (d.school ? 1.2 : 0.6);
      f.position.x = Math.cos(d.angle) * d.radius;
      f.position.z = Math.sin(d.angle) * d.radius;
      f.rotation.y = Math.PI / 2 - d.angle;
    }

    f.position.y = d.depth + Math.sin(time * d.bobSpeed + d.tailPhase) * d.bobAmp;
    f.rotation.z = Math.sin(time * d.bobSpeed + d.tailPhase) * 0.15 + (d.school ? 0.15 : 0.3) * Math.cos(d.angle);
    const wag = Math.sin(time * (d.school ? 14 : 9) + d.tailPhase);
    d.tail.rotation.y = wag * (d.school ? 0.5 : 0.7);
    f.children[0].rotation.y = wag * 0.1;
  });

  if (state === S.WAITING && bobber.visible) {
    waitingWithoutProdTimer += dt;
    if (waitingWithoutProdTimer >= 4.5 && hasFishSwimmingBy && !tutorialsSeen['jiggle_bob']) {
      showJiggleGuide();
    }
  } else {
    waitingWithoutProdTimer = 0;
  }

  clouds.forEach(c => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 70) c.position.x = -70;
  });
  // Dynamic weather cycle: Clear, Rain, Foggy
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    // Pick next weather randomly
    const roll = Math.random();
    let nextW = 'Clear';
    if (currentWeather === 'Clear') {
      nextW = roll < 0.5 ? 'Foggy' : 'Rain';
      weatherTimer = 12 + Math.random() * 14;
    } else {
      nextW = roll < 0.65 ? 'Clear' : (currentWeather === 'Rain' ? 'Foggy' : 'Rain');
      weatherTimer = 14 + Math.random() * 16;
    }
    setWeather(nextW);
  }

  // Rain particle simulation
  const rainOn = (currentWeather === 'Rain');
  rain.visible = rainOn;
  if (rainOn) {
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 3 + 1] -= rainVel[i] * dt;
      rainPos[i * 3] -= 4 * dt;
      if (rainPos[i * 3 + 1] < 0) resetRainDrop(i);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // Fog mist puffs simulation
  const isFoggy = (currentWeather === 'Foggy');
  const targetFogDensity = isFoggy ? 0.048 : (rainOn ? 0.016 : 0.007);
  curFogDensity += (targetFogDensity - curFogDensity) * Math.min(1, dt * 1.2);
  scene.fog.density = curFogDensity;

  fogPuffs.forEach(p => {
    p.position.x += p.userData.speed * dt;
    if (p.position.x > 40) p.position.x = -40;
    const targetOp = isFoggy ? p.userData.baseOpacity : 0;
    p.material.opacity += (targetOp - p.material.opacity) * Math.min(1, dt * 2.0);
    p.position.y = 0.3 + Math.sin(time * 0.8 + p.userData.phase) * 0.15;
  });

  // Lightning: chance to strike while raining
  if (rainOn) {
    boltTimer -= dt;
    if (boltTimer <= 0) {
      strikeLightning();
      boltTimer = 2 + Math.random() * 5;
    }
    boltLife -= dt;
    if (boltLife <= 0) bolt.visible = false;
    flash.intensity = Math.max(0, flash.intensity - dt * 25);
  } else {
    bolt.visible = false;
    flash.intensity = 0;
  }

  if (Math.random() < 0.005) spawnBird();

  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    b.position.x += b.userData.vx * dt;
    b.position.y += Math.sin(time * 2 + b.userData.phase) * dt * 0.3;
    b.rotation.z = Math.sin(time * 10 + b.userData.phase) * 0.5;
    if (b.userData.vx > 0 ? b.position.x >= b.userData.exitX : b.position.x <= b.userData.exitX) {
      scene.remove(b);
      birds.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= dt;
    p.position.x += p.userData.vx * dt;
    p.position.y += p.userData.vy * dt;
    p.position.z += p.userData.vz * dt;
    p.userData.vy -= 9.8 * dt;
    p.material.opacity = Math.max(0, p.userData.life);
    if (p.userData.life <= 0 || p.position.y < -0.5) {
      scene.remove(p);
      p.material.dispose();
      particles.splice(i, 1);
    }
  }
  const day = Math.max(0, Math.sin(dayTime * Math.PI * 2));
  let dayColor = new THREE.Color().lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0xff7733), day * 0.5).multiplyScalar(day);
  if (isFoggy) {
    const fogTint = new THREE.Color(0xc2d0db).multiplyScalar(Math.max(0.15, day));
    dayColor.lerp(fogTint, 0.7);
  } else if (rainOn) {
    const rainTint = new THREE.Color(0x4a5a68).multiplyScalar(Math.max(0.1, day));
    dayColor.lerp(rainTint, 0.55);
  }
  scene.background = dayColor;
  scene.fog.color = dayColor;
  const sunWeatherMult = isFoggy ? 0.65 : (rainOn ? 0.5 : 1.0);
  sun.intensity = day * day * 1.4 * sunWeatherMult;
  sun.color.setHSL(0.1, 0.4, 0.5 + day * 0.5);

  if (state === S.IDLE) {
    aim = 0.25 + (Math.sin(time * 2) + 1) / 4;
    setMeter(aimMeter, aim * 100);
  }
  if (state === S.CHARGING) {
    power = Math.min(1, power + dt * 0.9);
    setMeter(powerMeter, power * 100);
  }
  if (state === S.WAITING) {
    if (hintAnim && (hintDotT += dt) > 0.4) { hintDotT = 0; hintDots = (hintDots + 1) % 4; hint.textContent = hintBase + '.'.repeat(hintDots); }
  }
if (state === S.REELING && currentFish) {
    reelLockout = Math.max(0, reelLockout - dt);
    canReel = reeling && !reelLockout;
    const curRod = RODS.find(r => r.name === equippedRod) || RODS[0];
    const rodReelMult = 1 + (curRod.reelBonus || 0);
    const rodLineBonus = curRod.lineBonus || 0;
    const lineBonus = 1 + (upgrades.line || 0) * 0.015;
    const dashShrink = isDashing ? 0.8 : 1;
    const safeLo = Math.max(0, 48 * (isDashing ? 0.92 : 1));
    const safeHi = Math.min(92, (58 * lineBonus + (curRod.perk === 'safeHi' ? 8 : 0)) * dashShrink);
    const s = currentFish.strength;
    const staminaRatio = stamina / maxStamina;
    const reelRatio = reel / 100;
    const fatigue = Math.max(0.25, staminaRatio * 0.7 + reelRatio * 0.3);
    const baseTarget = canReel ? 58 + s * 2.0 * staminaRatio * (1 - reelRatio * 0.7) : 8;
    const dashSpike = isDashing ? Math.min(s * 7, 35) * fatigue : 0;
    const osc = (Math.sin(time * 4 + s) * (6 + s * 0.8) + Math.sin(time * 7.3) * 4) * fatigue;
    const jitter = (Math.random() - 0.5) * s * 1.2 * fatigue;
    const target = baseTarget + dashSpike + osc + jitter;
    tension += (target - tension) * dt * (isDashing ? 6 : 4);
    const tensionInRange = tension >= safeLo && tension <= safeHi;
    dashTimer -= dt;
    if (dashTimer <= 0 && !isDashing) {
      isDashing = true;
      dashDuration = (0.6 + Math.random() * 0.8) * Math.max(0.3, fatigue);
      shakeIntensity = Math.max(shakeIntensity, 0.2);
    }
    if (isDashing) {
      dashDuration -= dt;
      if (dashDuration <= 0) {
        isDashing = false;
        dashTimer = (2 + Math.random() * (4 - currentFish.speed * 0.3)) * Math.max(0.5, fatigue);
      }
    }

    const reelEff = Math.max(0.4, 1 - (upgrades.reel || 0) * 0.1);
    if (canReel) stamina -= dt * (3 + currentFish.strength * 0.5) * reelEff * (curRod.perk === 'staminaDrain' && isFightingBack ? 0.5 : 1);
    else stamina = Math.min(maxStamina, stamina + dt * 1.5);
    if (hookedFish && hookedFish.userData.bar) {
      const ratio = Math.max(0, stamina / maxStamina);
      hookedFish.userData.bar.scale.x = Math.max(0.01, ratio);
      hookedFish.userData.bar.material.color.setRGB((1 - ratio) * 0.8 + 0.1, ratio * 0.7 + 0.2, 0.1);
    }


    const distFromDock = Math.sqrt(bobberX * bobberX + (bobberZ - 4) * (bobberZ - 4));
    const distRatio = initialReelDist > 0 ? Math.max(0, Math.min(1, distFromDock / initialReelDist)) : 0;
    const bobberProgress = (1 - distRatio) * 100;
    if (canReel && tension >= safeLo && tension <= safeHi) {
      reel += dt * (10 + gear * 5) * (1 + (upgrades.rod || 0) * 0.15) * rodReelMult;
      if (reel > bobberProgress) {
        const moveRate = (reel - bobberProgress) * dt * 0.5;
        if (!isFightingBack) {
          const dx = -bobberX, dz = 4 - bobberZ;
          const d = Math.hypot(dx, dz) || 1;
          bobberX += (dx / d) * moveRate;
          bobberZ += (dz / d) * moveRate;
        }
      }
    }
    if (reelLockout) { /* grace period: no escape penalty */ }
    else if (!reeling || tension < safeLo) {
      escapeProgress += dt * (8 + currentFish.speed * 2) * (tension < safeLo ? 1.5 : 0.4) * (curRod.perk === 'currentResist' ? 0.6 : 1);
    } else {
      escapeProgress = Math.max(0, escapeProgress - dt * 4);
    }
    reel = Math.max(reel, bobberProgress);

    fightBackTimer -= dt;
    if (fightBackTimer <= 0 && !isFightingBack) {
      isFightingBack = true;
      fightBackDuration = 0.3 + Math.random() * 0.45;
      const ang = Math.atan2(bobberX, bobberZ - 4) + (Math.random() - 0.5) * 2.8;
      fightBackDir.x = Math.sin(ang);
      fightBackDir.z = Math.cos(ang);
      tension = Math.min(100, tension + 14 + currentFish.strength * 3.2 + Math.random() * 10);
      shakeIntensity = Math.max(shakeIntensity, 0.35);
      spawnSplash(bobberX, bobberZ, 10, currentFish.color);
      SoundManager.play('reelpull', { x: bobberX, y: bobber.position.y, z: bobberZ });
    }
    if (isFightingBack) {
      fightBackDuration -= dt;
      const swimSpeed = (2.5 + currentFish.strength * 0.6) * dt;
      bobberX += fightBackDir.x * swimSpeed;
      bobberZ += fightBackDir.z * swimSpeed;
      const dist = Math.hypot(bobberX, bobberZ - 4);
      if (dist > 28) { bobberX -= fightBackDir.x * swimSpeed; bobberZ -= fightBackDir.z * swimSpeed; }
      if (tension < safeLo || tension > safeHi) reel = Math.max(0, reel - dt * (20 + currentFish.strength * 3));
      if (fightBackDuration <= 0) {
        isFightingBack = false;
        fightBackTimer = 1.5 + Math.random() * 1.5;
      }
    }
    if (tension > 92 + (upgrades.line || 0) * 0.5 + rodLineBonus) { endCatch(false); }
    else if (escapeProgress >= 100) { endCatch(false); }
    else if (reel >= 100) { endCatch(true); }
    if (tension > safeHi) adrenaline = Math.min(100, adrenaline + dt * 40);
    else adrenaline = Math.max(0, adrenaline - dt * 18);
    if (tension > safeHi) shakeIntensity = Math.max(shakeIntensity, (tension - safeHi) * 0.012);

    if (state !== S.REELING) { /* endCatch already ran — keep snap hint */ }
    else if (tension > safeHi) setHint('⚠️ LINE TOO TENSE! Release LEFT CLICK!', 'hint-reel-danger');
    else if (isFightingBack) setHint('🐟 Fish is fighting back! Hold on!', 'hint-reel-danger');
    else if (escapeProgress > 50) setHint('🐟 Fish is escaping! Reel now!', 'hint-reel-danger');
    else if (isDashing) setHint('💥 DASH! Hold steady!', 'hint-reel');
    else if (canReel) setHint('✓ Good tension — keep reeling!', 'hint-reel');
    else if (reelLockout) setHint('🎣 Fish is hooked! Wait a moment...', 'hint-reel');
    else setHint(isTouch ? 'Hold REEL button' : 'Hold LEFT CLICK to reel', 'hint-reel');

    setMeter(tensionMeter, tension);
    setMeter(reelMeter, reel);
    setMeter(adrenalineMeter, adrenaline);
    setMeter(fightMeter, currentFish ? fightStamina / (currentFish.stamina * 8) * 100 : 0);
    adrenalineBtn.disabled = adrenaline < 100;
    const reelBox = reelMeter.parentElement;
    reelBox.classList.toggle('reeling-active', canReel && tension >= safeLo && tension <= safeHi);
    reelBox.classList.toggle('reeling-danger', tension > safeHi || escapeProgress > 50 || isFightingBack);
  } else {
    setMeter(reelMeter, 0);
    setMeter(fightMeter, 0);
    reelMeter.parentElement.classList.remove('reeling-active', 'reeling-danger');
  }

if (bobber.visible) {
    if (state === S.CASTING) {
      // Sub-step projectile physics for accurate collision and bounce
      const steps = 3;
      const subDt = Math.min(0.04, dt) / steps;
      for (let s = 0; s < steps; s++) {
        // Apply gravity and slight air drag (hook / bobber aerodynamics)
        bobberVel.y -= 18.0 * subDt;
        bobberVel.x *= (1 - 0.25 * subDt);
        bobberVel.z *= (1 - 0.25 * subDt);

        bobberPos.x += bobberVel.x * subDt;
        bobberPos.y += bobberVel.y * subDt;
        bobberPos.z += bobberVel.z * subDt;

        const groundInfo = getGroundElevation(bobberPos.x, bobberPos.z);
        const waterY = getWaterSurfaceY(bobberPos.x, bobberPos.z, time);

        if (groundInfo.isLand) {
          // Check collision with solid ground/dock/rock/bank
          const groundY = groundInfo.elevation;
          if (bobberPos.y <= groundY) {
            bobberPos.y = groundY;
            const speed = bobberVel.length();

            if (Math.abs(bobberVel.y) > 0.8 || speed > 1.2) {
              // Decent bounce physics respective to hook / bobber
              const restitution = groundInfo.isRock ? 0.45 : (groundInfo.isDock ? 0.40 : 0.35);
              const friction = groundInfo.isRock ? 0.65 : 0.55;
              bobberVel.y = -bobberVel.y * restitution;
              bobberVel.x = bobberVel.x * friction + (Math.random() - 0.5) * 0.4;
              bobberVel.z = bobberVel.z * friction + (Math.random() - 0.5) * 0.4;
              bounceCount++;
              spawnLandDust(bobberPos.x, bobberPos.y, bobberPos.z, 6 + Math.min(10, Math.floor(speed * 2)), groundInfo.isDock);
              playBounceSound(groundInfo.isDock, Math.min(1.5, speed / 6));
              triggerHaptic(15);
            } else {
              // Settled on land!
              bobberVel.set(0, 0, 0);
              bobberX = bobberPos.x;
              bobberZ = bobberPos.z;
              state = S.LAND;
              setHint('⚠️ Bobber landed on ground! Right-click to recast', 'hint-land');
              triggerHaptic([30, 50, 30]);
              break;
            }
          }
        } else {
          // Over open lake water
          if (bobberPos.y <= waterY) {
            // Hit water!
            bobberPos.y = waterY + 0.1;
            bobberX = bobberPos.x;
            bobberZ = bobberPos.z;
            bobberVel.set(0, 0, 0);
            spawnSplash(bobberX, bobberZ, 14, 0xaaddff);
            playSplashSound(bobberX, bobberPos.y, bobberZ);
            triggerHaptic(25);
            state = S.WAITING;
            setHint('Waiting for fish', 'hint-cast', true);
            waitingWithoutProdTimer = 0;
            break;
          }
        }
      }

      bobber.position.copy(bobberPos);
      bobber.rotation.x += (bobberVel.z * 1.5 + 4) * dt;
      bobber.rotation.z += (-bobberVel.x * 1.5 + 6) * dt;
    } else if (state === S.LAND) {
      const g = getGroundElevation(bobberX, bobberZ);
      bobber.position.set(bobberX, Math.max(0, g.elevation) + 0.08, bobberZ);
      bobber.rotation.x = Math.PI * 0.4;
      bobber.rotation.z = Math.sin(time * 2) * 0.05;
    } else if (state === S.REELING) {
      const targetX = 0, targetZ = 4;
      const pull = canReel ? Math.min(1, reel / 100) : 0;
      if (!isFightingBack) {
        bobberX += (targetX - bobberX) * pull * dt;
        bobberZ += (targetZ - bobberZ) * pull * dt;
      }
      bobber.position.set(bobberX, 0.1 + Math.sin(time * 6) * 0.08, bobberZ);
      if (hookedFish) {
        if (isFightingBack) {
          hookedFish.position.set(bobberX, -0.15 + Math.sin(time * 4) * 0.1, bobberZ);
          hookedFish.rotation.y = Math.atan2(fightBackDir.x, fightBackDir.z);
          hookedFish.rotation.z = Math.sin(time * 12) * 0.3;
        } else {
          hookedFish.position.x += (targetX - hookedFish.position.x) * pull * dt;
          hookedFish.position.z += (targetZ - hookedFish.position.z) * pull * dt;
          hookedFish.position.y = -0.15 + Math.sin(time * 4) * 0.1;
          hookedFish.rotation.set(Math.sin(time * 6) * 0.15, Math.sin(time * 3) * 0.4, Math.sin(time * 8) * 0.2);
        }
        if (hookedFish.userData.tail) hookedFish.userData.tail.rotation.y = Math.sin(time * (isFightingBack ? 22 : 15)) * (isFightingBack ? 1.2 : 0.8);
        const lbl = hookedFish.userData.label;
        if (lbl) lbl.position.set(hookedFish.position.x, hookedFish.position.y + 0.8, hookedFish.position.z);
      }
    } else if (state === S.NIBBLE) {
      const dip = -0.1 + Math.sin(time * 20) * 0.03;
      bobber.position.set(bobberX, dip, bobberZ);
    } else if (state === S.BITE && biteActive) {
      const dip = -0.3 + Math.sin(time * 30) * 0.05;
      bobber.position.set(bobberX, dip, bobberZ);
    } else {
      const jiggleOff = jiggleT > 0 ? Math.sin(time * 40) * 0.1 : 0;
      bobber.position.set(bobberX + jiggleOff, 0.1 + Math.sin(time * 3) * 0.05, bobberZ + jiggleOff);
    }

    if ((state === S.BITE && biteActive) || state === S.WAITING || state === S.NIBBLE) {
      ripple.visible = true;
      ripple.position.set(bobberX, 0.02, bobberZ);
      const isBite = state === S.BITE;
      const isNibble = state === S.NIBBLE;
      const phase = (time * (isBite ? 4 : (isNibble ? 3 : 2))) % 1;
      const s = (isBite ? 1.5 : (isNibble ? 1.2 : 1)) + phase * 2;
      ripple.scale.set(s, s, s);
      rippleMat.opacity = (isBite ? 0.8 : (isNibble ? 0.6 : 0.4)) * (1 - phase);
    } else {
      ripple.visible = false;
    }
  }

  shake = Math.max(0, shake - dt * 2);
  const shakeMul = settings.shake ? 1 : 0;
  shakeIntensity = Math.max(0, shakeIntensity - dt * 0.5);
  const st = performance.now() * 0.05;
  const sx = Math.sin(st) * shakeIntensity * (shake + 0.3) * shakeMul;
  const sy = Math.cos(st * 1.1) * shakeIntensity * (shake + 0.3) * shakeMul;
  camera.position.set(sx, 1.75 + sy, 3.5);

  const rt = ROD[state] || ROD[S.IDLE];
  rodT.x += (rt.x - rodT.x) * Math.min(1, dt * 8);
  rodT.z += (rt.z - rodT.z) * Math.min(1, dt * 8);
  reelPhase = (window.reelPhase || 0) + (canReel && state === S.REELING ? dt * 20 : 0);
  const fightBend = isFightingBack ? Math.sin(time * 18) * .25 - .2 : 0;
  const jigglePull = jiggleT > 0 ? Math.sin(time * 40) * .1 : 0;
  rod.rotation.x = rodT.x + Math.sin(reelPhase) * .03 + fightBend - jigglePull;
  rod.rotation.z = rodT.z + (state === S.BITE ? Math.sin(time * 25) * .05 : (state === S.NIBBLE ? Math.sin(time * 15) * .02 : 0)) + (isFightingBack ? Math.sin(time * 14) * .08 : 0);

rodTip.set(0, 2, 0).applyEuler(rod.rotation).add(rod.position);
  const lp = line.geometry.attributes.position;
  lp.setXYZ(0, rodTip.x, rodTip.y, rodTip.z);
  if (bobber.visible) {
    lp.setXYZ(1, bobber.position.x, bobber.position.y, bobber.position.z);
    const p = hookedFish ? hookedFish.position : bobber.position;
    lp.setXYZ(2, p.x, p.y, p.z);
  } else {
    lp.setXYZ(1, rodTip.x, rodTip.y, rodTip.z);
    lp.setXYZ(2, rodTip.x, rodTip.y, rodTip.z);
  }
  lp.needsUpdate = true;

  for (let i = 0; i < waterBaseY.length; i++) {
    const x = waterVerts[i * 3], y = waterVerts[i * 3 + 1];
    waterVerts[i * 3 + 2] = waterBaseY[i] + Math.sin(time * 1.5 + x * 0.2 + y * 0.2) * 0.15 + Math.cos(time * 2 + x * 0.1) * 0.1;
  }
  waterGeo.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

const FIRST_TIME_TUTORIAL_MD = `
### Welcome Angler! 🎣
You are stationed at the serene mountain lake dock. Your goal is to explore the waters, collect all rare species, earn coins, and upgrade your fishing gear.

:::cards
:::card 🎯 | Aim & Cast | Target distant deep waters for rarer fish
:::card 🐟 | Bite Reaction | React fast when a fish strikes
:::card ⚡ | Tension Control | Keep tension safe to land the prize
:::

### Step-by-Step Fishing Guide

1. **Aim and Charge Cast**: Swipe left/right or move your mouse to aim across the water. Click & hold [kbd]Left Mouse Button[/kbd] (or tap & hold on mobile) to charge your throw power, then release to cast your bobber into the lake.
2. **Prod the Line (Attract Fish)**: While waiting, press [kbd]Spacebar[/kbd] or tap the water to gently twitch your line. This splashes water and attracts curious nearby fish closer to your hook.
3. **Hook the Strike**: Watch your bobber closely! When a fish bites, you'll see a red strike warning. Instantly click [kbd]LMB[/kbd] or press [kbd]Spacebar[/kbd] before the bite window expires. Beware of false nibbles!
4. **Reel in the Catch**: Hold [kbd]Left Mouse Button[/kbd] or hold your finger down on the screen to reel in. Balance tension inside the green safe zone so the line doesn't snap. Switch reel gears ([kbd]L[/kbd] / [kbd]M[/kbd] / [kbd]H[/kbd]) and trigger [kbd]⚡ Burst[/kbd] with [kbd]E[/kbd] / [kbd]Q[/kbd] when adrenaline fills!

> tip: Catching larger fish earns more coins! Visit Tackle & Settings (⚙️) anytime to purchase advanced rods, specialty baits, and line upgrades.
`;

function showFirstTimeGuide(force = false) {
  if (!force && tutorialsSeen['first_spawn']) return;
  showGuideModal({
    badge: '🎣 FIRST TIME GUIDE',
    title: 'How to Begin Fishing',
    subtitle: 'Learn the fundamentals of casting, prodding, and reeling',
    markdown: FIRST_TIME_TUTORIAL_MD,
    onDismiss: () => {
      tutorialsSeen['first_spawn'] = true;
      save();
    }
  });
}

const JIGGLE_TUTORIAL_MD = `
### Attract Fish with Prodding! 🎣
Fish are swimming through the lake, but sometimes they need a little encouragement to notice your bait!

:::cards
:::card 🌊 | Jiggle the Bobber | Press [kbd]Spacebar[/kbd] or tap the water to twitch
:::card 👀 | Get Attention | Ripples and splashes catch nearby fish curiosity
:::

### How to Prod Your Line

1. **Jiggle / Prod**: While waiting for a bite, press [kbd]Spacebar[/kbd] on desktop or tap anywhere on the water.
2. **Watch Fish React**: Curious fish swimming nearby will turn toward your lure and swim closer to investigate.
3. **Trigger Faster Strikes**: Prodding speeds up bite interest and turns wandering fish into active strikes!

> tip: You can jiggle the bobber every 1.5 seconds. Use it whenever fish are swimming nearby!
`;

function showJiggleGuide(force = false) {
  if (!force && tutorialsSeen['jiggle_bob']) return;
  showGuideModal({
    badge: '💡 ANGLER TIP',
    title: 'Jiggle the Bobber!',
    subtitle: 'Attract nearby swimming fish to your lure',
    markdown: JIGGLE_TUTORIAL_MD,
    onDismiss: () => {
      tutorialsSeen['jiggle_bob'] = true;
      save();
    }
  });
}
const LINE_SNAP_TUTORIAL_MD = `
### 🎣 Keep Tension in the Green
Strong fish can **snap your line** if tension hits the red zone — the fish escapes!

:::cards
:::card 🟢 | Reel in green | Hold [kbd]LMB[/kbd] only while the meter stays in the green safe zone
:::card 🔴 | Release at red | Let go of [kbd]LMB[/kbd] the moment tension turns red
:::card 🐟 | Let it tire | Wait out a few fight pulls before reeling hard
:::

> tip: Use [kbd]L[/kbd] low gear for finer control, or buy stronger line at the Tackle Shop.
`;

function showLineSnapGuide(force = false) {
  if (!force && tutorialsSeen['snap_line']) return;
  showGuideModal({
    badge: '💔 LINE SNAP WARNING',
    title: 'Avoid Snapping Your Line!',
    subtitle: 'Keep the meter green — release before it turns red',
    markdown: LINE_SNAP_TUTORIAL_MD,
    theme: 'danger',
    showNever: true,
    onDismiss: () => {
      // Normal dismissal: still show again on future snaps unless "Never Show Again" is pressed
    },
    onNever: () => {
      tutorialsSeen['snap_line'] = true;
      save();
      toast('Tutorial hidden for future snaps');
    }
  });
}

if ($('showGuideBtn')) {
  $('showGuideBtn').addEventListener('click', () => {
    bootstrap.Modal.getInstance($('settingsModal'))?.hide();
    showFirstTimeGuide(true);
  });
}

animate();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  syncHint();
});

const applySettings = () => {
  const sz = document.getElementById('safeZone');
  if (sz) sz.style.display = settings.safe ? '' : 'none';
  document.querySelectorAll('.hud-panel').forEach(p => p.style.backdropFilter = settings.blur ? 'blur(10px) saturate(1.15)' : 'none');
  if (settings.quality === 'low') { renderer.setPixelRatio(1); }
  else if (settings.quality === 'med') { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); }
  else { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); }
  document.querySelectorAll('.shop-tab').forEach(t => {
    const k = 'toggle' + t.dataset.tab.charAt(0).toUpperCase() + t.dataset.tab.slice(1);
  });
};
applySettings();