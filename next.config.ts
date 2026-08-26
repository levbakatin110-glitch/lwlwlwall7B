import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Скрыть английскую панель разработчика поверх сайта
  devIndicators: false,
  // Не standalone: на VPS pm2 запускает `next start` (см. pm2 logs).
  // standalone ломает next start → 500 / required-server-files.json
  experimental: {
    // меньше шума от кривых POST (сканеры шлют Next-Action: x)
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
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
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
