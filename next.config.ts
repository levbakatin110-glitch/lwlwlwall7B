import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Скрыть английскую панель разработчика поверх сайта
  devIndicators: false,
  // Удобнее выкладывать на VPS / Node-хостинг
  output: "standalone",
  async redirects() {
    return [
      // Кириллические URL → ASCII (Next.js ломает static export на /документы)
      { source: "/документы", destination: "/legal", permanent: true },
      {
        source: "/документы/публичная-оферта",
        destination: "/legal/offer",
        permanent: true,
      },
      {
        source: "/документы/политика-персональных-данных",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/документы/согласие-обработка-пдн",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/документы/согласие-рассылка",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/документы/согласие-отзывы",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/legal/consent-pd",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/legal/consent-marketing",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/legal/consent-reviews",
        destination: "/legal/privacy",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
