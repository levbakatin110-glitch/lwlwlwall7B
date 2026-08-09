"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  emptyChildProfile,
  emptyChildSpace,
  emptyJournals,
  uid,
  type ChildSpace,
} from "./children";
import { migrateJournalFields } from "./module-schema";
import {
  repairBlueprintLocally,
  validateCustomModule,
} from "./blueprint-health";
import {
  makeOpsError,
  trimOpsErrors,
  type OpsErrorLog,
  type OpsErrorSource,
} from "./ops-log";
import { OPTIONAL_MODULES } from "./modules";
import type { DietPlan } from "./diet-types";
import {
  activatePaidPlan,
  emptyAiUsage,
  emptySubscription,
  FREE_CHAT_LIMIT,
  isSubscriptionActive,
  localToday,
  normalizeAiUsage,
  type AiChatUsage,
  type PaidPlanId,
  type SubscriptionState,
} from "./subscription";
import type {
  ChatMessage,
  ChildProfile,
  CustomModule,
  JournalEntry,
  MemoryItem,
  MemoryStory,
  ModuleBlueprint,
  ModuleId,
  WardrobeItem,
} from "./types";

type AppState = {
  children: ChildProfile[];
  activeChildId: string;
  childSpaces: Record<string, ChildSpace>;
  onboardingDone: boolean;

  /** Зеркало активного ребёнка — для существующего кода */
  profile: ChildProfile;
  enabledModules: ModuleId[];
  customModules: CustomModule[];
  wardrobe: WardrobeItem[];
  memories: MemoryItem[];
  memoryStory: MemoryStory | null;
  journals: Record<string, JournalEntry[]>;
  messages: ChatMessage[];
  demoWardrobeSeeded: boolean;

  sidebarOpen: boolean;
  pendingChatPrompt: string | null;
  dismissedDiaryHints: string[];
  theme: "dark" | "blush";
  /** одноразовая миграция на розовый дефолт */
  themeDefaultV2?: boolean;
  /** одноразовая: дефолтные разделы больше не навязываются при каждой загрузке */
  modulesDefaultsSeededV1?: boolean;
  /** План диеты мамы (общий) */
  dietPlan: DietPlan | null;
  /** Лог ошибок чата / API для админки */
  opsErrors: OpsErrorLog[];
  /** Подписка (пока без платёжки — активация в приложении) */
  subscription: SubscriptionState;
  /** Счётчик бесплатных ИИ-сообщений за день */
  aiChatUsage: AiChatUsage;
  /** Почта аккаунта (после подтверждения кодом) */
  accountEmail: string | null;
  emailVerified: boolean;

  setProfile: (profile: ChildProfile) => void;
  setPendingChatPrompt: (prompt: string | null) => void;
  dismissDiaryHint: (id: string) => void;
  setTheme: (theme: "dark" | "blush") => void;
  setDietPlan: (plan: DietPlan | null) => void;
  setAccountEmail: (email: string) => void;
  clearAccountEmail: () => void;
  activateSubscription: (planId: PaidPlanId) => void;
  clearSubscription: () => void;
  /** Списать 1 бесплатный запрос. false = лимит исчерпан */
  consumeAiChatQuota: () => boolean;
  refundAiChatQuota: () => void;
  setMemoryStory: (story: MemoryStory | null) => void;
  toggleModule: (id: ModuleId) => void;
  enableModule: (id: ModuleId) => void;
  addCustomModule: (data: Omit<CustomModule, "id">) => string;
  addCustomModuleFromBlueprint: (blueprint: ModuleBlueprint) => string;
  updateCustomModuleFromBlueprint: (
    id: string,
    blueprint: ModuleBlueprint,
  ) => void;
  /** Локально подлечить все битые свои дневники */
  healCustomModulesLocally: () => number;
  removeCustomModule: (id: string) => void;
  pushOpsError: (entry: {
    source: OpsErrorSource;
    message: string;
    userSnippet?: string;
    status?: number;
    detail?: string;
  }) => void;
  clearOpsErrors: () => void;
  addWardrobeItem: (item: Omit<WardrobeItem, "id">) => void;
  updateWardrobeItem: (id: string, patch: Partial<Omit<WardrobeItem, "id">>) => void;
  removeWardrobeItem: (id: string) => void;
  addMemory: (item: Omit<MemoryItem, "id">) => void;
  removeMemory: (id: string) => void;
  addJournalEntry: (moduleId: string, entry: Omit<JournalEntry, "id">) => void;
  removeJournalEntry: (moduleId: string, id: string) => void;
  addMessage: (message: Omit<ChatMessage, "id"> & { id?: string }) => string;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setSidebarOpen: (open: boolean) => void;

  switchChild: (id: string) => void;
  addChild: (profile: ChildProfile, opts?: { seedGrowth?: { heightCm?: number; weightKg?: number } }) => void;
  removeChild: (id: string) => void;
  completeOnboarding: () => void;
};

