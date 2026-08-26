import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppShell } from "@/components/AppShell";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

/** Не кэшировать HTML-оболочку на год — иначе вечный «Мая…» после старого билда */
export const dynamic = "force-dynamic";

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
      <body className="h-full overflow-hidden bg-background font-sans text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search||"";var force=q.indexOf("fix=1")>=0;try{if(sessionStorage.getItem("maya-crash")==="1")force=true;}catch(e0){}if(force){try{localStorage.removeItem("maya-mom-ai");localStorage.removeItem("maya-theme");localStorage.removeItem("maya-identity-v1");localStorage.removeItem("maya-onboarding-progress-v1");localStorage.removeItem("maya-onboarded-v1");}catch(e1){}try{sessionStorage.removeItem("maya-crash");}catch(e2){}try{document.cookie="maya_id=; path=/; max-age=0; SameSite=Lax";}catch(e3){}if(q.indexOf("fix=1")>=0){try{history.replaceState(null,"",location.pathname+(location.hash||""));}catch(e4){}}}var k="maya-mom-ai";var r=localStorage.getItem(k);if(r){if(r.length>500000){try{localStorage.removeItem(k);}catch(e5){}}else{try{JSON.parse(r);}catch(e6){try{localStorage.removeItem(k);}catch(e7){}}}}var t=localStorage.getItem("maya-theme");if(t!=="dark"&&t!=="blush")t="blush";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","blush");}})();`,
          }}
        />
        <AppErrorBoundary>
          <AppShell>{children}</AppShell>
        </AppErrorBoundary>
        <PwaRegister />
      </body>
    </html>
  );
}
