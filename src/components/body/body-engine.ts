// Motor do modelo corporal: malha base e ajustes do MakeHuman (CC0 1.0), gerados por
// scripts/build-body-model.mjs em public/models/body, e o esqueleto dos braços, gerado por
// scripts/build-body-rig.mjs. Aplica sexo, biotipo e circunferências, mede o corpo como uma fita
// métrica e posa braços e mãos. Não depende do three.js.
import { clamp } from "@/lib/common";

export type Sex = "male" | "female";
export type BodyMeasureKey = "neck" | "chest" | "waist" | "hip" | "arm" | "thigh" | "calf";
type TargetName = "neck" | "bust" | "waist" | "hips" | "upperarm" | "thigh" | "calf";
type MacroName = "averagemuscle-minweight" | "averagemuscle-maxweight" | "minmuscle-averageweight" | "maxmuscle-averageweight";
type Vec3 = [number, number, number];

// ajuste do MakeHuman que corresponde a cada medida do app
const MEASURE_TARGET: Record<BodyMeasureKey, TargetName> = { neck: "neck", chest: "bust", waist: "waist", hip: "hips", arm: "upperarm", thigh: "thigh", calf: "calf" };

type Target = { ids: Uint16Array; deltas: Int16Array; scale: number };
// Articulação: centro de um anel de vértices da pele mais um deslocamento em fração da altura.
type RigJoint = { ids: number[]; offset: Vec3 };
type RigBone = { name: string; parent: number; head: RigJoint; tail: RigJoint };
type BodyRig = { bones: RigBone[]; vertex: Uint16Array; weight: Uint16Array; bone: Uint8Array };
export type BodyModel = {
  n: number;
  tris: Uint16Array;
  part: Uint8Array; // 0 tronco e cabeça, 1 braços, 2 pernas
  joints: Record<string, number[]>;
  sexes: Record<Sex, { height: number; pos: Float32Array; macros: Record<MacroName, Target> }>;
  measures: Record<TargetName, { decr: Target; incr: Target }>;
  rig: BodyRig;
};

type PackedTarget = { count: number; scale: number; ids: number; deltas: number };
type Manifest = {
  vertexCount: number;
  triangles: { count: number; offset: number };
  part: number;
  joints: Record<string, number[]>;
  sexes: Record<Sex, { height: number; positions: number; macros: Record<MacroName, PackedTarget> }>;
  measures: Record<TargetName, { decr: PackedTarget; incr: PackedTarget }>;
};
type RigManifest = { bones: RigBone[]; skin: { count: number; vertex: number; weight: number; bone: number } };

export async function loadBodyModel(base = "/models/body/"): Promise<BodyModel> {
  const [man, buf, rig, rigBuf] = await Promise.all([
    fetch(`${base}body.json`).then((r) => r.json() as Promise<Manifest>),
    fetch(`${base}body.bin`).then((r) => r.arrayBuffer()),
    fetch(`${base}rig.json`).then((r) => r.json() as Promise<RigManifest>),
    fetch(`${base}rig.bin`).then((r) => r.arrayBuffer()),
  ]);
  const target = (t: PackedTarget): Target => ({ ids: new Uint16Array(buf, t.ids, t.count), deltas: new Int16Array(buf, t.deltas, t.count * 3), scale: t.scale });
  const sex = (s: Manifest["sexes"][Sex]) => ({
    height: s.height,
    pos: new Float32Array(buf, s.positions, man.vertexCount * 3),
    macros: Object.fromEntries(Object.entries(s.macros).map(([k, t]) => [k, target(t)])) as Record<MacroName, Target>,
  });
  return {
    n: man.vertexCount,
    tris: new Uint16Array(buf, man.triangles.offset, man.triangles.count),
    part: new Uint8Array(buf, man.part, man.vertexCount),
    joints: man.joints,
    sexes: { male: sex(man.sexes.male), female: sex(man.sexes.female) },
    measures: Object.fromEntries(Object.entries(man.measures).map(([k, v]) => [k, { decr: target(v.decr), incr: target(v.incr) }])) as BodyModel["measures"],
    rig: {
      bones: rig.bones,
      vertex: new Uint16Array(rigBuf, rig.skin.vertex, rig.skin.count),
      weight: new Uint16Array(rigBuf, rig.skin.weight, rig.skin.count),
      bone: new Uint8Array(rigBuf, rig.skin.bone, rig.skin.count),
    },
  };
}

