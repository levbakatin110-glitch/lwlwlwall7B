import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Скрыть английскую панель разработчика поверх сайта
  devIndicators: false,
  // Удобнее выкладывать на VPS / Node-хостинг
  output: "standalone",
  async redirects() {
    return [
      { source: "/legal", destination: "/документы", permanent: true },
      {
        source: "/legal/offer",
        destination: "/документы/публичная-оферта",
        permanent: true,
      },
      {
        source: "/legal/privacy",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
      // старые лишние согласия → политика
      {
        source: "/legal/consent-pd",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
      {
        source: "/legal/consent-marketing",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
      {
        source: "/legal/consent-reviews",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
      {
        source: "/документы/согласие-обработка-пдн",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
      {
        source: "/документы/согласие-рассылка",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
      {
        source: "/документы/согласие-отзывы",
        destination: "/документы/политика-персональных-данных",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
