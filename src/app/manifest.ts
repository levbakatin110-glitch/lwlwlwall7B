import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Мая",
    short_name: "Мая",
    description:
      "ИИ для мам: рост, кормление, сон и режим ребёнка — не просто записи.",
    // Без query — тот же origin/хранилище, что у вкладки в браузере
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    background_color: "#fff6f8",
    theme_color: "#fff6f8",
    lang: "ru",
    dir: "ltr",
    orientation: "portrait-primary",
    categories: ["lifestyle", "health", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
