import OpenAI from "openai";

const PROXY_OPENAI = "https://api.proxyapi.ru/openai/v1";
const PROXY_OPENROUTER = "https://api.proxyapi.ru/openrouter/v1";

/** Клиент OpenAI / ProxyAPI (vision, design и пр.) */
export function createOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseURL = process.env.OPENAI_BASE_URL?.trim() || PROXY_OPENAI;

  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 45_000,
    maxRetries: 1,
  });
}

/**
 * Чат Маи. DeepSeek у ProxyAPI — через OpenRouter
 * (https://api.proxyapi.ru/openrouter/v1), не через /openai/v1.
 */
export function createChatOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = chatModel();
  const baseURL =
    process.env.OPENAI_CHAT_BASE_URL?.trim() ||
    (isOpenRouterModel(model)
      ? PROXY_OPENROUTER
      : process.env.OPENAI_BASE_URL?.trim() || PROXY_OPENAI);

  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 45_000,
    maxRetries: 1,
  });
}

/** deepseek/… и другие slug'и OpenRouter */
function isOpenRouterModel(model: string) {
  return model.includes("/");
}

/** Чат с Маей — по умолчанию DeepSeek (дешевле gpt-4.1-mini) */
export function chatModel() {
  return (
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "deepseek/deepseek-chat-v3.1"
  );
}

/** Создание/эволюция дневников — реже, но нужна голова */
export function designModel() {
  return process.env.OPENAI_DESIGN_MODEL?.trim() || "gpt-4.1";
}

export function visionModel() {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4.1-mini";
}