export function meshNeighbors(M: BodyModel): number[][] {
  const sets = Array.from({ length: M.n }, () => new Set<number>());
  for (let t = 0; t < M.tris.length; t += 3) {
    const [a, b, c] = [M.tris[t], M.tris[t + 1], M.tris[t + 2]];
    sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b);
  }
  return sets.map((set) => [...set]);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// s: 0 masculino, 1 feminino. weight e muscle de −1 a 1 (a partir de IMC e FFMI). w: peso de cada ajuste de medida.
export type BodyShape = { s: number; height: number; weight: number; muscle: number; w: Record<TargetName, number> };

export function lerpShape(a: BodyShape, b: BodyShape, t: number): BodyShape {
  return {
    s: mix(a.s, b.s, t),
    height: mix(a.height, b.height, t),
    weight: mix(a.weight, b.weight, t),
    muscle: mix(a.muscle, b.muscle, t),
    w: Object.fromEntries(Object.keys(a.w).map((k) => [k, mix(a.w[k as TargetName], b.w[k as TargetName], t)])) as BodyShape["w"],
  };
}

export function buildPositions(M: BodyModel, P: BodyShape, out: Float32Array) {
  const male = M.sexes.male.pos, female = M.sexes.female.pos;
  for (let i = 0; i < out.length; i++) out[i] = male[i] + (female[i] - male[i]) * P.s;
  const add = (t: Target, w: number) => {
    if (!w) return;
    const k = t.scale * w;
    for (let j = 0; j < t.ids.length; j++) {
      const o = t.ids[j] * 3, d = j * 3;
      out[o] += t.deltas[d] * k;
      out[o + 1] += t.deltas[d + 1] * k;
      out[o + 2] += t.deltas[d + 2] * k;
    }
  };
  for (const [sex, sw] of [["male", 1 - P.s], ["female", P.s]] as const) {
    if (sw <= 0) continue;
    const mc = M.sexes[sex].macros;
    add(P.weight > 0 ? mc["averagemuscle-maxweight"] : mc["averagemuscle-minweight"], Math.abs(P.weight) * sw);
    add(P.muscle > 0 ? mc["maxmuscle-averageweight"] : mc["minmuscle-averageweight"], Math.abs(P.muscle) * sw);
  }
  for (const m of Object.keys(P.w) as TargetName[]) add(P.w[m] > 0 ? M.measures[m].incr : M.measures[m].decr, Math.abs(P.w[m]));
  const k = P.height / mix(M.sexes.male.height, M.sexes.female.height, P.s);
  for (let i = 0; i < out.length; i++) out[i] *= k;
  return out;
}

export function jointAt(M: BodyModel, pos: Float32Array, name: string): Vec3 {
  const ids = M.joints[name];
  const c: Vec3 = [0, 0, 0];
  for (const i of ids) {
    c[0] += pos[i * 3] / ids.length;
    c[1] += pos[i * 3 + 1] / ids.length;
    c[2] += pos[i * 3 + 2] / ids.length;
  }
  return c;
}

// ---------- medição ----------
type Point2 = [number, number];

