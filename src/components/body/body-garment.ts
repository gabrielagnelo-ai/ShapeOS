import { meshNeighbors, type BodyModel } from "./body-engine";

/** Fits clothing to the current morphed body, never to the reference weight. */
export function createGarmentFitter(model: BodyModel) {
  const neighbors = meshNeighbors(model);
  const scratch = new Float32Array(model.n * 3);
  return (rest: Float32Array, posed: Float32Array, normals: ArrayLike<number>, height: number, out: Float32Array) => {
    out.set(posed);
    for (let pass = 0; pass < 5; pass++) {
      scratch.set(out);
      for (let i = 0; i < model.n; i++) {
        const y = rest[i * 3 + 1] / height;
        if (y < .34 || y > .6 || model.part[i] === 1 || !neighbors[i].length) continue;
        for (const k of [0, 2]) {
          const avg = neighbors[i].reduce((sum, j) => sum + out[j * 3 + k], 0) / neighbors[i].length;
          scratch[i * 3 + k] = out[i * 3 + k] * .6 + avg * .4;
        }
      }
      out.set(scratch);
    }
    for (let i = 0; i < model.n; i++) {
      const o = i * 3, y = rest[o + 1] / height;
      if (y < .34 || y > .6 || model.part[i] === 1) {
        for (let k = 0; k < 3; k++) out[o + k] += normals[o + k] * .28 * height / 175;
        continue;
      }
      // Smoothing alone shrinks cloth into the abdomen on heavier morphs.
      // Project back outside the CURRENT skin normal, keeping a level hem.
      const length = Math.hypot(normals[o], normals[o + 2]);
      const nx = length > .01 ? normals[o] / length : 0;
      const nz = length > .01 ? normals[o + 2] / length : Math.sign(posed[o + 2]);
      const drop = Math.max(0, Math.min(1, (.56 - y) / .16));
      const fold = Math.sin(rest[o] * 1.3 + rest[o + 2] * .5) * .13 * drop;
      const clearance = (.95 + 1.1 * drop + fold) * height / 175;
      const current = (out[o] - posed[o]) * nx + (out[o + 2] - posed[o + 2]) * nz;
      const lift = Math.max(0, clearance - current);
      out[o] += nx * lift;
      out[o + 2] += nz * lift;
      out[o + 1] = posed[o + 1];
    }
    return out;
  };
}
