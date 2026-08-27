import type { MetadataRoute } from "next";

const SITE = "https://hey-maya.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/recipes`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE}/legal`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/legal/offer`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/legal/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