// Corta a malha por um plano e devolve os pontos do corte em coordenadas do plano (u, v),
// considerando só as partes pedidas do corpo.
function slicePlane(M: BodyModel, pos: Float32Array, P0: Vec3, n: Vec3, u: Vec3, v: Vec3, parts: number[]) {
  const allow = [0, 1, 2].map((p) => parts.includes(p));
  const sd = new Float32Array(M.n);
  for (let i = 0; i < M.n; i++) sd[i] = (pos[i * 3] - P0[0]) * n[0] + (pos[i * 3 + 1] - P0[1]) * n[1] + (pos[i * 3 + 2] - P0[2]) * n[2];
  const pts: Point2[] = [];
  const edge = (i: number, j: number) => {
    const di = sd[i], dj = sd[j];
    if (di > 0 === dj > 0) return;
    const k = di / (di - dj);
    const r = [0, 1, 2].map((a) => pos[i * 3 + a] + (pos[j * 3 + a] - pos[i * 3 + a]) * k - P0[a]);
    pts.push([r[0] * u[0] + r[1] * u[1] + r[2] * u[2], r[0] * v[0] + r[1] * v[1] + r[2] * v[2]]);
  };
  const T = M.tris;
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    if ((sd[a] > 0 && sd[b] > 0 && sd[c] > 0) || (sd[a] < 0 && sd[b] < 0 && sd[c] < 0)) continue;
    if (!allow[M.part[a]] || !allow[M.part[b]] || !allow[M.part[c]]) continue;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return pts;
}

// grupos de pontos separados por vãos no eixo u (tronco, braços, pernas)
function clusters(pts: Point2[], gap: number) {
  const out: Point2[][] = [];
  for (const p of [...pts].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && p[0] - last[last.length - 1][0] < gap) last.push(p);
    else out.push([p]);
  }
  return out;
}

