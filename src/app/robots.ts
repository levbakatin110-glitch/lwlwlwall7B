import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/register"],
      },
    ],
    sitemap: "https://hey-maya.ru/sitemap.xml",
    host: "https://hey-maya.ru",
  };
}
