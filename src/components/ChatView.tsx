"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChatChart } from "@/components/ChatChart";
import { ChatNewsFeed } from "@/components/ChatNewsFeed";
import { HomeWeatherCard } from "@/components/HomeWeatherCard";
import { JournalEntryChip } from "@/components/JournalEntryChip";
import { LogPreviewSheet, type LogPreviewData } from "@/components/LogPreviewSheet";
import { KitchenCarousel } from "@/components/KitchenCarousel";
import { CHAT_PROMPTS } from "@/components/TipsCarousel";
import { VpnHintBanner } from "@/components/VpnHintBanner";
import { WeatherWidget } from "@/components/WeatherWidget";
import { WardrobeChatCard } from "@/components/WardrobeChatCard";
import {
  SketchBackdrop,
  SketchDoodles,
  SketchMaya,
} from "@/components/illustrations/MayaSketch";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { stripSuggestMarker, wardrobeForChat, resolveDiaryId, wardrobeFitsWeather } from "@/lib/ai-context";
import { inferDiaryOffer } from "@/lib/diary-offer";
import { inferLogDraftsFromUserText, looksLikeDiaryFact, mergeDiaryDrafts } from "@/lib/log-fallback";
import { MODULE_BY_ID } from "@/lib/modules";
import { summarizeEntryFields } from "@/lib/module-schema";
import {
  canSendAiChat,
  FREE_CHAT_LIMIT,
  freeChatRemaining,
  isSubscriptionActive,
} from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { ModuleBlueprint, ModuleId, WeatherSnapshot } from "@/lib/types";
import { decodeWeatherHeader } from "@/lib/weather";
import Link from "next/link";
import { useRouter } from "next/navigation";

