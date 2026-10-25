import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), food: vi.fn(), checkins: vi.fn(), metrics: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ getApiUser: mocks.user, unauthorized: () => Response.json({ error: "unauthorized" }, { status: 401 }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { findUnique: mocks.profile }, foodLog: { findMany: mocks.food }, weeklyCheckin: { findMany: mocks.checkins } } }));
vi.mock("@/lib/profile", () => ({ computeCurrentProfileMetrics: mocks.metrics }));
import { POST as briefing } from "../app/api/coach/briefing/route";
import { POST as mealPhoto } from "../app/api/mobile/meal-photo/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "own-user" });
  mocks.profile.mockResolvedValue({ goal: "FAT_LOSS" });
  mocks.food.mockResolvedValue([]);
  mocks.checkins.mockResolvedValue([]);
  mocks.metrics.mockResolvedValue({ metrics: { tdee: 2500, targets: { calories: 2250, proteinG: 160 } } });
});
const request = () => new NextRequest("http://localhost/api/coach/briefing", { method: "POST", body: JSON.stringify({ userId: "other-user", context: { currentDeficitPct: 90 } }) });

describe("coach without model providers", () => {
  it("requires authentication before reading any records", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await briefing(request())).status).toBe(401);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("uses the signed-in user's data, ignoring supplied context and identity", async () => {
    const response = await briefing(request());
    expect(await response.json()).toMatchObject({ source: "rules", insights: [] });
    expect(mocks.profile).toHaveBeenCalledWith({ where: { userId: "own-user" } });
    expect(mocks.food).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "own-user" } }));
  });
  it("returns a deterministic rule when its condition is met", async () => {
    mocks.metrics.mockResolvedValue({ metrics: { tdee: 2500, targets: { calories: 1750, proteinG: 160 } } });
    const result = await (await briefing(request())).json();
    expect(result.source).toBe("rules");
    expect(result.insights[0].trigger).toBe("aggressive_deficit");
  });
  it("rejects photo analysis without processing the uploaded body", async () => {
    const input = request();
    const read = vi.spyOn(input, "json");
    expect((await mealPhoto(input)).status).toBe(410);
    expect(read).not.toHaveBeenCalled();
    expect(mocks.food).not.toHaveBeenCalled();
  });
});