function hull(pts: Point2[]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Point2, a: Point2, b: Point2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point2[] = [], upper: Point2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 0) upper.pop();
    upper.push(p[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const perimeter = (h: Point2[]) => h.reduce((sum, p, i) => sum + Math.hypot(p[0] - h[(i + 1) % h.length][0], p[1] - h[(i + 1) % h.length][1]), 0);
const centerX = (g: Point2[]) => g.reduce((s, p) => s + p[0], 0) / g.length;

export type Ring = { girth: number; ring: Vec3[] };

// Mede uma circunferência como uma fita métrica: o contorno convexo do corte na altura certa
export function measureRing(M: BodyModel, pos: Float32Array, H: number, key: BodyMeasureKey): Ring | null {
  const UP: Vec3 = [0, 1, 0], EX: Vec3 = [1, 0, 0], EZ: Vec3 = [0, 0, 1];
  const level = (y: number, pick: (gs: Point2[][]) => Point2[], parts = [0]): Ring | null => {
    const chosen = pick(clusters(slicePlane(M, pos, [0, y, 0], UP, EX, EZ, parts), 0.012 * H));
    if (chosen.length < 3) return null;
    const h = hull(chosen);
    return { girth: perimeter(h), ring: h.map(([x, z]) => [x, y, z] as Vec3) };
  };
  const nearest = (cx: number, sameSide = false) => (gs: Point2[][]) => {
    let best: Point2[] = [], score = Infinity;
    for (const g of gs) {
      const c = centerX(g);
      if (sameSide && Math.sign(c) !== Math.sign(cx)) continue;
      if (Math.abs(c - cx) < score) { best = g; score = Math.abs(c - cx); }
    }
    return best;
  };
  const scan = (from: number, to: number, steps: number, pick: (gs: Point2[][]) => Point2[], wantMax: boolean, parts?: number[]) => {
    let best: Ring | null = null;
    for (let i = 0; i <= steps; i++) {
      const r = level(mix(from, to, i / steps) * H, pick, parts);
      if (r && (!best || (wantMax ? r.girth > best.girth : r.girth < best.girth))) best = r;
    }
    return best;
  };

  if (key === "neck") return scan(0.835, 0.865, 4, nearest(0), false);
  if (key === "chest") return scan(0.69, 0.75, 6, nearest(0), true);
  if (key === "waist") return scan(0.575, 0.635, 6, nearest(0), false);
  if (key === "hip") return scan(0.46, 0.54, 8, (gs) => gs.flat(), true, [0, 2]);
  if (key === "arm") {
    const S = jointAt(M, pos, "l-shoulder"), E = jointAt(M, pos, "l-elbow");
    const len = Math.hypot(E[0] - S[0], E[1] - S[1], E[2] - S[2]);
    const n: Vec3 = [(E[0] - S[0]) / len, (E[1] - S[1]) / len, (E[2] - S[2]) / len];
    const h = Math.hypot(n[0], n[1]);
    const u: Vec3 = [n[1] / h, -n[0] / h, 0];
    const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const P0: Vec3 = [mix(S[0], E[0], 0.5), mix(S[1], E[1], 0.5), mix(S[2], E[2], 0.5)];
    const pts = slicePlane(M, pos, P0, n, u, v, [1]).filter(([a, b]) => a * a + b * b < (0.07 * H) ** 2);
    if (pts.length < 3) return null;
    const ring = hull(pts);
    return { girth: perimeter(ring), ring: ring.map(([a, b]) => [0, 1, 2].map((i) => P0[i] + a * u[i] + b * v[i]) as Vec3) };
  }
  const hipJ = jointAt(M, pos, "l-upper-leg"), knee = jointAt(M, pos, "l-knee"), ankle = jointAt(M, pos, "l-ankle");
  if (key === "thigh") return level(mix(hipJ[1], knee[1], 0.42), nearest(mix(hipJ[0], knee[0], 0.42), true), [2]);
  return scan(mix(knee[1], ankle[1], 0.18) / H, mix(knee[1], ankle[1], 0.42) / H, 5, nearest(mix(knee[0], ankle[0], 0.3), true), true, [2]);
}

// ---------- ajuste às medidas ----------
export type BodyInput = {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  leanMassKg: number | null;
  measures: Partial<Record<BodyMeasureKey, number | null>>;
};

// Escolhe biotipo (IMC e FFMI) e ajusta cada circunferência até o modelo bater com a medida informada.
// Medidas ausentes ficam no formato padrão do biotipo.
export function solveBodyShape(M: BodyModel, input: BodyInput): BodyShape {
  const s = input.sex === "female" ? 1 : 0;
  const h = input.heightCm / 100;
  const lean = input.leanMassKg ?? input.weightKg * (s ? 0.72 : 0.8);
  const bmi = input.weightKg / (h * h);
  const P: BodyShape = {
    s,
    height: input.heightCm,
    weight: clamp((bmi - 22) / (bmi > 22 ? 10 : 4), -1, 1),
    muscle: clamp((lean / (h * h) - (s ? 15.5 : 19)) / 4, -1, 1),
    w: { neck: 0, bust: 0, waist: 0, hips: 0, upperarm: 0, thigh: 0, calf: 0 },
  };
  const pos = new Float32Array(M.n * 3);
  const girth = (key: BodyMeasureKey) => measureRing(M, buildPositions(M, P, pos), input.heightCm, key)?.girth;
  for (let pass = 0; pass < 2; pass++) {
    for (const key of Object.keys(MEASURE_TARGET) as BodyMeasureKey[]) {
      const goal = input.measures[key];
      const g0 = girth(key);
      if (goal == null || g0 == null || Math.abs(goal - g0) < 0.15) continue;
      const t = MEASURE_TARGET[key];
      const prev = P.w[t];
      P.w[t] = clamp(prev + (goal > g0 ? 0.5 : -0.5), -1, 1);
      const g1 = girth(key);
      const slope = g1 == null ? 0 : (g1 - g0) / (P.w[t] - prev);
      P.w[t] = Math.abs(slope) > 1e-3 ? clamp(prev + (goal - g0) / slope, -1, 1) : prev;
    }
  }
  return P;
}

// ---------- pose ----------
// Postura relaxada de escaneamento, em graus, a partir da pose em A da malha base: ombros baixos,
// braços perto do corpo sem tocar o quadril, cotovelos quase retos, palmas voltadas para as coxas
// e dedos juntos, levemente curvados.
export const BODY_POSE = {
  clavicle: 6, // a malha base sobe a clavícula ~20°, o que parece um ombro encolhido; mais que isso dobra o peitoral
  shoulder: 16, // braço a ~18° da vertical, sem encostar no quadril
  elbow: 36, // a malha base dobra o cotovelo ~47° com o antebraço à frente
  twist: -10, // giro do antebraço que deixa a palma de frente para a coxa
  curl: [6, 12, 8], // cada falange, da base à ponta
  spread: 0.7, // fração da abertura entre os dedos que se fecha
  thumb: 18,
};

type Mat = Float64Array; // 3×4, linha a linha: rotação e translação
const deg = Math.PI / 180;

function rotation(axis: Vec3, angle: number, pivot: Vec3): Mat {
  const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const r = [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  const m = new Float64Array(12);
  for (let row = 0; row < 3; row++) {
    m.set(r.slice(row * 3, row * 3 + 3), row * 4);
    m[row * 4 + 3] = pivot[row] - (r[row * 3] * pivot[0] + r[row * 3 + 1] * pivot[1] + r[row * 3 + 2] * pivot[2]);
  }
  return m;
}

function multiply(a: Mat, b: Mat): Mat {
  const m = new Float64Array(12);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      m[row * 4 + col] = a[row * 4] * b[col] + a[row * 4 + 1] * b[4 + col] + a[row * 4 + 2] * b[8 + col] + (col === 3 ? a[row * 4 + 3] : 0);
    }
  }
  return m;
}

const IDENTITY: Mat = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Gira a direção d na direção do alvo, em torno do pivô. O eixo vem de um produto vetorial,
// então o lado direito sai espelhado do esquerdo sem trocar o sinal do ângulo.
const toward = (d: Vec3, goal: Vec3, angle: number, pivot: Vec3) => rotation(unit(cross(d, goal)), angle, pivot);

function rigJoint(J: RigJoint, pos: Float32Array, height: number): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const i of J.ids) for (let a = 0; a < 3; a++) c[a] += pos[i * 3 + a] / J.ids.length;
  return [c[0] + J.offset[0] * height, c[1] + J.offset[1] * height, c[2] + J.offset[2] * height];
}

