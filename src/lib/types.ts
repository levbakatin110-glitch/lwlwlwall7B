export type Sex = "girl" | "boy" | "unknown";

export type ChildProfile = {
  id: string;
  name: string;
  /** Имя ещё не выбрали — зовём «малыш» */
  namePending?: boolean;
  /** data URL сжатого фото */
  photoData?: string;
  birthDate: string;
  sex: Sex;
  city: string;
  allergies: string;
  notes: string;
  /** Рост при рождении, см */
  birthHeightCm?: number;
  /** Вес при рождении, кг */
  birthWeightKg?: number;
};

export type WardrobeItem = {
  id: string;
  name: string;
  type: string;
  season: string;
  note: string;
  imageData?: string;
  /** Фото бирки / ярлыка (опционально) */
  labelImageData?: string;
  tempMinC?: number;
  tempMaxC?: number;
  /** Кто задал температуру: мама или оценка ИИ */
  tempSource?: "user" | "ai";
  weatherTags?: string[];
  aiDescription?: string;
  analyzed?: boolean;
};

export type MemoryItem = {
  id: string;
  date: string;
  text: string;
  photoUrl: string;
};

/** ИИ-монтаж: одно «фильм-воспоминание» из всех моментов */
export type MemoryStoryScene = {
  memoryId: string;
  /** «Месяц назад», «На прошлой неделе» */
  whenLabel: string;
  headline: string;
  line: string;
};

export type MemoryStory = {
  title: string;
  subtitle: string;
  intro: string;
  scenes: MemoryStoryScene[];
  outro: string;
  createdAt: string;
};

export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export type ModuleField = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
};

/** Умный блок своего дневника */
export type SmartPanelKind =
  | "milestones"
  | "goal"
  | "tips"
  | "scale"
  | "streak"
  | "timer";

export type SmartPanel = {
  kind: SmartPanelKind;
  title: string;
  subtitle?: string;
  milestones?: { id: string; label: string; hint?: string }[];
  goalLabel?: string;
  goalTarget?: number;
  goalUnit?: string;
  goalFieldKey?: string;
  tips?: string[];
  quickAdds?: { label: string; prefill: string }[];
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  scaleFieldKey?: string;
  streakLabel?: string;
  /** для timer — подпись кнопки / что логируем */
  timerLabel?: string;
  timerUnit?: string;
};

/** Чертёж модуля от ИИ */
export type ModuleBlueprint = {
  title: string;
  description: string;
  icon: string;
  fields: ModuleField[];
  chartFieldKey?: string;
  smart?: SmartPanel;
  /** id готового раздела: diet | sleep | growth … */
  suggestBuiltin?: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  /** Когда реально внесли (чтобы несколько записей в один день не слипались) */
  createdAt?: string;
  /** Краткая строка для списка и для ИИ */
  value: string;
  note: string;
  /** Значения полей схемы */
  fields?: Record<string, string | number>;
};

export type CoreNavId = "chat" | "profile" | "wardrobe" | "memories" | "modules";

export type WeatherSnapshot = {
  city: string;
  temperatureC: number;
  feelsLikeC: number;
  precipitationMm: number;
  windKmh: number;
  description: string;
  fetchedAt: string;
  /** Код Open-Meteo для иконки виджета */
  weatherCode: number;
  tempMaxC?: number;
  tempMinC?: number;
  /** Ночь по локальному времени станции */
  isNight?: boolean;
  /** IANA-пояс станции Open-Meteo (точный для GPS) */
  timeZone?: string;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  suggestedModuleId?: ModuleId;
  /** Описание / бриф для дизайна раздела */
  createModulePrompt?: string;
  /** Короткое имя раздела для кнопки («Футбол») */
  createModuleTitle?: string;
  /** Изменить существующий свой раздел */
  evolveModule?: { moduleId: string; instruction: string };
  /** Графики из данных в чате */
  showCharts?: { moduleId: string; fieldKey: string; months?: number }[];
  /** Записи, которые Мая внесла в дневник прямо из чата */
  loggedEntries?: {
    moduleId: string;
    title: string;
    date: string;
    value: string;
    note: string;
  }[];
  /** Предложение завести / открыть дневник с трекером */
  diaryOffer?: {
    moduleId: ModuleId;
    mode: "enable" | "open";
    title: string;
    body: string;
    cta: string;
  };
  /** Вещи из гардероба, которые Мая показала в совете «что надеть» */
  wardrobePhotos?: {
    id: string;
    name: string;
    imageData?: string;
  }[];
  /** Снимок погоды для iOS-виджета в чате */
  weather?: WeatherSnapshot;
};

export type ModuleId =
  | "growth"
  | "breastfeeding"
  | "formula"
  | "solids"
  | "sleep"
  | "vaccines"
  | "health"
  | "diet"
  | "water"
  | "walk"
  | "diaper"
  | "notes"
  | "pregnancy"
  | "contractions"
  | "kicks"
  | "preg_weight"
  | "preg_pressure"
  | "preg_symptoms"
  | "preg_visits"
  | "preg_belly";

export type AnyModuleId = ModuleId | (string & {});

export type CustomModule = {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** для старых модулей без схемы */
  valueLabel: string;
  valuePlaceholder: string;
  fields?: ModuleField[];
  chartFieldKey?: string;
  smart?: SmartPanel;
  /** Последние замечания валидатора (для админки) */
  healthIssues?: string[];
  lastRepairedAt?: string;
};

export type ClothingAnalysis = {
  name: string;
  type: string;
  season: string;
  tempMinC: number;
  tempMaxC: number;
  weatherTags: string[];
  aiDescription: string;
};
