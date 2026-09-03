import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Явно прокидываем DSN в клиентский бандл при сборке на VPS
  env: {
    NEXT_PUBLIC_BETTERSTACK_DSN: process.env.NEXT_PUBLIC_BETTERSTACK_DSN ?? "",
  },
  // Скрыть английскую панель разработчика поверх сайта
  devIndicators: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  // Не standalone: на VPS pm2 запускает `next start` (см. pm2 logs).
  // standalone ломает next start → 500 / required-server-files.json
  experimental: {
    optimizePackageImports: ["@sentry/browser"],
    // кружки/видео в community и прочие формы
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  serverExternalPackages: ["pdfkit", "web-push"],
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
        source: "/((?!_next/|icons/|avatars/|banners/|sw\\.js).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache",
          },
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
