import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildPositions, jointAt, loadBodyModel, poseBody, solveBodyShape } from "./body-engine";
import { createGarmentFitter } from "./body-garment";
import { BufferAttribute, BufferGeometry } from "three";

afterEach(() => vi.unstubAllGlobals());

// serve os arquivos do modelo como o navegador faria
function stubModelFiles() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const data = readFileSync(`public${url}`);
    return url.endsWith(".json")
      ? { json: async () => JSON.parse(data.toString("utf8")) }
      : { arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  }));
}

describe("pose do modelo corporal", () => {
  it.each(["male", "female"] as const)("preserva orientação e área das faces do ombro: %s", async (sex) => {
    stubModelFiles();
    const model = await loadBodyModel();
    const shape = solveBodyShape(model, { sex, heightCm: 180, weightKg: 80, leanMassKg: 68.2, measures: { waist: 84 } });
    const rest = buildPositions(model, shape, new Float32Array(model.n * 3));
    const posed = poseBody(model, rest, shape.height, new Float32Array(rest.length));
    const normal = (p: Float32Array, a: number, b: number, c: number) => {
      const u = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]);
      const v = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    };
    // Com o braço abaixado, a pele do fundo da axila se junta, como na pessoa real, e a do topo do
    // ombro estica. O que não pode haver é pele virada do avesso nem dobra visível.
    let checked = 0, flipped = 0, squeezed = 0;
    for (let t = 0; t < model.tris.length; t += 3) {
      const [a, b, c] = [model.tris[t], model.tris[t + 1], model.tris[t + 2]];
      const y = rest[a * 3 + 1] / shape.height;
      if (y < .69 || y > .86 || Math.abs(rest[a * 3]) / shape.height < .055) continue;
      const before = normal(rest, a, b, c), after = normal(posed, a, b, c);
      if (before.reduce((sum, value, k) => sum + value * after[k], 0) <= 0) flipped++;
      const ratio = Math.hypot(...after) / Math.hypot(...before);
      if (ratio < .5) squeezed++;
      expect(ratio).toBeLessThan(2.5);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
    expect(flipped).toBeLessThanOrEqual(2);
    expect(squeezed / checked).toBeLessThan(0.02);
    expect(rest).toEqual(buildPositions(model, shape, new Float32Array(rest.length)));
  });

  it("baixa os braços para perto do corpo e mantém as mãos fora das coxas", async () => {
    stubModelFiles();
    const model = await loadBodyModel();
    const shape = solveBodyShape(model, { sex: "male", heightCm: 180, weightKg: 80, leanMassKg: 68.2, measures: {} });
    const rest = buildPositions(model, shape, new Float32Array(model.n * 3));
    const posed = poseBody(model, rest, shape.height, new Float32Array(rest.length));
    const H = shape.height;
    // a mão: os vértices desenhados do braço mais próximos da articulação do punho
    const handOf = (side: string, pos: Float32Array) => {
      const joint = jointAt(model, rest, `${side}-hand`);
      const ids = [...Array(model.n).keys()]
        .filter((i) => model.part[i] === 1 && model.rig.vertex.includes(i))
        .sort((a, b) => Math.hypot(rest[a * 3] - joint[0], rest[a * 3 + 1] - joint[1], rest[a * 3 + 2] - joint[2]) - Math.hypot(rest[b * 3] - joint[0], rest[b * 3 + 1] - joint[1], rest[b * 3 + 2] - joint[2]))
        .slice(0, 24);
      return [0, 1, 2].map((a) => ids.reduce((sum, i) => sum + pos[i * 3 + a], 0) / ids.length);
    };
    for (const side of ["l", "r"]) {
      const [shoulder, hand, handPosed] = [jointAt(model, rest, `${side}-shoulder`), handOf(side, rest), handOf(side, posed)];
      // na pose em A a mão fica à frente e longe do tronco; na pose ela desce e se aproxima
      expect(handPosed[1]).toBeLessThan(hand[1]);
      expect(Math.abs(handPosed[0])).toBeLessThan(Math.abs(hand[0]));
      expect(Math.abs(handPosed[2] - shoulder[2]) / H).toBeLessThan(0.06);
      // nenhum vértice da mão entra na coxa: a mão fica mais afastada do centro que o quadril
      let hipWidth = 0;
      for (let i = 0; i < model.n; i++) {
        const y = rest[i * 3 + 1] / H;
        if (model.part[i] !== 1 && y > 0.44 && y < 0.5) hipWidth = Math.max(hipWidth, Math.abs(rest[i * 3]));
      }
      expect(Math.abs(handPosed[0])).toBeGreaterThan(hipWidth);
    }
  });
});

describe("shorts acompanha as medidas e o peso", () => {
  it.each(["male", "female"] as const)("mantém folga fora da pele em corpos leves e pesados: %s", async (sex) => {
    stubModelFiles();
    const model = await loadBodyModel();
    const fit = createGarmentFitter(model);
    const widths: number[] = [];
    for (const [weightKg, waist, hip] of [[55, 68, 86], [80, 84, 98], [110, 102, 114], [145, 130, 136]]) {
      const shape = solveBodyShape(model, { sex, heightCm:180, weightKg, leanMassKg:weightKg * .73, measures:{waist,hip} });
      const rest = buildPositions(model, shape, new Float32Array(model.n * 3));
      const skin = poseBody(model, rest, shape.height, new Float32Array(rest.length));
      const original = skin.slice();
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(skin,3));
      geometry.setIndex(new BufferAttribute(model.tris,1));
      geometry.computeVertexNormals();
      const normals = geometry.attributes.normal.array;
      const cloth = fit(rest,skin,normals,shape.height,new Float32Array(rest.length));
      let maxX = 0, count = 0;
      for (let i=0; i<model.n; i++) {
        const o=i*3, y=rest[o+1]/shape.height;
        if (model.part[i]===1 || y<.38 || y>.55) continue;
        const normalLength=Math.hypot(normals[o],normals[o+2]);
        if (normalLength>.1) {
          const outward=((cloth[o]-skin[o])*normals[o]+(cloth[o+2]-skin[o+2])*normals[o+2])/normalLength;
          expect(outward).toBeGreaterThan(.8);
          expect(outward).toBeLessThan(3);
          count++;
        }
        expect(cloth[o+1]).toBe(skin[o+1]);
        maxX=Math.max(maxX,Math.abs(cloth[o]));
      }
      expect(count).toBeGreaterThan(100);
      expect(skin).toEqual(original);
      widths.push(maxX);
      geometry.dispose();
    }
    expect(widths[3]).toBeGreaterThan(widths[0]*1.15);
  });
});
