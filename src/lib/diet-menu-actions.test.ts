import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory Prisma for the Cardápio actions. `$queryRaw` (the SELECT ... FOR UPDATE on the
 * menu row) takes a real lock that is held until the transaction ends, and every read yields
 * to the event loop, so concurrent actions interleave the way they would against Postgres.
 */
const mocks = vi.hoisted(() => {
  type Entry = { id: string; menuId: string; dietPlanId: string; days: number; order: number };
  const state = {
    entries: [] as Entry[],
    plans: new Map<string, string>(), // planId -> owner userId
    menuId: "menu-1" as string | null,
    lock: Promise.resolve(),
    nextId: 1,
    failNextUpdate: false,
  };
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
  const visible = (where: { menuId?: string; dietPlan?: { userId: string } }) => state.entries.filter((entry) =>
    (!where.menuId || entry.menuId === where.menuId) && (!where.dietPlan || state.plans.get(entry.dietPlanId) === where.dietPlan.userId));

  function client(release?: { fn: () => void }) {
    return {
      $queryRaw: async () => {
        if (release) {
          const previous = state.lock;
          let unlock!: () => void;
          state.lock = new Promise<void>((resolve) => { unlock = resolve; });
          await previous;
          release.fn = unlock;
        }
        await pause();
        return state.menuId ? [{ id: state.menuId }] : [];
      },
      dietPlan: {
        findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
          await pause();
          return state.plans.get(where.id) === where.userId ? { id: where.id, name: `Plano ${where.id}` } : null;
        },
      },
      dietMenu: {
        upsert: async () => ({ id: state.menuId }),
        update: async () => ({}),
      },
      dietMenuEntry: {
        findMany: async ({ where, orderBy }: { where: { menuId?: string; dietPlan?: { userId: string } }; orderBy?: unknown }) => {
          await pause();
          const rows = visible(where).map((entry) => ({ ...entry }));
          return orderBy ? rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)) : rows;
        },
        create: async ({ data }: { data: Omit<Entry, "id"> }) => {
          await pause();
          const entry = { id: `new-${state.nextId++}`, ...data };
          state.entries.push(entry);
          return entry;
        },
        update: async ({ where, data }: { where: { id: string }; data: { order: number } }) => {
          await pause();
          const entry = state.entries.find((current) => current.id === where.id);
          if (!entry || state.failNextUpdate) {
            state.failNextUpdate = false;
            throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
          }
          entry.order = data.order;
          return entry;
        },
        updateMany: async () => ({ count: 1 }),
        delete: async ({ where }: { where: { id: string } }) => {
          await pause();
          const index = state.entries.findIndex((entry) => entry.id === where.id);
          if (index < 0) throw Object.assign(new Error("Record to delete does not exist."), { code: "P2025" });
          return state.entries.splice(index, 1)[0];
        },
      },
    };
  }

  const database = {
    ...client(),
    $transaction: async <T,>(operation: (tx: ReturnType<typeof client>) => Promise<T>) => {
      const release = { fn: () => {} };
      try {
        return await operation(client(release));
      } finally {
        release.fn();
      }
    },
  };
  return { state, database };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.database }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user-a", name: "Teste", email: "a@example.test" })) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addDietMenuEntryAction, moveDietMenuEntryAction, removeDietMenuEntryAction } from "../app/dieta/menu-actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function seed(count: number) {
  mocks.state.entries = Array.from({ length: count }, (_, order) => ({ id: `e${order}`, menuId: "menu-1", dietPlanId: "plan-a", days: 7, order }));
}

const orders = () => mocks.state.entries.map((entry) => entry.order).sort((a, b) => a - b);
const idsInOrder = () => [...mocks.state.entries].sort((a, b) => a.order - b.order).map((entry) => entry.id);

beforeEach(() => {
  mocks.state.plans = new Map([["plan-a", "user-a"], ["plan-b", "user-b"]]);
  mocks.state.menuId = "menu-1";
  mocks.state.lock = Promise.resolve();
  mocks.state.nextId = 1;
  mocks.state.failNextUpdate = false;
  seed(0);
});

describe("Cardápio actions under concurrency (in-memory Prisma, no database)", () => {
  it("never passes 12 entries when two adds race on a menu with 11", async () => {
    seed(11);
    const [first, second] = await Promise.all([
      addDietMenuEntryAction(null, form({ planId: "plan-a", days: "7" })),
      addDietMenuEntryAction(null, form({ planId: "plan-a", days: "7" })),
    ]);

    expect(mocks.state.entries).toHaveLength(12);
    expect([first?.ok, second?.ok].sort()).toEqual([false, true]);
    expect(orders()).toEqual(Array.from({ length: 12 }, (_, index) => index));
  });

  it("gives distinct orders to concurrent adds", async () => {
    seed(2);
    await Promise.all([1, 2, 3].map(() => addDietMenuEntryAction(null, form({ planId: "plan-a", days: "5" }))));
    expect(orders()).toEqual([0, 1, 2, 3, 4]);
  });

  it("applies two concurrent moves one after the other", async () => {
    seed(4);
    const results = await Promise.all([
      moveDietMenuEntryAction(null, form({ entryId: "e3", direction: "up" })),
      moveDietMenuEntryAction(null, form({ entryId: "e0", direction: "down" })),
    ]);

    expect(results.every((state) => state?.ok)).toBe(true);
    expect(idsInOrder()).toEqual(["e1", "e0", "e3", "e2"]);
    expect(orders()).toEqual([0, 1, 2, 3]);
  });

  it("answers a move of an entry removed at the same time with a friendly message", async () => {
    seed(3);
    const [removed, moved] = await Promise.all([
      removeDietMenuEntryAction(null, form({ entryId: "e1" })),
      moveDietMenuEntryAction(null, form({ entryId: "e1", direction: "up" })),
    ]);

    expect(removed?.ok).toBe(true);
    expect(moved).toMatchObject({ ok: false, message: "Esse item não está mais no cardápio. A lista foi atualizada." });
    expect(idsInOrder()).toEqual(["e0", "e2"]);
    expect(orders()).toEqual([0, 1]);
  });

  it("compacts the order in the same transaction as the removal", async () => {
    seed(4);
    await Promise.all([
      removeDietMenuEntryAction(null, form({ entryId: "e0" })),
      removeDietMenuEntryAction(null, form({ entryId: "e2" })),
    ]);
    expect(idsInOrder()).toEqual(["e1", "e3"]);
    expect(orders()).toEqual([0, 1]);
  });

  it("turns a P2025 inside the transaction into a friendly message", async () => {
    seed(3);
    mocks.state.failNextUpdate = true;
    await expect(moveDietMenuEntryAction(null, form({ entryId: "e2", direction: "up" }))).resolves.toMatchObject({ ok: false });
  });

  it("ignores entries whose plan belongs to someone else", async () => {
    seed(2);
    mocks.state.entries.push({ id: "foreign", menuId: "menu-1", dietPlanId: "plan-b", days: 7, order: 2 });

    await expect(removeDietMenuEntryAction(null, form({ entryId: "foreign" }))).resolves.toMatchObject({ ok: false });
    await expect(moveDietMenuEntryAction(null, form({ entryId: "foreign", direction: "up" }))).resolves.toMatchObject({ ok: false });
    expect(mocks.state.entries.map((entry) => entry.id)).toContain("foreign");
    await expect(addDietMenuEntryAction(null, form({ planId: "plan-b", days: "7" }))).resolves.toMatchObject({ ok: false });
  });
});