function spaceSlice(space: ChildSpace) {
  return {
    enabledModules: space.enabledModules,
    customModules: space.customModules,
    wardrobe: space.wardrobe,
    memories: space.memories,
    memoryStory: space.memoryStory,
    journals: space.journals,
    messages: space.messages,
    demoWardrobeSeeded: space.demoWardrobeSeeded,
  };
}

function withActiveSpace(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  patch: Partial<ChildSpace> & Record<string, unknown>,
) {
  const id = get().activeChildId;
  const prev = get().childSpaces[id] ?? emptyChildSpace();
  const nextSpace: ChildSpace = {
    ...prev,
    enabledModules: (patch.enabledModules as ModuleId[]) ?? prev.enabledModules,
    customModules: (patch.customModules as CustomModule[]) ?? prev.customModules,
    wardrobe: (patch.wardrobe as WardrobeItem[]) ?? prev.wardrobe,
    memories: (patch.memories as MemoryItem[]) ?? prev.memories,
    memoryStory:
      "memoryStory" in patch
        ? (patch.memoryStory as MemoryStory | null)
        : prev.memoryStory,
    journals:
      (patch.journals as Record<string, JournalEntry[]>) ?? prev.journals,
    messages: (patch.messages as ChatMessage[]) ?? prev.messages,
    demoWardrobeSeeded:
      (patch.demoWardrobeSeeded as boolean) ?? prev.demoWardrobeSeeded,
  };
  set({
    ...spaceSlice(nextSpace),
    childSpaces: { ...get().childSpaces, [id]: nextSpace },
  });
}

function seedGrowthEntries(
  heightCm?: number,
  weightKg?: number,
): JournalEntry[] {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const parts: string[] = [];
  if (heightCm != null) parts.push(`${heightCm} см`);
  if (weightKg != null) parts.push(`${weightKg} кг`);
  if (!parts.length) return [];
  return [
    {
      id: uid(),
      date,
      createdAt: now,
      value: parts.join(", "),
      note: "из анкеты при старте",
      fields: {
        ...(heightCm != null ? { height: heightCm } : {}),
        ...(weightKg != null ? { weight: weightKg } : {}),
      },
    },
  ];
}

