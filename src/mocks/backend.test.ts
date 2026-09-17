import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOnboarding,
  defaultConfig,
  deleteOnboarding,
  fetchOnboardingConfig,
  listOnboardings,
  loadDraft,
  persistDraft,
  resetOnboardingConfig,
  saveOnboardingConfig,
  submitOnboarding,
} from "./backend";

const COLLECTION = "poc-onboardings";
const CONFIG = "poc-onboarding-config";
const DRAFT = "poc-onboarding-draft";
const LEGACY_ID = "onboarding-poc-v1";
const draftKey = (id = LEGACY_ID) => `${DRAFT}:${id}`;

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("onboarding repository", () => {
  it("seeds and persists the default only on first initialization", async () => {
    expect(await listOnboardings()).toEqual([defaultConfig()]);
    expect(JSON.parse(localStorage.getItem(COLLECTION)!)).toEqual([defaultConfig()]);
    expect(await fetchOnboardingConfig()).toEqual(defaultConfig());
    expect(await listOnboardings()).toHaveLength(1);
  });

  it("migrates the full legacy config and draft once without replacing edits", async () => {
    const legacy = {
      ...defaultConfig(),
      title: "Meu fluxo",
      version: 7,
      steps: [{ id: "custom", title: "Personalizada", fields: [] }],
      edges: [],
      positions: { custom: { x: 12, y: 34 } },
      extension: { retained: true },
    };
    const raw = JSON.stringify(legacy);
    localStorage.setItem(CONFIG, raw);
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Antes", newsletter: false, interests: ["ux"] }));
    expect(await listOnboardings()).toEqual([legacy]);
    expect(loadDraft()).toEqual({ name: "Antes", newsletter: false, interests: ["ux"] });
    expect(localStorage.getItem(CONFIG)).toBe(raw);
    expect(localStorage.getItem(DRAFT)).toBeNull();
    await saveOnboardingConfig({ ...legacy, title: "Depois" });
    await submitOnboarding({});
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Obsoleto" }));
    vi.resetModules();
    const reloaded = await import("./backend");
    expect((await reloaded.fetchOnboardingConfig()).title).toBe("Depois");
    expect(reloaded.loadDraft()).toEqual({});
    expect(localStorage.getItem(draftKey())).toBeNull();
  });

  it("migrates a legacy config with its own id and targets its draft", async () => {
    const legacy = { ...defaultConfig(), id: "custom-legacy" };
    localStorage.setItem(CONFIG, JSON.stringify(legacy));
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Legacy" }));
    expect(loadDraft(legacy.id)).toEqual({ name: "Legacy" });
    expect(await listOnboardings()).toEqual([legacy]);
    await expect(fetchOnboardingConfig()).rejects.toThrow("not found");
    expect(loadDraft()).toEqual({});
  });

  it("migrates a draft without a stored config using the default id", async () => {
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Legacy" }));
    expect(loadDraft()).toEqual({ name: "Legacy" });
    expect(await listOnboardings()).toEqual([defaultConfig()]);
  });

  it("does not replace an existing scoped draft during migration", async () => {
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Old" }));
    localStorage.setItem(draftKey(), JSON.stringify({ name: "New" }));
    expect(loadDraft()).toEqual({ name: "New" });
    await submitOnboarding({});
    expect(loadDraft()).toEqual({});
  });

  it("creates independent blank configs and updates only the requested entry", async () => {
    const [first, second] = await Promise.all([createOnboarding("  Primeiro  "), createOnboarding("Segundo")]);
    expect(first.title).toBe("Primeiro");
    expect(first.id).not.toBe(second.id);
    expect(first.version).toBe(1);
    expect(first.steps).toHaveLength(1);
    expect(first.steps[0]).toMatchObject({ title: "Nova etapa", fields: [] });
    expect(first.steps[0].id).not.toBe(second.steps[0].id);
    expect(first.edges).toBeUndefined();
    const updated = { ...first, title: "Atualizado", version: 2 };
    await saveOnboardingConfig(updated);
    expect(await fetchOnboardingConfig(first.id)).toEqual(updated);
    expect(await fetchOnboardingConfig(second.id)).toEqual(second);
    await deleteOnboarding(first.id);
    expect((await listOnboardings()).map((cfg) => cfg.id)).toEqual([LEGACY_ID, second.id]);
  });

  it.each(["", "   ", "a".repeat(121)])("rejects invalid creation title %j without writing storage", async (title) => {
    await expect(createOnboarding(title)).rejects.toThrow();
    expect(localStorage.length).toBe(0);
  });

  it("accepts 120 characters after trimming", async () => {
    expect((await createOnboarding(`  ${"a".repeat(120)}  `)).title).toBe("a".repeat(120));
  });

  it("resets only the target while preserving its id and title", async () => {
    const first = await createOnboarding("Primeiro");
    const second = await createOnboarding("Segundo");
    await saveOnboardingConfig({ ...first, edges: [], positions: {}, version: 9 });
    const reset = await resetOnboardingConfig(first.id);
    expect(reset).toEqual({ ...defaultConfig(), id: first.id, title: first.title });
    expect(await fetchOnboardingConfig(first.id)).toEqual(reset);
    expect(await fetchOnboardingConfig(second.id)).toEqual(second);
    await saveOnboardingConfig({ ...defaultConfig(), title: "Título legado", steps: [] });
    expect(await resetOnboardingConfig()).toEqual({ ...defaultConfig(), title: "Título legado" });
  });

  it("persists an empty collection across reloads despite legacy storage", async () => {
    localStorage.setItem(CONFIG, JSON.stringify(defaultConfig()));
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Old" }));
    await deleteOnboarding(LEGACY_ID);
    expect(localStorage.getItem(COLLECTION)).toBe("[]");
    vi.resetModules();
    const reloaded = await import("./backend");
    expect(await reloaded.listOnboardings()).toEqual([]);
    await expect(reloaded.fetchOnboardingConfig()).rejects.toThrow("not found");
    expect(reloaded.loadDraft()).toEqual({});
    const created = await reloaded.createOnboarding("Novo");
    expect(await reloaded.listOnboardings()).toEqual([created]);
  });

  it("rejects unknown get, save, reset, delete and submit without recreating entries", async () => {
    await listOnboardings();
    const before = localStorage.getItem(COLLECTION);
    await expect(fetchOnboardingConfig("unknown")).rejects.toThrow("not found");
    await expect(saveOnboardingConfig({ ...defaultConfig(), id: "unknown" })).rejects.toThrow("not found");
    await expect(resetOnboardingConfig("unknown")).rejects.toThrow("not found");
    await expect(deleteOnboarding("unknown")).rejects.toThrow("not found");
    await expect(submitOnboarding({}, "unknown")).rejects.toThrow("not found");
    expect(localStorage.getItem(COLLECTION)).toBe(before);
  });

  it("reads the latest collection after waiting for concurrent mutations", async () => {
    const [first, second] = await Promise.all([createOnboarding("A"), createOnboarding("B")]);
    await Promise.all([
      saveOnboardingConfig({ ...first, title: "Updated A" }),
      saveOnboardingConfig({ ...second, title: "Updated B" }),
    ]);
    expect((await fetchOnboardingConfig(first.id)).title).toBe("Updated A");
    expect((await fetchOnboardingConfig(second.id)).title).toBe("Updated B");
    const results = await Promise.allSettled([
      deleteOnboarding(first.id),
      saveOnboardingConfig(first),
      resetOnboardingConfig(first.id),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "rejected"]);
    await expect(fetchOnboardingConfig(first.id)).rejects.toThrow("not found");
    expect((await fetchOnboardingConfig(second.id)).title).toBe("Updated B");
  });

  it.each(["{broken", "null", "{}", "[null]", JSON.stringify([{ ...defaultConfig(), steps: null }]), JSON.stringify([defaultConfig(), defaultConfig()])])("preserves a corrupt collection %s", async (raw) => {
    localStorage.setItem(COLLECTION, raw);
    localStorage.setItem(CONFIG, JSON.stringify(defaultConfig()));
    await expect(listOnboardings()).rejects.toThrow();
    await expect(createOnboarding("Novo")).rejects.toThrow();
    await expect(saveOnboardingConfig(defaultConfig())).rejects.toThrow();
    await expect(resetOnboardingConfig()).rejects.toThrow();
    await expect(deleteOnboarding(LEGACY_ID)).rejects.toThrow();
    expect(loadDraft()).toEqual({});
    persistDraft({ name: "Ignored" });
    expect(localStorage.getItem(COLLECTION)).toBe(raw);
    expect(localStorage.getItem(draftKey())).toBeNull();
  });

  it.each(["{broken", "null", JSON.stringify({ ...defaultConfig(), steps: [{ id: "a", title: "A", fields: [null] }] })])("does not seed over corrupt legacy config %s", async (raw) => {
    localStorage.setItem(CONFIG, raw);
    localStorage.setItem(DRAFT, JSON.stringify({ name: "Retained" }));
    await expect(listOnboardings()).rejects.toThrow();
    await expect(createOnboarding("Novo")).rejects.toThrow();
    expect(localStorage.getItem(CONFIG)).toBe(raw);
    expect(localStorage.getItem(COLLECTION)).toBeNull();
    expect(localStorage.getItem(DRAFT)).toBe(JSON.stringify({ name: "Retained" }));
  });
});

