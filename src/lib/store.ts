"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
import { durableStateStorage } from "./durable-storage";
import {
  clearIdentityBackup,
  readIdentityBackup,
  writeIdentityBackup,
} from "./identity-backup";
import { clearOnboardingProgress } from "./onboarding-progress";
import {
  activatePaidPlan,
  clampModulesForPlan,
  emptyAiUsage,
  emptySubscription,
  FREE_CHAT_LIMIT,
  isFreeModuleId,
  isSubscriptionActive,
  normalizeAiUsage,
  type AiChatUsage,
  type PaidPlanId,
  type SubscriptionState,
} from "./subscription";
import { localToday } from "./local-date";
import {
  emptyPregnancy,
  isPregnancyModuleId,
  PREGNANCY_MODULE_IDS,
  type PregnancyProfile,
} from "./pregnancy";
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

  /** Беременность (профиль мамы, общий) */
  pregnancy: PregnancyProfile;
  /** Дневники мамы (беременность / цикл) — общие для всех профилей детей */
  momJournals: Record<string, JournalEntry[]>;

  sidebarOpen: boolean;
  pendingChatPrompt: string | null;
  dismissedDiaryHints: string[];
  theme: "dark" | "blush";
  /** одноразовая миграция на розовый дефолт */
  themeDefaultV2?: boolean;
  /** одноразовая: дефолтные разделы больше не навязываются при каждой загрузке */
  modulesDefaultsSeededV1?: boolean;
  /** одноразовая: вода / прогулка / подгузник / заметки */
  modulesCareTrackersV1?: boolean;
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
  /** Выход: сброс профиля и данных → снова анкета */
  logoutAccount: () => void;
  setPregnancy: (pregnancy: Partial<PregnancyProfile> | PregnancyProfile) => void;
  /** Включить все дневники беременности у активного ребёнка/профиля */
  enablePregnancyModules: () => void;
  enableCycleModule: () => void;
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
  updateJournalEntry: (
    moduleId: string,
    id: string,
    patch: Partial<Omit<JournalEntry, "id">>,
  ) => void;
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

/** Дневники беременности и цикла — общие для мамы, не привязаны к ребёнку */
export function isMomJournalId(moduleId: string): boolean {
  return isPregnancyModuleId(moduleId) || moduleId === "cycle";
}

function stripMomJournals(
  journals: Record<string, JournalEntry[]>,
): Record<string, JournalEntry[]> {
  const out: Record<string, JournalEntry[]> = {};
  for (const [k, v] of Object.entries(journals)) {
    if (!isMomJournalId(k)) out[k] = v;
  }
  return out;
}

function overlayMomJournals(
  childJournals: Record<string, JournalEntry[]>,
  momJournals: Record<string, JournalEntry[]>,
): Record<string, JournalEntry[]> {
  return { ...childJournals, ...momJournals };
}