// Matriz de cada osso do braço na pose, por cinemática direta a partir do repouso.
function poseMatrices(M: BodyModel, rest: Float32Array, height: number, pose = BODY_POSE): Mat[] {
  const { bones } = M.rig;
  const index = new Map(bones.map((b, i) => [b.name, i]));
  const head = bones.map((b) => rigJoint(b.head, rest, height));
  const dir = bones.map((b, i) => unit(sub(rigJoint(b.tail, rest, height), head[i])));
  const local: Mat[] = bones.map(() => IDENTITY);
  const down: Vec3 = [0, -1, 0];
  for (const side of ["L", "R"]) {
    const at = (name: string) => index.get(`${name}.${side}`)!;
    const sign = Math.sign(head[at("upperarm01")][0]);
    const set = (name: string, m: Mat) => { local[at(name)] = m; };
    set("clavicle", toward(dir[at("clavicle")], down, pose.clavicle * deg, head[at("clavicle")]));
    set("upperarm01", toward(dir[at("upperarm02")], down, pose.shoulder * deg, head[at("upperarm01")]));
    set("lowerarm01", toward(dir[at("lowerarm01")], dir[at("upperarm02")], pose.elbow * deg, head[at("lowerarm01")]));
    set("lowerarm02", rotation(dir[at("lowerarm01")], sign * pose.twist * deg, head[at("lowerarm02")]));
    // A palma olha para onde os dedos dobram. O sinal do lado transforma o produto vetorial em direção.
    const across = sub(head[at("finger5-1")], head[at("finger2-1")]);
    const palm = unit(cross(dir[at("metacarpal2")], across)).map((v) => -sign * v) as Vec3;
    const middle = dir[at("finger3-1")];
    for (const finger of [2, 3, 4, 5]) {
      for (const segment of [1, 2, 3]) {
        const name = `finger${finger}-${segment}`, d = dir[at(name)];
        let m = toward(d, palm, pose.curl[segment - 1] * deg, head[at(name)]);
        if (segment === 1 && finger !== 3) {
          const gap = Math.acos(clamp(dot(d, middle), -1, 1));
          m = multiply(m, toward(d, middle, gap * pose.spread, head[at(name)]));
        }
        set(name, m);
      }
    }
    set("finger1-1", toward(dir[at("finger1-1")], dir[at("metacarpal1")], pose.thumb * deg, head[at("finger1-1")]));
    for (const segment of [2, 3]) set(`finger1-${segment}`, toward(dir[at(`finger1-${segment}`)], palm, pose.curl[segment - 1] * deg, head[at(`finger1-${segment}`)]));
  }
  const world: Mat[] = [];
  bones.forEach((b, i) => { world[i] = b.parent < 0 ? local[i] : multiply(world[b.parent], local[i]); });
  return world;
}