describe("isolated onboarding drafts", () => {
  it("isolates matching fields and clears only the submitted or deleted draft", async () => {
    const [first, second] = await Promise.all([createOnboarding("A"), createOnboarding("B")]);
    persistDraft({ name: "Legacy" });
    persistDraft({ name: "A", interests: ["ux"], newsletter: true }, first.id);
    persistDraft({ name: "B" }, second.id);
    expect(loadDraft(first.id)).toEqual({ name: "A", interests: ["ux"], newsletter: true });
    expect(loadDraft(second.id)).toEqual({ name: "B" });
    expect(loadDraft()).toEqual({ name: "Legacy" });
    const response = await submitOnboarding({}, first.id);
    expect(response).toMatchObject({ ok: true });
    expect(response.protocol).toMatch(/^POC-\d{6}$/);
    expect(localStorage.getItem(draftKey(first.id))).toBeNull();
    expect(loadDraft(second.id)).toEqual({ name: "B" });
    await deleteOnboarding(second.id);
    persistDraft({ name: "Stale timer" }, second.id);
    expect(localStorage.getItem(draftKey(second.id))).toBeNull();
    expect(loadDraft()).toEqual({ name: "Legacy" });
    await submitOnboarding({});
    expect(localStorage.getItem(draftKey())).toBeNull();
  });

  it("keeps drafts after a failed submission", async () => {
    persistDraft({ email: "erro@example.com" });
    await expect(submitOnboarding(loadDraft())).rejects.toThrow("E-mail inválido");
    expect(loadDraft()).toEqual({ email: "erro@example.com" });
  });

  it.each(["{broken", "null", "[]", '{"name":42}', '{"interests":[null]}'])("ignores and preserves corrupt drafts %s", async (raw) => {
    localStorage.setItem(DRAFT, raw);
    await listOnboardings();
    expect(loadDraft()).toEqual({});
    expect(localStorage.getItem(DRAFT)).toBe(raw);
    localStorage.setItem(draftKey(), raw);
    expect(loadDraft()).toEqual({});
    persistDraft({ name: "Replacement" });
    expect(localStorage.getItem(draftKey())).toBe(raw);
  });

  it("returns empty drafts and does not persist unknown ids", async () => {
    await listOnboardings();
    persistDraft({ name: "Unknown" }, "unknown");
    expect(loadDraft("unknown")).toEqual({});
    expect(localStorage.getItem(draftKey("unknown"))).toBeNull();
  });

  it("handles unavailable storage without crashing draft consumers", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    expect(loadDraft()).toEqual({});
    expect(() => persistDraft({ name: "Ignored" })).not.toThrow();
    await expect(listOnboardings()).rejects.toThrow("Blocked");
  });
});
