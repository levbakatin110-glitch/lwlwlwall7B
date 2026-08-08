import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Скрыть английскую панель разработчика поверх сайта
  devIndicators: false,
  // Удобнее выкладывать на VPS / Node-хостинг
  output: "standalone",
};

export default nextConfig;