// Vértices do ombro e da axila, onde o braço encontra o tronco, e seus vizinhos na superfície.
const shoulderBands = new WeakMap<BodyModel, { ids: number[]; neighbors: number[][] }>();
function shoulderBand(M: BodyModel) {
  let band = shoulderBands.get(M);
  if (!band) {
    const { pos, height } = M.sexes.male;
    const neighbors = meshNeighbors(M);
    const ids: number[] = [];
    for (let i = 0; i < M.n; i++) {
      const y = pos[i * 3 + 1] / height, x = Math.abs(pos[i * 3]) / height;
      if (y > 0.62 && y < 0.9 && x > 0.03 && neighbors[i].length) ids.push(i);
    }
    band = { ids, neighbors };
    shoulderBands.set(M, band);
  }
  return band;
}

// Posa braços e mãos com os pesos de pele do MakeHuman: cada vértice segue a média dos ossos.
export function poseBody(M: BodyModel, rest: Float32Array, height: number, out: Float32Array, pose = BODY_POSE) {
  out.set(rest);
  const world = poseMatrices(M, rest, height, pose);
  const { vertex, weight, bone } = M.rig;
  for (let k = 0; k < vertex.length; k++) {
    const o = vertex[k] * 3, m = world[bone[k]], w = weight[k] / 65535;
    const x = rest[o], y = rest[o + 1], z = rest[o + 2];
    out[o] += w * (m[0] * x + m[1] * y + m[2] * z + m[3] - x);
    out[o + 1] += w * (m[4] * x + m[5] * y + m[6] * z + m[7] - y);
    out[o + 2] += w * (m[8] * x + m[9] * y + m[10] * z + m[11] - z);
  }
  // Pesos lineares dobram a pele na frente da axila quando o braço desce. Suavizar o deslocamento
  // (não a posição) espalha a dobra sem mudar o que gira inteiro: num giro rígido o deslocamento
  // varia de forma linear, e a média dos vizinhos é ele mesmo.
  const { ids, neighbors } = shoulderBand(M);
  const move = new Float32Array(out.length);
  for (let i = 0; i < out.length; i++) move[i] = out[i] - rest[i];
  for (let pass = 0; pass < 12; pass++) {
    const next = move.slice();
    for (const i of ids) {
      const near = neighbors[i];
      for (let a = 0; a < 3; a++) {
        let sum = 0;
        for (const j of near) sum += move[j * 3 + a];
        next[i * 3 + a] = 0.5 * move[i * 3 + a] + 0.5 * sum / near.length;
      }
    }
    move.set(next);
  }
  for (const i of ids) for (let a = 0; a < 3; a++) out[i * 3 + a] = rest[i * 3 + a] + move[i * 3 + a];
  return out;
}

// Leva um ponto medido no repouso (uma fita) para a pose: ele anda junto com o vértice mais
// próximo da mesma parte do corpo.
export function posePoint(M: BodyModel, rest: Float32Array, posed: Float32Array, p: Vec3, parts: number[]): Vec3 {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < M.n; i++) {
    if (!parts.includes(M.part[i])) continue;
    const d = (rest[i * 3] - p[0]) ** 2 + (rest[i * 3 + 1] - p[1]) ** 2 + (rest[i * 3 + 2] - p[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return p;
  return [0, 1, 2].map((a) => p[a] + posed[best * 3 + a] - rest[best * 3 + a]) as Vec3;
}
