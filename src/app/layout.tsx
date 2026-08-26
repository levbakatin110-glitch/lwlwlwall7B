import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Мая — ИИ-помощница для мам",
  description:
    "Помнит сон, кормление, рост и гардероб малыша. Подсказывает что надеть и становится умнее о вашей семье каждый день.",
  applicationName: "Мая",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Мая",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#fff6f8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("maya-theme");if(t!=="dark"&&t!=="blush"){t="blush";var r=localStorage.getItem("maya-mom-ai");if(r&&r.length<500000){var s=JSON.parse(r).state;if(s&&(s.theme==="dark"||s.theme==="blush"))t=s.theme;}}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","blush");}})();`,
          }}
        />
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