const firstId = uid();
const firstProfile = emptyChildProfile({ id: firstId });
const firstSpace = emptyChildSpace();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      children: [firstProfile],
      activeChildId: firstId,
      childSpaces: { [firstId]: firstSpace },
      onboardingDone: false,

      profile: firstProfile,
      ...spaceSlice(firstSpace),

      sidebarOpen: false,
      pendingChatPrompt: null,
      dismissedDiaryHints: [],
      theme: "blush",
      themeDefaultV2: true,
      dietPlan: null,
      opsErrors: [],
      subscription: emptySubscription(),
      aiChatUsage: emptyAiUsage(),
      accountEmail: null,
      emailVerified: false,

      setPendingChatPrompt: (prompt) => set({ pendingChatPrompt: prompt }),
      dismissDiaryHint: (id) => {
        const cur = get().dismissedDiaryHints;
        if (cur.includes(id)) return;
        set({ dismissedDiaryHints: [...cur, id] });
      },
      setTheme: (theme) => set({ theme }),
      setDietPlan: (plan) => set({ dietPlan: plan }),
      setAccountEmail: (email) =>
        set({
          accountEmail: email.trim().toLowerCase(),
          emailVerified: true,
        }),
      clearAccountEmail: () =>
        set({ accountEmail: null, emailVerified: false }),
      activateSubscription: (planId) =>
        set({ subscription: activatePaidPlan(planId) }),
      clearSubscription: () =>
        set({ subscription: emptySubscription() }),
      consumeAiChatQuota: () => {
        if (isSubscriptionActive(get().subscription)) return true;
        const today = localToday();
        const usage = normalizeAiUsage(get().aiChatUsage, today);
        if (usage.count >= FREE_CHAT_LIMIT) return false;
        set({ aiChatUsage: { date: today, count: usage.count + 1 } });
        return true;
      },
      refundAiChatQuota: () => {
        if (isSubscriptionActive(get().subscription)) return;
        const today = localToday();
        const usage = normalizeAiUsage(get().aiChatUsage, today);
        if (usage.count <= 0) return;
        set({ aiChatUsage: { date: today, count: usage.count - 1 } });
      },
      pushOpsError: (entry) => {
        const row = makeOpsError(entry);
        set({ opsErrors: trimOpsErrors([row, ...(get().opsErrors ?? [])]) });
        // дублируем на сервер (best-effort)
        if (typeof window !== "undefined") {
          void fetch("/api/ops-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row),
          }).catch(() => {});
        }
      },
      clearOpsErrors: () => set({ opsErrors: [] }),

      setProfile: (profile) => {
        const id = get().activeChildId;
        const next = {
          ...profile,
          id: profile.id || id,
          // если имя уже есть — флаг «ещё не выбрали» снимаем
          namePending: profile.name?.trim() ? false : Boolean(profile.namePending),
        };
        set({
          profile: next,
          children: get().children.map((c) => (c.id === id ? next : c)),
        });
      },

      setMemoryStory: (story) => withActiveSpace(get, set, { memoryStory: story }),

      toggleModule: (id) => {
        const enabled = get().enabledModules;
        withActiveSpace(get, set, {
          enabledModules: enabled.includes(id)
            ? enabled.filter((x) => x !== id)
            : [...enabled, id],
        });
      },

      enableModule: (id) => {
        const enabled = get().enabledModules;
        if (!enabled.includes(id)) {
          withActiveSpace(get, set, { enabledModules: [...enabled, id] });
        }
      },

      addCustomModule: (data) => {
        const id = `custom-${uid()}`;
        const module: CustomModule = { ...data, id };
        withActiveSpace(get, set, {
          customModules: [module, ...get().customModules],
          journals: { ...get().journals, [id]: [] },
        });
        return id;
      },

      addCustomModuleFromBlueprint: (blueprint) => {
        const id = `custom-${uid()}`;
        const module: CustomModule = {
          id,
          title: blueprint.title,
          description: blueprint.description,
          icon: blueprint.icon,
          valueLabel: blueprint.fields[0]?.label || "Запись",
          valuePlaceholder:
            blueprint.fields[0]?.placeholder || "Напишите как удобно",
          fields: blueprint.fields,
          chartFieldKey: blueprint.chartFieldKey,
          smart: blueprint.smart,
        };
        withActiveSpace(get, set, {
          customModules: [module, ...get().customModules],
          journals: { ...get().journals, [id]: [] },
        });
        return id;
      },

      updateCustomModuleFromBlueprint: (id, blueprint) => {
        const journals = { ...get().journals };
        const prev = journals[id] ?? [];
        journals[id] = migrateJournalFields(prev, blueprint.fields);
        const health = validateCustomModule({
          id,
          title: blueprint.title,
          description: blueprint.description,
          icon: blueprint.icon,
          valueLabel: blueprint.fields[0]?.label || "Запись",
          valuePlaceholder: blueprint.fields[0]?.placeholder || "",
          fields: blueprint.fields,
          chartFieldKey: blueprint.chartFieldKey,
          smart: blueprint.smart,
        });
        withActiveSpace(get, set, {
          customModules: get().customModules.map((m) =>
            m.id === id
              ? {
                  ...m,
                  title: blueprint.title,
                  description: blueprint.description,
                  icon: blueprint.icon,
                  valueLabel: blueprint.fields[0]?.label || m.valueLabel,
                  valuePlaceholder:
                    blueprint.fields[0]?.placeholder || m.valuePlaceholder,
                  fields: blueprint.fields,
                  chartFieldKey: blueprint.chartFieldKey,
                  smart: blueprint.smart,
                  healthIssues: health.issues.map((i) => i.message),
                  lastRepairedAt: new Date().toISOString(),
                }
              : m,
          ),
          journals,
        });
      },

      healCustomModulesLocally: () => {
        let fixed = 0;
        const spaces: Record<string, ChildSpace> = { ...get().childSpaces };

        for (const sid of Object.keys(spaces)) {
          const space = spaces[sid];
          if (!space?.customModules?.length) continue;
          let journals = { ...space.journals };
          const nextMods = space.customModules.map((m) => {
            const health = validateCustomModule(m);
            if (health.ok && health.issues.length === 0) return m;
            const bp = repairBlueprintLocally(m);
            journals = {
              ...journals,
              [m.id]: migrateJournalFields(journals[m.id] ?? [], bp.fields),
            };
            fixed += 1;
            const after = validateCustomModule({
              ...m,
              title: bp.title,
              description: bp.description,
              icon: bp.icon,
              fields: bp.fields,
              chartFieldKey: bp.chartFieldKey,
              smart: bp.smart,
            });
            return {
              ...m,
              title: bp.title,
              description: bp.description,
              icon: bp.icon,
              valueLabel: bp.fields[0]?.label || m.valueLabel,
              valuePlaceholder:
                bp.fields[0]?.placeholder || m.valuePlaceholder,
              fields: bp.fields,
              chartFieldKey: bp.chartFieldKey,
              smart: bp.smart,
              healthIssues: after.issues.map((i) => i.message),
              lastRepairedAt: new Date().toISOString(),
            };
          });
          spaces[sid] = {
            ...space,
            customModules: nextMods,
            journals,
          };
        }

        const active = spaces[get().activeChildId];
        set({
          childSpaces: spaces,
          ...(active
            ? {
                customModules: active.customModules,
                journals: active.journals,
              }
            : {}),
        });
        return fixed;
      },

      removeCustomModule: (id) => {
        const journals = { ...get().journals };
        delete journals[id];
        withActiveSpace(get, set, {
          customModules: get().customModules.filter((m) => m.id !== id),
          journals,
        });
      },

      addWardrobeItem: (item) =>
        withActiveSpace(get, set, {
          wardrobe: [{ ...item, id: uid() }, ...get().wardrobe],
        }),

      updateWardrobeItem: (id, patch) =>
        withActiveSpace(get, set, {
          wardrobe: get().wardrobe.map((x) =>
            x.id === id ? { ...x, ...patch } : x,
          ),
        }),

      removeWardrobeItem: (id) =>
        withActiveSpace(get, set, {
          wardrobe: get().wardrobe.filter((x) => x.id !== id),
        }),

      addMemory: (item) =>
        withActiveSpace(get, set, {
          memories: [{ ...item, id: uid() }, ...get().memories],
        }),

      removeMemory: (id) => {
        const story = get().memoryStory;
        withActiveSpace(get, set, {
          memories: get().memories.filter((x) => x.id !== id),
          memoryStory: story
            ? {
                ...story,
                scenes: story.scenes.filter((s) => s.memoryId !== id),
              }
            : null,
        });
      },

      addJournalEntry: (moduleId, entry) => {
        const journals = { ...get().journals };
        journals[moduleId] = [
          {
            ...entry,
            id: uid(),
            createdAt: entry.createdAt || new Date().toISOString(),
          },
          ...(journals[moduleId] ?? []),
        ];
        withActiveSpace(get, set, { journals });
      },

      removeJournalEntry: (moduleId, id) => {
        const journals = { ...get().journals };
        journals[moduleId] = (journals[moduleId] ?? []).filter((x) => x.id !== id);
        withActiveSpace(get, set, { journals });
      },

      addMessage: (message) => {
        const id = message.id ?? uid();
        withActiveSpace(get, set, {
          messages: [...get().messages, { ...message, id }],
        });
        return id;
      },

      updateMessage: (id, patch) =>
        withActiveSpace(get, set, {
          messages: get().messages.map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          ),
        }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      switchChild: (id) => {
        const child = get().children.find((c) => c.id === id);
        const space = get().childSpaces[id];
        if (!child || !space) return;
        // сохранить текущее зеркало в spaces (на всякий)
        const curId = get().activeChildId;
        const curSpace: ChildSpace = {
          enabledModules: get().enabledModules,
          customModules: get().customModules,
          wardrobe: get().wardrobe,
          memories: get().memories,
          memoryStory: get().memoryStory,
          journals: get().journals,
          messages: get().messages,
          demoWardrobeSeeded: get().demoWardrobeSeeded,
        };
        set({
          childSpaces: { ...get().childSpaces, [curId]: curSpace },
          activeChildId: id,
          profile: child,
          ...spaceSlice(space),
        });
      },

      addChild: (profile, opts) => {
        const id = profile.id || uid();
        const child = { ...profile, id };
        const space = emptyChildSpace();
        const growth = seedGrowthEntries(
          opts?.seedGrowth?.heightCm,
          opts?.seedGrowth?.weightKg,
        );
        if (growth.length) {
          space.journals = {
            ...space.journals,
            growth: [...growth, ...(space.journals.growth ?? [])],
          };
        }
        // сохранить текущий
        const curId = get().activeChildId;
        const curSpace: ChildSpace = {
          enabledModules: get().enabledModules,
          customModules: get().customModules,
          wardrobe: get().wardrobe,
          memories: get().memories,
          memoryStory: get().memoryStory,
          journals: get().journals,
          messages: get().messages,
          demoWardrobeSeeded: get().demoWardrobeSeeded,
        };
        set({
          children: [...get().children, child],
          childSpaces: {
            ...get().childSpaces,
            [curId]: curSpace,
            [id]: space,
          },
          activeChildId: id,
          profile: child,
          ...spaceSlice(space),
        });
      },

      removeChild: (id) => {
        if (get().children.length <= 1) return;
        const children = get().children.filter((c) => c.id !== id);
        const spaces = { ...get().childSpaces };
        delete spaces[id];
        const nextId =
          get().activeChildId === id ? children[0].id : get().activeChildId;
        const nextChild = children.find((c) => c.id === nextId)!;
        const nextSpace = spaces[nextId] ?? emptyChildSpace();
        set({
          children,
          childSpaces: spaces,
          activeChildId: nextId,
          profile: nextChild,
          ...spaceSlice(nextSpace),
        });
      },

      completeOnboarding: () => set({ onboardingDone: true }),
    }),
    {
      name: "maya-mom-ai",
      partialize: (state) => ({
        children: state.children,
        activeChildId: state.activeChildId,
        childSpaces: state.childSpaces,
        onboardingDone: state.onboardingDone,
        // зеркала — чтобы старые селекторы и бэкап не ломались
        profile: state.profile,
        enabledModules: state.enabledModules,
        customModules: state.customModules,
        wardrobe: state.wardrobe,
        memories: state.memories,
        memoryStory: state.memoryStory,
        journals: state.journals,
        messages: state.messages,
        dismissedDiaryHints: state.dismissedDiaryHints,
        demoWardrobeSeeded: state.demoWardrobeSeeded,
        theme: state.theme,
        themeDefaultV2: state.themeDefaultV2,
        modulesDefaultsSeededV1: state.modulesDefaultsSeededV1,
        dietPlan: state.dietPlan,
        opsErrors: state.opsErrors,
        subscription: state.subscription,
        aiChatUsage: state.aiChatUsage,
        accountEmail: state.accountEmail,
        emailVerified: state.emailVerified,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.opsErrors) state.opsErrors = [];
        if (!state.subscription) state.subscription = emptySubscription();
        if (!state.aiChatUsage) state.aiChatUsage = emptyAiUsage();
        if (state.accountEmail === undefined) state.accountEmail = null;
        if (state.emailVerified == null) state.emailVerified = false;
        // просроченная подписка → free
        if (
          state.subscription.planId !== "free" &&
          !isSubscriptionActive(state.subscription)
        ) {
          state.subscription = emptySubscription();
        }

        // Миграция со старого формата (один profile без children)
        const legacy = state as AppState & { profile?: ChildProfile };
        if (!legacy.children?.length) {
          const id = legacy.profile?.id || uid();
          const profile = emptyChildProfile({
            ...legacy.profile,
            id,
          });
          const space: ChildSpace = {
            enabledModules: legacy.enabledModules?.length
              ? legacy.enabledModules
              : ["growth", "sleep", "breastfeeding", "formula", "solids"],
            customModules: legacy.customModules ?? [],
            wardrobe: legacy.wardrobe ?? [],
            memories: legacy.memories ?? [],
            memoryStory: legacy.memoryStory ?? null,
            journals: legacy.journals ?? emptyJournals(),
            messages: legacy.messages ?? [],
            demoWardrobeSeeded: legacy.demoWardrobeSeeded ?? false,
          };
          state.children = [profile];
          state.activeChildId = id;
          state.childSpaces = { [id]: space };
          state.profile = profile;
          Object.assign(state, spaceSlice(space));
          // если уже что-то заполняли — онбординг не навязываем
          state.onboardingDone = Boolean(
            profile.name?.trim() ||
              profile.birthDate ||
              (legacy.messages?.length ?? 0) > 0 ||
              (legacy.journals &&
                Object.values(legacy.journals).some((e) => e.length > 0)),
          );
        } else {
          // синхронизировать зеркало с active
          const id = state.activeChildId || state.children[0].id;
          const child =
            state.children.find((c) => c.id === id) || state.children[0];
          const space = state.childSpaces?.[id] ?? emptyChildSpace();
          state.activeChildId = child.id;
          state.profile = { ...child, id: child.id };
          Object.assign(state, spaceSlice(space));
          if (state.onboardingDone == null) state.onboardingDone = true;
        }

        // если имя уже есть — убрать «ещё не выбрали»
        state.children = (state.children ?? []).map((c) =>
          c.name?.trim() ? { ...c, namePending: false } : c,
        );
        if (state.profile?.name?.trim()) {
          state.profile = { ...state.profile, namePending: false };
        }

        if (state.theme !== "blush" && state.theme !== "dark") {
          state.theme = "blush";
        }
        // один раз: розовая тема стала дефолтом
        if (!state.themeDefaultV2) {
          state.theme = "blush";
          state.themeDefaultV2 = true;
        }

        const defaults: ModuleId[] = [
          "growth",
          "sleep",
          "breastfeeding",
          "formula",
          "solids",
          "diet",
        ];
        const next = [...(state.enabledModules ?? [])].filter(
          (id) => (id as string) !== "outfit",
        );
        // Один раз: досеять дефолты / диету. Дальше пользователь может отключать —
        // при следующей загрузке разделы НЕ возвращаются сами.
        let seededDefaults = false;
        if (!state.modulesDefaultsSeededV1) {
          for (const mid of defaults) {
            if (!next.includes(mid)) next.push(mid);
          }
          for (const sid of Object.keys(state.childSpaces ?? {})) {
            const space = state.childSpaces[sid];
            if (!space) continue;
            let mods = [...space.enabledModules].filter(
              (id) => (id as string) !== "outfit",
            );
            for (const mid of defaults) {
              if (!mods.includes(mid)) mods.push(mid);
            }
            space.enabledModules = mods;
            if (!space.journals.diet) space.journals.diet = [];
          }
          state.modulesDefaultsSeededV1 = true;
          seededDefaults = true;
        }
        if (!state.journals?.diet) {
          state.journals = { ...(state.journals ?? {}), diet: [] };
        }
        if (state.dietPlan === undefined) state.dietPlan = null;
        if (state.dietPlan && !(state.dietPlan as { goalMode?: string }).goalMode) {
          const p = state.dietPlan as {
            weightKg?: number;
            targetWeightKg?: number;
            goalMode?: "lose" | "maintain" | "gain";
          };
          const tw = p.targetWeightKg;
          const w = p.weightKg;
          if (tw != null && w != null && tw < w - 0.3) p.goalMode = "lose";
          else if (tw != null && w != null && tw > w + 0.3) p.goalMode = "gain";
          else p.goalMode = "maintain";
        }

        // авто-лечение битых своих дневников при загрузке
        for (const sid of Object.keys(state.childSpaces ?? {})) {
          const space = state.childSpaces[sid];
          if (!space?.customModules?.length) continue;
          let touched = false;
          const journals = { ...space.journals };
          const mods = space.customModules.map((m) => {
            const health = validateCustomModule(m);
            if (health.ok && health.issues.length === 0) {
              return {
                ...m,
                healthIssues: [],
              };
            }
            touched = true;
            const bp = repairBlueprintLocally(m);
            journals[m.id] = migrateJournalFields(
              journals[m.id] ?? [],
              bp.fields,
            );
            const after = validateCustomModule({
              ...m,
              fields: bp.fields,
              smart: bp.smart,
              chartFieldKey: bp.chartFieldKey,
              title: bp.title,
              description: bp.description,
              icon: bp.icon,
            });
            return {
              ...m,
              title: bp.title,
              description: bp.description,
              icon: bp.icon,
              valueLabel: bp.fields[0]?.label || m.valueLabel,
              valuePlaceholder:
                bp.fields[0]?.placeholder || m.valuePlaceholder,
              fields: bp.fields,
              chartFieldKey: bp.chartFieldKey,
              smart: bp.smart,
              healthIssues: after.issues.map((i) => i.message),
              lastRepairedAt: new Date().toISOString(),
            };
          });
          if (touched) {
            space.customModules = mods;
            space.journals = journals;
          } else {
            space.customModules = mods;
          }
        }
        {
          const sid = state.activeChildId;
          const space = state.childSpaces?.[sid];
          if (space) {
            state.customModules = space.customModules;
            state.journals = space.journals;
          }
        }
        if (
          seededDefaults ||
          next.length !== (state.enabledModules?.length ?? 0) ||
          (state.enabledModules as string[] | undefined)?.includes("outfit")
        ) {
          state.enabledModules = next;
          const sid = state.activeChildId;
          if (state.childSpaces?.[sid]) {
            state.childSpaces[sid].enabledModules = next;
          }
        }

        if (!state.demoWardrobeSeeded) {
          const demos: WardrobeItem[] = [
            {
              id: "demo-romper",
              name: "Комбинезон",
              type: "комбинезон",
              season: "демисезон",
              note: "",
              imageData: "/demo/romper-outfit.png",
              tempMinC: 0,
              tempMaxC: 12,
              tempSource: "ai",
              weatherTags: ["ветер"],
              aiDescription:
                "Демисезонный комбинезон с капюшоном — для прохладной погоды около 0…+12°C.",
              analyzed: true,
            },
            {
              id: "demo-boots",
              name: "Сапожки",
              type: "обувь",
              season: "демисезон",
              note: "",
              imageData: "/demo/boots.png",
              tempMinC: -5,
              tempMaxC: 15,
              tempSource: "ai",
              weatherTags: ["слякоть", "ветер"],
              aiDescription:
                "Тёплые сапожки для прогулок в прохладную и сырую погоду.",
              analyzed: true,
            },
          ];
          const existing = new Set(state.wardrobe.map((w) => w.id));
          const toAdd = demos.filter((d) => !existing.has(d.id));
          if (toAdd.length) {
            state.wardrobe = [...toAdd, ...state.wardrobe];
          }
          state.demoWardrobeSeeded = true;
          const sid = state.activeChildId;
          if (state.childSpaces?.[sid]) {
            state.childSpaces[sid].wardrobe = state.wardrobe;
            state.childSpaces[sid].demoWardrobeSeeded = true;
          }
        }

        // ensure journals keys
        for (const mod of OPTIONAL_MODULES) {
          if (!state.journals[mod.id]) state.journals[mod.id] = [];
        }
      },
    },
  ),
);
