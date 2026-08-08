import OpenAI from "openai";

/** Клиент OpenAI / ProxyAPI (один ключ на все роуты) */
export function createOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseURL =
    process.env.OPENAI_BASE_URL?.trim() ||
    // ProxyAPI по умолчанию — работает из РФ без VPN
    "https://api.proxyapi.ru/openai/v1";

  return new OpenAI({
    apiKey,
    baseURL,
  });
}

export function chatModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

/** Создание/эволюция дневников — реже, но нужна голова */
export function designModel() {
  return (
    process.env.OPENAI_DESIGN_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1"
  );
}

export function visionModel() {
  return (
    process.env.OPENAI_VISION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1-mini"
  );
}