function isOutfitIntent(text: string) {
  const t = text.toLowerCase();
  return /одеть|надеть|прогул|гулять|погод|улиц|что.*нос|гардероб|комбинезон|куртк|холодно|жарко|дожд|снег|температур/.test(
    t,
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: {
    resultIndex: number;
    results: {
      length: number;
      [i: number]: { [j: number]: { transcript: string } };
    };
  }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export function ChatView() {
  const messages = useAppStore((s) => s.messages);
  const profile = useAppStore((s) => s.profile);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const customModules = useAppStore((s) => s.customModules);
  const wardrobe = useAppStore((s) => s.wardrobe);
  const memories = useAppStore((s) => s.memories);
  const memoryStory = useAppStore((s) => s.memoryStory);
  const journals = useAppStore((s) => s.journals);
  const pregnancy = useAppStore((s) => s.pregnancy);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const addCustomModuleFromBlueprint = useAppStore((s) => s.addCustomModuleFromBlueprint);
  const updateCustomModuleFromBlueprint = useAppStore(
    (s) => s.updateCustomModuleFromBlueprint,
  );
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const enableModule = useAppStore((s) => s.enableModule);
  const pushOpsError = useAppStore((s) => s.pushOpsError);
  const subscription = useAppStore((s) => s.subscription);
  const aiChatUsage = useAppStore((s) => s.aiChatUsage);
  const consumeAiChatQuota = useAppStore((s) => s.consumeAiChatQuota);
  const refundAiChatQuota = useAppStore((s) => s.refundAiChatQuota);
  const premium = isSubscriptionActive(subscription);
  const chatLeft = freeChatRemaining(subscription, aiChatUsage);

  const pendingChatPrompt = useAppStore((s) => s.pendingChatPrompt);
  const setPendingChatPrompt = useAppStore((s) => s.setPendingChatPrompt);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logPreview, setLogPreview] = useState<LogPreviewData | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoPending, setGeoPending] = useState(true);
  const [vpnSuspect, setVpnSuspect] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const voiceBaseRef = useRef("");

  function requestPhoneLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoPending(false);
      void fallbackIpLocation();
      return;
    }
    // На http:// (не localhost) Chrome часто запрещает GPS
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoPending(false);
      setCoords(null);
      void fallbackIpLocation();
      return;
    }
    setCoords(null);
    setGeoPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoPending(false);
      },
      () => {
        setGeoPending(false);
        setCoords(null);
        void fallbackIpLocation();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 4000,
      },
    );
  }

  async function fallbackIpLocation(): Promise<{
    latitude: number;
    longitude: number;
  } | null> {
    try {
      const res = await fetch("/api/geo-ip", {
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          latitude?: number;
          longitude?: number;
          city?: string | null;
        };
        if (
          data.ok &&
          Number.isFinite(data.latitude) &&
          Number.isFinite(data.longitude)
        ) {
          const next = {
            latitude: data.latitude!,
            longitude: data.longitude!,
          };
          setCoords(next);
          if (data.city?.trim()) {
            const current = useAppStore.getState().profile;
            if (!current.city?.trim()) {
              useAppStore
                .getState()
                .setProfile({ ...current, city: data.city.trim() });
            }
          }
          return next;
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch("https://get.geojs.io/v1/ip/geo.json", {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        latitude?: string;
        longitude?: string;
        city?: string;
        region?: string;
      };
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const next = { latitude, longitude };
      setCoords(next);
      const place = (data.city || data.region || "").trim();
      if (place) {
        const current = useAppStore.getState().profile;
        if (!current.city?.trim()) {
          useAppStore.getState().setProfile({ ...current, city: place });
        }
      }
      return next;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    // Крутим только ленту сообщений внутри окна чата — не всю страницу вниз
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    setVoiceSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    requestPhoneLocation();
  }, []);

  useEffect(() => {
    if (!pendingChatPrompt) return;
    setInput(pendingChatPrompt);
    setPendingChatPrompt(null);
  }, [pendingChatPrompt, setPendingChatPrompt]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  async function toggleVoice() {
    if (pending) return;
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("Голос здесь не работает — откройте в Chrome или Edge.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    // Сначала явно просим микрофон — появляется системное «Разрешить?»
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-media");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setListening(false);
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError(
          "Браузер не даёт микрофон на незащищённом адресе (http). Нужен https — пока напишите текстом, Мая так же поймёт.",
        );
        return;
      }
      setError(
        "Браузер спросил доступ к микрофону — нажмите «Разрешить». Если окошка не было: рядом с адресом сайта откройте значок и включите микрофон.",
      );
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "ru-RU";
    rec.interimResults = true;
    rec.continuous = false;
    voiceBaseRef.current = input.trim();

    rec.onresult = (ev) => {
      let transcript = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        transcript += ev.results[i]![0]!.transcript;
      }
      const base = voiceBaseRef.current;
      setInput(base ? `${base} ${transcript}`.trim() : transcript.trim());
    };
    rec.onerror = (ev) => {
      setListening(false);
      const code = ev.error || "";
      if (code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError(
          "Нужно разрешить микрофон. Нажмите на микрофон ещё раз — должно появиться «Разрешить». Если уже запретили: у адреса сайта включите микрофон и попробуйте снова.",
        );
        return;
      }
      if (code === "no-speech") {
        setError("Не услышала — нажмите микрофон и говорите чуть громче.");
        return;
      }
      if (code === "audio-capture") {
        setError(
          "Микрофон занят или не найден. Закройте другие приложения с микрофоном и попробуйте снова.",
        );
        return;
      }
      if (code === "network") {
        setError(
          "Распознавание речи идёт через Google. Без доступа к их серверам не работает — включите VPN в браузере и попробуйте снова. Или пишите текстом.",
        );
        return;
      }
      if (code === "language-not-supported") {
        setError(
          "Русский язык для голоса в этом браузере не поддерживается. Попробуйте Chrome или Edge.",
        );
        return;
      }
      setError(
        `Не удалось распознать речь (${code || "ошибка"}). Попробуйте Chrome/Edge или напишите текстом.`,
      );
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      setError(null);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setError("Не удалось включить микрофон. Нажмите ещё раз — браузер спросит разрешение.");
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const gate = canSendAiChat(subscription, aiChatUsage);
    if (!gate.ok) {
      setError(
        `На сегодня лимит бесплатных сообщений (${FREE_CHAT_LIMIT}). Завтра снова или оформите подписку.`,
      );
      return;
    }
    if (!consumeAiChatQuota()) {
      setError(
        `На сегодня лимит бесплатных сообщений (${FREE_CHAT_LIMIT}). Завтра снова или оформите подписку.`,
      );
      return;
    }

    setInput("");
    setError(null);

    addMessage({ role: "user", content: text });
    const assistantId = addMessage({ role: "assistant", content: "" });

    startTransition(async () => {
      try {
        let sendCoords = coords;
        if (!sendCoords) {
          // Не ждём гео дольше 1.5с — иначе чат упирается в 504 nginx
          sendCoords = await Promise.race([
            fallbackIpLocation(),
            new Promise<null>((r) => setTimeout(() => r(null), 1500)),
          ]);
        }
        const liveProfile = useAppStore.getState().profile;

        const history = [
          ...useAppStore.getState().messages.filter((m) => m.id !== assistantId),
        ]
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

        const journalsForChat = Object.fromEntries(
          Object.entries(journals).map(([k, v]) => [k, (v ?? []).slice(0, 40)]),
        );

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            profile: liveProfile,
            enabledModules,
            customModules,
            wardrobe: wardrobeForChat(wardrobe),
            memories,
            memoryStory,
            journals: journalsForChat,
            coords: sendCoords,
            pregnancy,
          }),
          signal: AbortSignal.timeout(55_000),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          const errMsg = data?.error || `Ошибка сервера (${res.status})`;
          pushOpsError({
            source: "chat",
            message: errMsg,
            status: res.status,
            userSnippet: text.slice(0, 120),
          });
          throw new Error(errMsg);
        }

        const weatherSnap = decodeWeatherHeader(res.headers.get("X-Maya-Weather"));
        const wantWeatherWidget = isOutfitIntent(text);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Нет потока ответа");

        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          const { text: live } = stripSuggestMarker(full);
          updateMessage(assistantId, { content: live });
        }

        const parsed = stripSuggestMarker(full);
        const state = useAppStore.getState();

        const userMentionsDiaryFact = looksLikeDiaryFact(text);
        const fromAi = userMentionsDiaryFact ? [...(parsed.logEntries ?? [])] : [];
        const fromUser = userMentionsDiaryFact
          ? inferLogDraftsFromUserText(text)
          : [];
        // Текст мамы — главный источник (модель часто забывает LOG_ENTRY на рост/сон/смесь)
        let drafts = mergeDiaryDrafts(fromUser, fromAi);

        const loggedEntries: {
          moduleId: string;
          title: string;
          date: string;
          value: string;
          note: string;
        }[] = [];
        const charts = [...(parsed.showCharts ?? [])];

        for (const draft of drafts) {
          let moduleId = resolveDiaryId(
            draft.moduleId,
            state.customModules,
            state.enabledModules,
          );
          // Автоподключение встроенного дневника, если факт пришёл, а раздел выключен
          if (
            !moduleId &&
            draft.moduleId in MODULE_BY_ID &&
            !(state.enabledModules as string[]).includes(draft.moduleId)
          ) {
            useAppStore.getState().enableModule(draft.moduleId as ModuleId);
            moduleId = draft.moduleId;
          }
          if (!moduleId) continue;

          const custom = state.customModules.find((c) => c.id === moduleId);
          const builtin = MODULE_BY_ID[moduleId as ModuleId];
          const title = custom?.title || builtin?.title || "Дневник";

          let fields = draft.fields;
          let value = draft.value;
          if (custom?.fields?.length && fields) {
            const cleaned: Record<string, string | number> = {};
            for (const f of custom.fields) {
              if (fields[f.key] === undefined || fields[f.key] === "") continue;
              cleaned[f.key] =
                f.type === "number" ? Number(fields[f.key]) : fields[f.key];
            }
            fields = Object.keys(cleaned).length ? cleaned : undefined;
            if (fields) value = summarizeEntryFields(custom.fields, fields);
          }

          // Дата факта из слов мамы (иначе ИИ часто ставит «сегодня» на всё)
          let entryDate = draft.date || new Date().toISOString().slice(0, 10);
          const lower = text.toLowerCase();
          const shiftDays = (n: number) => {
            const d = new Date();
            d.setDate(d.getDate() + n);
            return d.toISOString().slice(0, 10);
          };
          if (/позавчера/.test(lower)) entryDate = shiftDays(-2);
          else if (/вчера/.test(lower)) entryDate = shiftDays(-1);
          else {
            const daysAgo = lower.match(/(\d+)\s*дн(я|ей|ь)\s*назад/);
            if (daysAgo) entryDate = shiftDays(-Number(daysAgo[1]));
          }

          addJournalEntry(moduleId, {
            date: entryDate,
            value,
            note: draft.note,
            fields,
          });

          loggedEntries.push({
            moduleId,
            title,
            date: entryDate,
            value,
            note: draft.note,
          });

          const chartKey = custom?.chartFieldKey;
          if (
            chartKey &&
            !charts.some((c) => c.moduleId === moduleId && c.fieldKey === chartKey)
          ) {
            charts.push({ moduleId, fieldKey: chartKey, months: 6 });
          }
        }

        // Тост «Записано» сверху экрана (анимация)
        if (loggedEntries.length) {
          const last = loggedEntries[loggedEntries.length - 1]!;
          const lastCustom = state.customModules.find((c) => c.id === last.moduleId);
          window.setTimeout(() => {
            setLogPreview({
              mode: "log",
              moduleId: last.moduleId,
              title: last.title,
              date: last.date,
              value: last.value,
              note: last.note,
              fieldKey: lastCustom?.chartFieldKey,
            });
          }, 80);
        }

        const offer =
          inferDiaryOffer(text, state.enabledModules, state.journals) ||
          (parsed.suggestedModuleId &&
          !state.enabledModules.includes(parsed.suggestedModuleId)
            ? {
                moduleId: parsed.suggestedModuleId,
                mode: "enable" as const,
                title: MODULE_BY_ID[parsed.suggestedModuleId]?.title || "Дневник",
                body: "Могу вести это в дневнике — будет удобно писать факты в чат.",
                cta: "Завести дневник",
              }
            : null);

        const wardrobePhotos = parsed.showWardrobeIds?.length
          ? parsed.showWardrobeIds
              .map((id) => {
                const item = state.wardrobe.find((w) => w.id === id);
                if (!item) return null;
                // Не показываем фото вещей, которые не лезут в текущую погоду
                if (weatherSnap && !wardrobeFitsWeather(item, weatherSnap)) {
                  return null;
                }
                return { id: item.id, name: item.name };
              })
              .filter((x): x is { id: string; name: string } => Boolean(x))
          : undefined;

        const hasWardrobePicks = Boolean(wardrobePhotos && wardrobePhotos.length > 0);
        const wardrobeCard =
          wantWeatherWidget
            ? hasWardrobePicks
              ? {
                  mode: "items" as const,
                  title: "Подборка из гардероба",
                  body: "Это вещи малыша, которые сейчас лучше всего подходят под погоду.",
                  cta: "Открыть гардероб",
                }
              : {
                  mode: "add" as const,
                  title: state.wardrobe.length
                    ? "В гардеробе пока нечего надеть на эту погоду"
                    : "Добавьте вещи в гардероб",
                  body: state.wardrobe.length
                    ? "Мая советует только из ваших фото. Сейчас подходящих нет — добавьте лёгкую одежду под жару или то, что реально носите."
                    : "Гардероб нужен, чтобы Мая не гадала «что надеть», а выбирала из реальных вещей малыша под погоду.",
                  cta: "Добавить в гардероб",
                }
            : undefined;

        const weatherForMsg: WeatherSnapshot | undefined =
          weatherSnap && (wantWeatherWidget || hasWardrobePicks)
            ? weatherSnap
            : undefined;

        updateMessage(assistantId, {
          content: parsed.text || "Не получилось сформировать ответ.",
          suggestedModuleId:
            parsed.suggestedModuleId &&
            !enabledModules.includes(parsed.suggestedModuleId)
              ? parsed.suggestedModuleId
              : undefined,
          createModulePrompt: parsed.createModulePrompt,
          createModuleTitle: parsed.createModuleTitle,
          evolveModule: parsed.evolveModule,
          showCharts: charts.length ? charts : undefined,
          loggedEntries: loggedEntries.length ? loggedEntries : undefined,
          diaryOffer: offer && !loggedEntries.some((e) => e.moduleId === offer.moduleId)
            ? offer
            : undefined,
          wardrobePhotos,
          wardrobeCard,
          weather: weatherForMsg,
        });
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Неизвестная ошибка";
        const msg =
          e instanceof Error &&
          (e.name === "TimeoutError" || /aborted|timeout/i.test(raw))
            ? "Мая не успела ответить — попробуйте ещё раз"
            : raw;
        refundAiChatQuota();
        pushOpsError({
          source: "chat",
          message: msg,
          userSnippet: text.slice(0, 120),
        });
        setError(msg);
        updateMessage(assistantId, {
          content: `Не удалось получить ответ: ${msg}`,
        });
      }
    });
  }

  function onEnable(id: ModuleId) {
    enableModule(id);
    const mod = MODULE_BY_ID[id];
    setLogPreview({
      mode: "created",
      moduleId: id,
      title: mod.title,
      fieldsHint: mod.description,
    });
    for (const m of useAppStore.getState().messages) {
      if (m.suggestedModuleId === id) {
        updateMessage(m.id, { suggestedModuleId: undefined });
      }
    }
  }

  async function onCreateCustom(
    messageId: string,
    prompt: string,
    titleHint?: string,
  ) {
    if (!isSubscriptionActive(useAppStore.getState().subscription)) {
      setError(
        "Создание своих дневников — в подписке. Готовые разделы (сон, ГВ, смеси…) бесплатны.",
      );
      router.push("/pricing");
      return;
    }
    setBusyId(messageId);
    setError(null);
    try {
      const res = await fetch("/api/design-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt, titleHint }),
      });
      const data = (await res.json()) as ModuleBlueprint & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось создать раздел");
      if (data.suggestBuiltin) {
        enableModule(data.suggestBuiltin as ModuleId);
        updateMessage(messageId, {
          createModulePrompt: undefined,
          createModuleTitle: undefined,
        });
        const title =
          MODULE_BY_ID[data.suggestBuiltin as ModuleId]?.title ||
          data.suggestBuiltin;
        setLogPreview({
          mode: "created",
          moduleId: data.suggestBuiltin,
          title,
          fieldsHint: "Готовый умный раздел",
        });
        addMessage({
          role: "assistant",
          content: `Открыла готовый раздел «${title}» — там уже есть умный инструмент, отдельно анкету создавать не нужно.`,
        });
        return;
      }
      if (titleHint) data.title = titleHint;
      const id = addCustomModuleFromBlueprint(data);
      updateMessage(messageId, {
        createModulePrompt: undefined,
        createModuleTitle: undefined,
      });
      const smartHint = data.smart
        ? `Умный блок: ${data.smart.title}`
        : undefined;
      const fieldHint = data.fields?.length
        ? `Поля: ${data.fields.map((f) => f.label).join(" · ")}`
        : undefined;
      setLogPreview({
        mode: "created",
        moduleId: id,
        title: data.title,
        fieldsHint: [smartHint, fieldHint].filter(Boolean).join(" · "),
      });
      addMessage({
        role: "assistant",
        content: `Готово — «${data.title}» создан${
          data.smart ? ` с блоком «${data.smart.title}»` : ""
        }. Можно писать сюда или открыть раздел.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка создания раздела";
      pushOpsError({ source: "design", message: msg, userSnippet: prompt.slice(0, 120) });
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function onEvolve(
    messageId: string,
    moduleId: string,
    instruction: string,
  ) {
    if (!isSubscriptionActive(useAppStore.getState().subscription)) {
      setError("Изменение дневников через ИИ — в подписке.");
      router.push("/pricing");
      return;
    }
    const mod = useAppStore.getState().customModules.find((m) => m.id === moduleId);
    if (!mod) {
      setError("Раздел не найден");
      return;
    }
    setBusyId(messageId);
    setError(null);
    try {
      const res = await fetch("/api/evolve-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: mod, instruction }),
      });
      const data = (await res.json()) as {
        blueprint?: ModuleBlueprint;
        changeSummary?: string;
        error?: string;
      };
      if (!res.ok || !data.blueprint) {
        throw new Error(data.error || "Не удалось изменить раздел");
      }
      updateCustomModuleFromBlueprint(moduleId, data.blueprint);
      updateMessage(messageId, { evolveModule: undefined });
      addMessage({
        role: "assistant",
        content: `Готово. ${data.changeSummary || "Теперь я это тоже запоминаю."}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка изменения";
      pushOpsError({
        source: "evolve",
        message: msg,
        userSnippet: instruction.slice(0, 120),
        detail: moduleId,
      });
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-3 pb-2 pt-2 md:px-4 md:pt-3">
        {/* Чат на высоту экрана — ниже лента, листайте вниз */}
        <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col md:min-h-[calc(100dvh-3.5rem)]">
          <div
            ref={chatPanelRef}
            className="maya-sketch-frame maya-chat-paper flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line shadow-sm backdrop-blur-xl"
          >
          <div
            ref={listRef}
            className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            <div className="shrink-0 space-y-2">
              <HomeWeatherCard
                coords={coords}
                geoPending={geoPending}
                compact={!empty}
                onRequestLocation={requestPhoneLocation}
                onVpnSuspect={setVpnSuspect}
              />
              <VpnHintBanner
                coords={coords}
                city={profile.city}
                forceShow={vpnSuspect}
              />
            </div>

            {empty && (
              <div className="relative m-auto max-w-md py-6 text-center maya-rise">
                <SketchBackdrop />
                <div className="relative z-[1]">
                  <SketchMaya className="mx-auto h-36 w-36 md:h-40 md:w-40" />
                  <p className="font-display mt-2 text-2xl font-medium tracking-tight text-foreground md:text-3xl">
                    Спросите как мама маме
                  </p>
                  <SketchDoodles className="mx-auto mt-4 h-12 w-full max-w-xs opacity-80" />
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {CHAT_PROMPTS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setInput(q.prompt)}
                        className="rounded-full border border-line bg-accent-soft/60 px-3.5 py-2 text-left text-xs font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/community"
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-accent/25 bg-accent-soft/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent/40"
                  >
                    <MayaIcon name="circle" size={18} className="text-accent" />
                    Общение — чат с другими в Мае
                  </Link>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  m.role === "user"
                    ? "maya-msg-user ml-auto max-w-[92%] bg-user-bubble text-foreground"
                    : `maya-msg-ai mr-auto text-foreground ${
                        m.loggedEntries?.length || m.diaryOffer
                          ? "w-full max-w-full"
                          : "max-w-[92%]"
                      }`
                }`}
              >
                {m.role === "assistant" && m.weather && (
                  <WeatherWidget
                    weather={m.weather}
                    compact
                    className="maya-msg-in mb-3"
                  />
                )}

                {m.role === "assistant" && m.wardrobeCard && (
                  <WardrobeChatCard
                    mode={m.wardrobeCard.mode}
                    title={m.wardrobeCard.title}
                    body={m.wardrobeCard.body}
                    cta={m.wardrobeCard.cta}
                    className="mb-3"
                  />
                )}

                {m.role === "assistant" && !m.content && pending ? (
                  <p className="maya-typing text-muted" aria-label="Печатает">
                    <span />
                    <span />
                    <span />
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}

                {m.wardrobePhotos && m.wardrobePhotos.length > 0 && (
                  <div className="maya-msg-in mt-3 flex flex-wrap gap-2">
                    {m.wardrobePhotos.map((item) => {
                      const live = wardrobe.find((w) => w.id === item.id);
                      const src = live?.imageData || item.imageData;
                      return (
                        <div
                          key={item.id}
                          className="w-[7.5rem] overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line/70 sm:w-36"
                        >
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={item.name}
                              className="aspect-[3/4] w-full object-cover"
                            />
                          ) : (
                            <div className="flex aspect-[3/4] items-center justify-center bg-accent-soft/50 text-xs text-muted">
                              нет фото
                            </div>
                          )}
                          <p className="truncate px-2 py-1.5 text-center text-[11px] font-medium text-foreground">
                            {live?.name || item.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {m.loggedEntries?.map((e, i) => {
                  const custom = customModules.find((c) => c.id === e.moduleId);
                  return (
                  <JournalEntryChip
                    key={`${e.moduleId}-${e.date}-${i}`}
                    title={e.title}
                    value={e.value}
                    icon={
                      MODULE_BY_ID[e.moduleId as ModuleId]?.icon ||
                      custom?.icon ||
                      "spark"
                    }
                    onClick={() => {
                      router.push(`/m/${e.moduleId}`);
                    }}
                  />
                  );
                })}

                {m.showCharts
                  ?.filter(
                    (c) =>
                      !m.loggedEntries?.some((e) => e.moduleId === c.moduleId),
                  )
                  .map((c) => (
                    <ChatChart
                      key={`${c.moduleId}-${c.fieldKey}-${c.months}`}
                      moduleId={c.moduleId}
                      fieldKey={c.fieldKey}
                      months={c.months}
                    />
                  ))}

                {m.diaryOffer && (
                  <div className="maya-diary-offer maya-diary-open maya-diary-open-on mt-3 overflow-hidden rounded-[1.25rem] border border-accent/35 bg-accent-soft/70 p-4 text-foreground">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      {m.diaryOffer.mode === "enable"
                        ? "Завести дневник"
                        : "Трекер готов"}
                    </p>
                    <p className="font-display mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <MayaIcon
                        name={MODULE_BY_ID[m.diaryOffer.moduleId].icon}
                        size={18}
                      />
                      {m.diaryOffer.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">
                      {m.diaryOffer.body}
                    </p>
                    {m.diaryOffer.mode === "enable" ? (
                      <button
                        type="button"
                        onClick={() => {
                          onEnable(m.diaryOffer!.moduleId);
                          updateMessage(m.id, { diaryOffer: undefined });
                          router.push(`/m/${m.diaryOffer!.moduleId}`);
                        }}
                        className="mt-3 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#ffffff]"
                      >
                        {m.diaryOffer.cta}
                      </button>
                    ) : (
                      <Link
                        href={`/m/${m.diaryOffer.moduleId}`}
                        className="mt-3 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#ffffff]"
                      >
                        {m.diaryOffer.cta}
                      </Link>
                    )}
                  </div>
                )}

                {m.suggestedModuleId && !m.diaryOffer && (
                  <div className="maya-diary-offer maya-diary-open maya-diary-open-on mt-3 rounded-[1.25rem] border border-accent/30 bg-accent-soft p-4 text-foreground">
                    <p className="text-xs text-muted">Могу вести это в дневнике</p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      <MayaIcon
                        name={MODULE_BY_ID[m.suggestedModuleId].icon}
                        size={16}
                      />
                      {MODULE_BY_ID[m.suggestedModuleId].title}
                    </p>
                    <button
                      type="button"
                      onClick={() => onEnable(m.suggestedModuleId!)}
                      className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#ffffff]"
                    >
                      Завести
                    </button>
                  </div>
                )}

                {m.createModulePrompt && (
                  <div className="maya-msg-in mt-3 rounded-xl bg-accent-soft p-3 text-foreground">
                    <p className="text-xs text-muted">
                      {m.createModuleTitle
                        ? `Создать «${m.createModuleTitle}»?`
                        : "Создать?"}
                    </p>
                    <p className="mt-1 text-sm">{m.createModulePrompt}</p>
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() =>
                        void onCreateCustom(
                          m.id,
                          m.createModuleTitle
                            ? `${m.createModuleTitle}: ${m.createModulePrompt}`
                            : m.createModulePrompt!,
                          m.createModuleTitle,
                        )
                      }
                      className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#ffffff] disabled:opacity-50"
                    >
                      {busyId === m.id
                        ? "Создаю…"
                        : m.createModuleTitle
                          ? `Создать «${m.createModuleTitle}»`
                          : "Создать"}
                    </button>
                  </div>
                )}

                {m.evolveModule && (
                  <div className="maya-msg-in mt-3 rounded-xl bg-accent-soft p-3 text-foreground">
                    <p className="text-xs text-muted">Изменить?</p>
                    <p className="mt-1 font-medium">{m.evolveModule.instruction}</p>
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() =>
                        void onEvolve(
                          m.id,
                          m.evolveModule!.moduleId,
                          m.evolveModule!.instruction,
                        )
                      }
                      className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#ffffff] disabled:opacity-50"
                    >
                      {busyId === m.id ? "Обновляю…" : "Изменить"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="mx-4 mb-2 shrink-0 rounded-xl border border-blush/40 bg-blush-soft px-3 py-2 text-sm">
              {error}
              {!premium && chatLeft === 0 && (
                <>
                  {" "}
                  <Link href="/pricing" className="font-semibold underline">
                    Подписка
                  </Link>
                </>
              )}
            </p>
          )}

          {!premium && chatLeft != null && (
            <p className="mx-4 mb-1.5 shrink-0 text-[11px] text-muted">
              Бесплатно сегодня:{" "}
              <span className="font-medium text-foreground">
                {chatLeft} из {FREE_CHAT_LIMIT}
              </span>
              {" · "}
              <Link href="/pricing" className="text-accent underline">
                безлимит
              </Link>
            </p>
          )}

          <form
            className="flex shrink-0 gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (listening) recognitionRef.current?.stop();
              void send();
            }}
          >
            <div className="relative flex min-w-0 flex-1 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  listening ? "Слушаю…" : "Напишите или скажите Мае…"
                }
                className="w-full rounded-2xl border border-line bg-background py-3.5 pl-4 pr-12 text-[15px] text-foreground outline-none transition placeholder:text-muted/80 focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(50,215,175,0.22)]"
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={() => toggleVoice()}
                  disabled={pending}
                  aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
                  aria-pressed={listening}
                  className={`absolute right-2 flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-50 ${
                    listening
                      ? "maya-mic-live bg-accent text-[#ffffff]"
                      : "text-muted hover:bg-accent-soft hover:text-accent-hot"
                  }`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3Z" />
                    <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-[#ffffff] transition enabled:hover:bg-accent-hot disabled:opacity-40"
            >
              {pending ? "…" : "Отправить"}
            </button>
          </form>
        </div>
        </div>

        <div className="mt-2 space-y-5 pb-4">
          {/* Кухня — отдельно по цвету от ленты малыша */}
          <section
            className="rounded-[1.5rem] border border-amber-500/25 bg-gradient-to-br from-amber-50/90 via-[#fff8ee] to-orange-50/50 px-3.5 py-4 dark:border-amber-400/20 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20"
            aria-label="На кухне"
          >
            <div className="mb-3 flex items-end justify-between gap-2 px-0.5">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                  На кухне
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Рецепт дня, потом — шум для сна
                </p>
              </div>
              <Link
                href="/recipes"
                className="shrink-0 text-xs font-semibold text-amber-800 underline decoration-amber-500/40 underline-offset-2 dark:text-amber-200"
              >
                Все →
              </Link>
            </div>
            <KitchenCarousel />
          </section>

          <ChatNewsFeed
            onOpenChat={(prefill) => {
              if (prefill) setInput(prefill);
              chatPanelRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
              window.setTimeout(() => inputRef.current?.focus(), 350);
            }}
          />
        </div>
      </div>

      {logPreview && (
        <LogPreviewSheet
          key={`${logPreview.mode}-${logPreview.moduleId}-${logPreview.value}-${logPreview.date}`}
          data={logPreview}
          onClose={() => setLogPreview(null)}
        />
      )}
    </div>
  );
}