function withActiveSpace(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  patch: Partial<ChildSpace> & Record<string, unknown>,
) {
  const id = get().activeChildId;
  const prev = get().childSpaces[id] ?? emptyChildSpace();
  const rawJournals =
    (patch.journals as Record<string, JournalEntry[]> | undefined) ??
    prev.journals;
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
    journals: stripMomJournals(rawJournals),
    messages: (patch.messages as ChatMessage[]) ?? prev.messages,
    demoWardrobeSeeded:
      (patch.demoWardrobeSeeded as boolean) ?? prev.demoWardrobeSeeded,
  };
  const mirrored = {
    ...spaceSlice(nextSpace),
    journals: overlayMomJournals(nextSpace.journals, get().momJournals),
  };
  set({
    ...mirrored,
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
      pregnancy: emptyPregnancy(),
      momJournals: {},
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
      setAccountEmail: (email) => {
        const accountEmail = email.trim().toLowerCase();
        set({ accountEmail, emailVerified: true });
        writeIdentityBackup({
          onboardingDone: get().onboardingDone,
          email: accountEmail,
          emailVerified: true,
          childName: get().profile?.name,
        });
      },
      clearAccountEmail: () =>
        set({ accountEmail: null, emailVerified: false }),
      logoutAccount: () => {
        const id = uid();
        const profile = emptyChildProfile({ id });
        const space = emptyChildSpace();
        clearIdentityBackup();
        clearOnboardingProgress();
        set({
          children: [profile],
          activeChildId: id,
          childSpaces: { [id]: space },
          onboardingDone: false,
          profile,
          ...spaceSlice(space),
          journals: overlayMomJournals(space.journals, {}),
          pendingChatPrompt: null,
          dismissedDiaryHints: [],
          dietPlan: null,
          opsErrors: [],
          pregnancy: emptyPregnancy(),
          momJournals: {},
          subscription: emptySubscription(),
          aiChatUsage: emptyAiUsage(),
          accountEmail: null,
          emailVerified: false,
          modulesDefaultsSeededV1: true,
          modulesCareTrackersV1: true,
          demoWardrobeSeeded: false,
        });
      },
      setPregnancy: (patch) =>
        set((s) => ({
          pregnancy: { ...s.pregnancy, ...patch },
        })),
      enablePregnancyModules: () => {
        const spaces = { ...get().childSpaces };
        for (const sid of Object.keys(spaces)) {
          const cur = spaces[sid]!;
          const next = [...cur.enabledModules];
          for (const id of PREGNANCY_MODULE_IDS) {
            if (!next.includes(id as ModuleId)) next.push(id as ModuleId);
          }
          spaces[sid] = { ...cur, enabledModules: next };
        }
        const activeId = get().activeChildId;
        set({
          childSpaces: spaces,
          enabledModules:
            spaces[activeId]?.enabledModules ?? get().enabledModules,
        });
      },
      enableCycleModule: () => {
        const spaces = { ...get().childSpaces };
        for (const sid of Object.keys(spaces)) {
          const cur = spaces[sid]!;
          if (cur.enabledModules.includes("cycle")) continue;
          spaces[sid] = {
            ...cur,
            enabledModules: [...cur.enabledModules, "cycle" as ModuleId],
          };
        }
        const activeId = get().activeChildId;
        set({
          childSpaces: spaces,
          enabledModules:
            spaces[activeId]?.enabledModules ?? get().enabledModules,
        });
      },
      activateSubscription: (planId) =>
        set({ subscription: activatePaidPlan(planId) }),
      clearSubscription: () => {
        const freeMods = clampModulesForPlan(
          get().enabledModules,
          false,
        ) as ModuleId[];
        withActiveSpace(get, set, { enabledModules: freeMods });
        set({ subscription: emptySubscription() });
      },
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
        const premium = isSubscriptionActive(get().subscription);
        if (enabled.includes(id)) {
          const next = enabled.filter((x) => x !== id);
          withActiveSpace(get, set, {
            enabledModules: clampModulesForPlan(next, premium) as ModuleId[],
          });
          return;
        }
        if (!premium && !isFreeModuleId(id)) return;
        withActiveSpace(get, set, {
          enabledModules: [...enabled, id],
        });
      },

      enableModule: (id) => {
        const premium = isSubscriptionActive(get().subscription);
        if (!premium && !isFreeModuleId(id)) return;
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
        const row: JournalEntry = {
          ...entry,
          id: uid(),
          createdAt: entry.createdAt || new Date().toISOString(),
        };
        if (isMomJournalId(moduleId)) {
          const momJournals = { ...get().momJournals };
          momJournals[moduleId] = [row, ...(momJournals[moduleId] ?? [])];
          set({
            momJournals,
            journals: {
              ...get().journals,
              [moduleId]: momJournals[moduleId]!,
            },
          });
          return;
        }
        const journals = { ...get().journals };
        journals[moduleId] = [row, ...(journals[moduleId] ?? [])];
        withActiveSpace(get, set, { journals });
      },

      updateJournalEntry: (moduleId, id, patch) => {
        const apply = (list: JournalEntry[]) =>
          list.map((e) => {
            if (e.id !== id) return e;
            const fields =
              patch.fields !== undefined
                ? { ...(e.fields || {}), ...patch.fields }
                : e.fields;
            return { ...e, ...patch, fields };
          });
        if (isMomJournalId(moduleId)) {
          const momJournals = { ...get().momJournals };
          momJournals[moduleId] = apply(momJournals[moduleId] ?? []);
          set({
            momJournals,
            journals: {
              ...get().journals,
              [moduleId]: momJournals[moduleId]!,
            },
          });
          return;
        }
        const journals = { ...get().journals };
        journals[moduleId] = apply(journals[moduleId] ?? []);
        withActiveSpace(get, set, { journals });
      },

      removeJournalEntry: (moduleId, id) => {
        if (isMomJournalId(moduleId)) {
          const momJournals = { ...get().momJournals };
          momJournals[moduleId] = (momJournals[moduleId] ?? []).filter(
            (x) => x.id !== id,
          );
          set({
            momJournals,
            journals: {
              ...get().journals,
              [moduleId]: momJournals[moduleId]!,
            },
          });
          return;
        }
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
          journals: stripMomJournals(get().journals),
          messages: get().messages,
          demoWardrobeSeeded: get().demoWardrobeSeeded,
        };
        const nextSlice = spaceSlice(space);
        set({
          childSpaces: { ...get().childSpaces, [curId]: curSpace },
          activeChildId: id,
          profile: child,
          ...nextSlice,
          journals: overlayMomJournals(space.journals, get().momJournals),
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
          journals: stripMomJournals(get().journals),
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
          journals: overlayMomJournals(space.journals, get().momJournals),
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
          journals: overlayMomJournals(nextSpace.journals, get().momJournals),
        });
      },

      completeOnboarding: () => {
        set({ onboardingDone: true });
        writeIdentityBackup({
          onboardingDone: true,
          email: get().accountEmail,
          emailVerified: get().emailVerified,
          childName: get().profile?.name,
        });
      },
    }),
    {
      name: "maya-mom-ai",
      storage: createJSONStorage(() => durableStateStorage),
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
        modulesCareTrackersV1: state.modulesCareTrackersV1,
        dietPlan: state.dietPlan,
        opsErrors: state.opsErrors,
        pregnancy: state.pregnancy,
        momJournals: state.momJournals,
        subscription: state.subscription,
        aiChatUsage: state.aiChatUsage,
        accountEmail: state.accountEmail,
        emailVerified: state.emailVerified,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.opsErrors) state.opsErrors = [];
        if (!state.subscription) state.subscription = emptySubscription();
        if (!state.pregnancy) state.pregnancy = emptyPregnancy();
        if (!state.momJournals) state.momJournals = {};
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
          if (state.onboardingDone == null) {
            // пустой профиль → показать анкету; иначе не трогаем старых
            const empty =
              !state.profile?.name?.trim() &&
              !state.profile?.birthDate &&
              !(state.messages?.length > 0);
            state.onboardingDone = !empty;
          }
        }

        // Если в сторе «как новый», но есть паспорт / данные профиля —
        // не гоняем анкету снова (часто после ярлыка / PWA).
        {
          const hasLife =
            Boolean(state.profile?.name?.trim()) ||
            Boolean(state.profile?.birthDate) ||
            (state.messages?.length ?? 0) > 0 ||
            (state.children?.some(
              (c) => Boolean(c.name?.trim()) || Boolean(c.birthDate),
            ) ??
              false) ||
            Object.values(state.journals ?? {}).some((e) => e.length > 0) ||
            Object.values(state.childSpaces ?? {}).some(
              (sp) =>
                (sp.messages?.length ?? 0) > 0 ||
                Object.values(sp.journals ?? {}).some((e) => e.length > 0),
            );

          if (hasLife && !state.onboardingDone) {
            state.onboardingDone = true;
          }

          const identity = readIdentityBackup();
          if (identity) {
            if (identity.onboardingDone && !state.onboardingDone) {
              state.onboardingDone = true;
            }
            if (identity.email && !state.accountEmail) {
              state.accountEmail = identity.email;
              state.emailVerified =
                identity.emailVerified || Boolean(state.emailVerified);
            }
            if (identity.emailVerified && state.accountEmail) {
              state.emailVerified = true;
            }
          }

          if (
            state.onboardingDone ||
            state.emailVerified ||
            state.accountEmail
          ) {
            writeIdentityBackup({
              onboardingDone: Boolean(state.onboardingDone),
              email: state.accountEmail,
              emailVerified: Boolean(state.emailVerified),
              childName: state.profile?.name,
            });
          }
        }

        // Вынести дневники беременности/цикла из профилей детей в momJournals
        {
          const mom: Record<string, JournalEntry[]> = {
            ...(state.momJournals || {}),
          };
          const spaces = { ...(state.childSpaces || {}) };
          for (const [sid, space] of Object.entries(spaces)) {
            const j = { ...space.journals };
            let changed = false;
            for (const key of Object.keys(j)) {
              if (!isMomJournalId(key)) continue;
              const list = j[key] ?? [];
              if (list.length) {
                const prev = mom[key] ?? [];
                const seen = new Set(prev.map((e) => e.id));
                mom[key] = [
                  ...prev,
                  ...list.filter((e) => !seen.has(e.id)),
                ];
              }
              delete j[key];
              changed = true;
            }
            if (changed) {
              spaces[sid] = { ...space, journals: j };
            }
          }
          state.momJournals = mom;
          state.childSpaces = spaces;
          const activeSpace =
            spaces[state.activeChildId] ?? emptyChildSpace();
          state.journals = overlayMomJournals(activeSpace.journals, mom);
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

        const defaults: ModuleId[] = ["growth", "breastfeeding", "water"];
        const next = [...(state.enabledModules ?? [])].filter(
          (id) => (id as string) !== "outfit",
        );
        // Один раз: досеять бесплатный набор. Дальше пользователь может отключать
        // (в рамках тарифа) — при следующей загрузке разделы НЕ возвращаются сами.
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
          }
          state.modulesDefaultsSeededV1 = true;
          seededDefaults = true;
        }

        // Старый сид care-трекеров больше не раздувает бесплатный тариф
        if (!state.modulesCareTrackersV1) {
          state.modulesCareTrackersV1 = true;
        }

        // Бесплатный тариф: только ГВ + рост/вес + вода
        {
          const premium = isSubscriptionActive(state.subscription);
          const clamped = clampModulesForPlan(next, premium) as ModuleId[];
          if (
            clamped.length !== next.length ||
            clamped.some((id, i) => id !== next[i])
          ) {
            next.length = 0;
            next.push(...clamped);
            seededDefaults = true;
          }
          for (const sid of Object.keys(state.childSpaces ?? {})) {
            const space = state.childSpaces[sid];
            if (!space) continue;
            space.enabledModules = clampModulesForPlan(
              space.enabledModules,
              premium,
            ) as ModuleId[];
          }
        }

        {
          const journals = { ...(state.journals ?? {}) };
          let touched = false;
          for (const mid of ["growth", "breastfeeding", "water"] as ModuleId[]) {
            if (!journals[mid]) {
              journals[mid] = [];
              touched = true;
            }
          }
          if (touched) state.journals = journals;
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
