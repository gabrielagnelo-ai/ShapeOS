// Cena three.js do modelo corporal: luzes, plataforma, pele, roupa esportiva, brilho das regiões e fitas.
// Carregado sob demanda pelo componente de Progresso para o three.js não entrar no pacote inicial.
import * as THREE from "three";
import { buildPositions, jointAt, measureRing, poseBody, posePoint, type BodyMeasureKey, type BodyModel, type BodyShape } from "./body-engine";
import { createGarmentFitter } from "./body-garment";

export type TapeView = { key: BodyMeasureKey; color: string; zone: boolean };

const TORSO_KEYS: BodyMeasureKey[] = ["chest", "waist", "hip"];
// parte do corpo que cada fita acompanha na pose: 0 tronco e cabeça, 1 braços, 2 pernas
const TAPE_PARTS: Record<BodyMeasureKey, number[]> = { neck: [0], chest: [0], waist: [0], hip: [0, 2], arm: [1], thigh: [2], calf: [2] };

// Roupa esportiva recortada por pixel, em coordenadas do corpo em repouso divididas pela altura.
// Shorts de treino até o meio da coxa; top esportivo no modelo feminino.
const GARMENT_GLSL = /* glsl */ `
float garmentBand(float y, float lo, float hi) {
  float aa = fwidth(y) * 1.2 + 1e-4;
  return smoothstep(lo - aa, lo + aa, y) * (1.0 - smoothstep(hi - aa, hi + aa, y));
}
vec4 garment(vec3 p, float arm, float sex) {
  if (arm > 0.5) return vec4(0.0); // braços ficam de fora
  vec3 fabric = vec3(0.009, 0.010, 0.012);       // grafite
  vec3 trim = vec3(0.045, 0.05, 0.056);          // elástico, um tom acima
  vec3 accent = vec3(0.035, 0.038, 0.042);      // pesponto grafite
  float ax = abs(p.x);
  // a barra da perna sobe um pouco nas laterais do quadril
  float lo = 0.375 + 0.004 * smoothstep(0.025, 0.08, ax);
  float hi = mix(0.553, 0.566, sex);
  float bottom = garmentBand(p.y, lo, hi);
  float waistband = garmentBand(p.y, hi - 0.017, hi);
  float stripe = garmentBand(p.y, hi - 0.0195, hi - 0.0165);
  // top: faixa sob o busto, decote em U na frente e alças sobre os ombros
  float neckline = 0.772 - 0.034 * exp(-pow(p.x / 0.05, 2.0)) * step(0.0, p.z);
  float body = garmentBand(p.y, 0.662, neckline);
  float strap = garmentBand(p.y, 0.74, 0.835) * (1.0 - smoothstep(0.008, 0.011, abs(ax - 0.062)));
  float top = max(body, strap) * sex;
  float underband = garmentBand(p.y, 0.662, 0.677) * body * sex;
  float topStripe = garmentBand(p.y, 0.677, 0.68) * body * sex;
  float hem = garmentBand(p.y, lo, lo + 0.008);
  float thread = 0.92 + 0.08 * sin(p.y * 3200.0) * sin(p.x * 3200.0);
  float seam = exp(-pow((ax - 0.092) / 0.0015, 2.0)) * bottom;
  vec3 color = mix(fabric, trim, max(max(waistband * bottom, underband), hem * bottom) * 0.65);
  color = mix(color, trim, seam * 0.4) * thread;
  color = mix(color, accent, max(stripe * bottom, topStripe));
  return vec4(color, max(bottom, top));
}
`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const band = (x: number, lo: number, hi: number, soft: number) => clamp01((x - lo) / soft + 0.5) * clamp01((hi - x) / soft + 0.5);

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBodyScene(canvas: HTMLCanvasElement, M: BodyModel) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 10, 2000);
  camera.position.set(0, 118, 470);
  camera.lookAt(0, 90, 0);

  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x202a24, 1));
  const lights: [number, number, Vec][] = [
    [0xffffff, 2.4, [-140, 240, 220]],
    [0xcfe5ff, 0.9, [180, 90, 140]],
    [0xe3ffc4, 1.3, [90, 170, -240]],
    [0xffffff, 0.65, [-200, 120, -140]],
  ];
  for (const [color, intensity, [x, y, z]] of lights) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }

  // plataforma iluminada
  const ringTexture = canvasTexture(1024, (g) => {
    const R = 512;
    const glow = g.createRadialGradient(R, R, 0, R, R, R);
    glow.addColorStop(0, "rgba(210,243,186,0.06)");
    glow.addColorStop(0.55, "rgba(210,243,186,0.02)");
    glow.addColorStop(0.86, "rgba(210,243,186,0.05)");
    glow.addColorStop(1, "rgba(184,255,0,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, 1024, 1024);
    const ring = (r: number, w: number, a: number, dash: number[] = []) => {
      g.beginPath();
      g.setLineDash(dash);
      g.lineWidth = w;
      g.strokeStyle = `rgba(214,255,120,${a})`;
      g.arc(R, R, r, 0, Math.PI * 2);
      g.stroke();
    };
    ring(440, 3, 0.4);
    ring(452, 1, 0.16);
  });
  const shadowTexture = canvasTexture(256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(0,0,0,0.85)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(58, 96), new THREE.MeshPhysicalMaterial({ color: 0x26312e, metalness: 0.15, roughness: 0.28, clearcoat: 1, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
  const rings = new THREE.Mesh(new THREE.PlaneGeometry(124, 124), new THREE.MeshBasicMaterial({ map: ringTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(70, 34), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  for (const [mesh, y] of [[disc, 0], [rings, 0.2], [shadow, 0.4]] as const) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    scene.add(mesh);
  }

  // corpo
  const rest = new Float32Array(M.n * 3);
  const posed = new Float32Array(M.n * 3);
  const colors = new Float32Array(M.n * 3);
  const glow = new Float32Array(M.n * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(posed, 3));
  // Allocate normals before the first frame: the renderer otherwise compiles
  // a flat-shaded variant while the first body shape is still being prepared.
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(M.n * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(M.tris, 1));
  const skin = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.58, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6,
    sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xeef5ff),
  }));
  // brilho das regiões que mudaram: camada aditiva, fraca de frente e forte nas bordas (Fresnel)
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", geometry.attributes.position);
  glowGeometry.setAttribute("normal", geometry.attributes.normal);
  glowGeometry.setAttribute("color", new THREE.BufferAttribute(glow, 3));
  glowGeometry.setIndex(geometry.index);
  const glowMesh = new THREE.Mesh(glowGeometry, new THREE.ShaderMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `varying vec3 vColor; varying float vFres;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFres = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vColor; varying float vFres;
      void main() { gl_FragColor = vec4(vColor * (0.35 + 2.2 * vFres), 1.0); }`,
  }));
  // Roupa com posições e normais próprias: folga e pregas não alteram as medidas da pele.
  const garmentGeometry = new THREE.BufferGeometry();
  const clothPositions = new Float32Array(M.n * 3);
  const fitGarment = createGarmentFitter(M);
  garmentGeometry.setAttribute("position", new THREE.BufferAttribute(clothPositions, 3));
  garmentGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(M.n * 3), 3));
  garmentGeometry.setAttribute("aRest", new THREE.BufferAttribute(rest, 3));
  // 1 só nos braços: interpolar entre tronco e perna continua 0 (sem buracos na divisa)
  garmentGeometry.setAttribute("aArm", new THREE.BufferAttribute(Float32Array.from(M.part, (p) => (p === 1 ? 1 : 0)), 1));
  garmentGeometry.setIndex(geometry.index);
  const garmentUniforms = { uHeight: { value: 175 }, uSex: { value: 0 } };
  geometry.setAttribute("aRest", garmentGeometry.attributes.aRest);
  geometry.setAttribute("aArm", garmentGeometry.attributes.aArm);
  // Hidden skin below an opaque garment must not poke through interpolated faces
  // during a weight morph. Both layers use the same moving coverage coordinates.
  skin.material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, garmentUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aRest;\nattribute float aArm;\nuniform float uHeight;\nvarying vec3 vRest;\nvarying float vArm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest / uHeight;\nvArm = aArm;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uSex;\nvarying vec3 vRest;\nvarying float vArm;\n${GARMENT_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\nif (garment(vRest, vArm, uSex).a > 0.99) discard;");
  };
  const garmentMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.96, metalness: 0, sheen: 0.25, sheenRoughness: 0.9, sheenColor: new THREE.Color(0x33363a),
    side: THREE.DoubleSide, transparent: false, depthWrite: true,
  });
  garmentMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, garmentUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aRest;\nattribute float aArm;\nuniform float uHeight;\nvarying vec3 vRest;\nvarying float vArm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest / uHeight;\nvArm = aArm;\ntransformed += normal * 0.08;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uSex;\nvarying vec3 vRest;\nvarying float vArm;\n${GARMENT_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\nvec4 cloth = garment(vRest, vArm, uSex);\nif (cloth.a < 0.01) discard;\ndiffuseColor.rgb = cloth.rgb;\ndiffuseColor.a *= cloth.a;");
  };
  const garmentMesh = new THREE.Mesh(garmentGeometry, garmentMaterial);
  glowMesh.renderOrder = 1; // brilho das regiões sobre a pele
  garmentMesh.renderOrder = 2; // a roupa cobre o brilho: o tecido continua grafite

  const tapeGroup = new THREE.Group();
  const figure = new THREE.Group();
  figure.add(skin, garmentMesh, glowMesh, tapeGroup);
  scene.add(figure);

  const SKIN = new THREE.Color(0xc9ccd1).convertSRGBToLinear();

  function paint(shape: BodyShape, tapes: TapeView[], zoneAmount: number) {
    const H = shape.height;
    const knee = jointAt(M, rest, "l-knee")[1] / H, ankle = jointAt(M, rest, "l-ankle")[1] / H, elbow = jointAt(M, rest, "l-elbow")[1] / H;
    const zones: Record<BodyMeasureKey, { parts: number[]; lo: number; hi: number }> = {
      neck: { parts: [0], lo: 0.82, hi: 0.87 },
      chest: { parts: [0], lo: 0.665, hi: 0.78 },
      waist: { parts: [0], lo: 0.565, hi: 0.65 },
      hip: { parts: [0, 2], lo: 0.455, hi: 0.565 },
      arm: { parts: [1], lo: elbow, hi: 0.86 },
      thigh: { parts: [2], lo: knee + 0.03, hi: 0.455 },
      calf: { parts: [2], lo: ankle + 0.03, hi: knee - 0.03 },
    };
    const lit = tapes.filter((t) => t.zone).map((t) => ({ zone: zones[t.key], tint: new THREE.Color(t.color).convertSRGBToLinear() }));
    for (let i = 0; i < M.n; i++) {
      const yN = rest[i * 3 + 1] / H, part = M.part[i];
      colors[i * 3] = SKIN.r;
      colors[i * 3 + 1] = SKIN.g;
      colors[i * 3 + 2] = SKIN.b;
      let r = 0, g = 0, b = 0;
      for (const { zone, tint } of lit) {
        if (!zone.parts.includes(part)) continue;
        const a = band(yN, zone.lo, zone.hi, 0.025) * 0.22 * zoneAmount;
        r += tint.r * a;
        g += tint.g * a;
        b += tint.b * a;
      }
      glow[i * 3] = r;
      glow[i * 3 + 1] = g;
      glow[i * 3 + 2] = b;
    }
    geometry.attributes.color.needsUpdate = true;
    glowGeometry.attributes.color.needsUpdate = true;
  }

  let tapeRings: Partial<Record<BodyMeasureKey, Vec[]>> = {};
  function clearTapes() {
    for (const child of [...tapeGroup.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    tapeGroup.clear();
    tapeRings = {};
  }

  return {
    setShape(shape: BodyShape, tapes: TapeView[], zoneAmount: number) {
      buildPositions(M, shape, rest);
      poseBody(M, rest, shape.height, posed);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      for (const layer of [glowGeometry]) {
        if (layer.attributes.normal !== geometry.attributes.normal) layer.setAttribute("normal", geometry.attributes.normal);
        layer.boundingSphere = geometry.boundingSphere;
      }
      fitGarment(rest, posed, geometry.attributes.normal.array, shape.height, clothPositions);
      garmentGeometry.attributes.position.needsUpdate = true;
      garmentGeometry.computeVertexNormals();
      garmentGeometry.computeBoundingSphere();
      garmentGeometry.attributes.aRest.needsUpdate = true;
      garmentUniforms.uHeight.value = shape.height;
      garmentUniforms.uSex.value = shape.s;
      paint(shape, tapes, zoneAmount);
    },

    // fitas medidas no corpo atual, levemente afastadas da pele
    setTapes(shape: BodyShape, tapes: TapeView[]) {
      clearTapes();
      for (const tape of tapes) {
        const r = measureRing(M, rest, shape.height, tape.key);
        if (!r || r.ring.length < 3) continue;
        const c = r.ring.reduce<Vec>((a, p) => [a[0] + p[0] / r.ring.length, a[1] + p[1] / r.ring.length, a[2] + p[2] / r.ring.length], [0, 0, 0]);
        const pts = r.ring.map((p) => {
          const q: Vec = [0, 1, 2].map((i) => c[i] + (p[i] - c[i]) * 1.015) as Vec;
          return posePoint(M, rest, posed, q, TAPE_PARTS[tape.key]);
        });
        tapeRings[tape.key] = pts;
        const both = TORSO_KEYS.includes(tape.key) ? [pts] : [pts, pts.map(([x, y, z]) => [-x, y, z] as Vec)];
        const tapeColor = new THREE.Color(tape.color);
        for (const ring of both) {
          const curve = new THREE.CatmullRomCurve3(ring.map((p) => new THREE.Vector3(...p)), true, "centripetal");
          tapeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.32, 6, true), new THREE.MeshBasicMaterial({ color: tapeColor, toneMapped: false })));
          tapeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 1.1, 6, true), new THREE.MeshBasicMaterial({ color: tapeColor, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
        }
      }
    },

    setTapesVisible(visible: boolean) {
      tapeGroup.visible = visible;
    },

    // altura da fita na tela, de 0 (topo) a 1 (base)
    tapeScreenY(key: BodyMeasureKey) {
      const ring = tapeRings[key];
      if (!ring || !tapeGroup.visible) return null;
      const v = new THREE.Vector3();
      let y = 0;
      for (const p of ring) {
        v.set(...p);
        figure.localToWorld(v);
        y += v.project(camera).y;
      }
      return 0.5 - (y / ring.length) * 0.5;
    },

    resize(width: number, height: number) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    setAnimationLoop(callback: ((time: number) => void) | null) {
      renderer.setAnimationLoop(callback);
    },

    render(yaw: number) {
      figure.rotation.y = yaw;
      renderer.render(scene, camera);
    },

    dispose() {
      renderer.setAnimationLoop(null);
      clearTapes();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      ringTexture.dispose();
      shadowTexture.dispose();
      renderer.dispose();
    },
  };
}

type Vec = [number, number, number];
export type BodyScene = ReturnType<typeof createBodyScene>;
