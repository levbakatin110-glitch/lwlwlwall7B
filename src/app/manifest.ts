import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Мая — помощница для мам",
    short_name: "Мая",
    description:
      "ИИ-помощница: сон, кормление, рост, гардероб и советы что надеть малышу.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#32d7af",
    lang: "ru",
    orientation: "portrait-primary",
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
