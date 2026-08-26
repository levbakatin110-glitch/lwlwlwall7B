import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
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
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="maya-mom-ai";var r=localStorage.getItem(k);if(r&&r.length>700000){try{var o=JSON.parse(r);var s=o.state;if(s){delete s.journals;delete s.messages;delete s.wardrobe;delete s.memories;delete s.memoryStory;delete s.profile;delete s.enabledModules;delete s.customModules;delete s.demoWardrobeSeeded;function cut(u){return typeof u==="string"&&u.indexOf("data:")===0&&u.length>24000?undefined:u;}if(s.children){for(var i=0;i<s.children.length;i++){var p=cut(s.children[i].photoData);if(p===undefined)delete s.children[i].photoData;else s.children[i].photoData=p;}}if(s.childSpaces){for(var id in s.childSpaces){var sp=s.childSpaces[id];if(!sp)continue;if(sp.messages)sp.messages=sp.messages.slice(-30);if(sp.wardrobe){sp.wardrobe=sp.wardrobe.slice(0,20);for(var j=0;j<sp.wardrobe.length;j++){var w=sp.wardrobe[j];var im=cut(w.imageData);if(im===undefined)delete w.imageData;else w.imageData=im;}}if(sp.memories){sp.memories=sp.memories.slice(0,15);for(var m=0;m<sp.memories.length;m++){var mm=sp.memories[m];var mi=cut(mm.imageData);if(mi===undefined)delete mm.imageData;else mm.imageData=mi;}}}}localStorage.setItem(k,JSON.stringify(o));}catch(e2){try{localStorage.removeItem(k);}catch(e3){}}}var t=localStorage.getItem("maya-theme");if(t!=="dark"&&t!=="blush")t="blush";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","blush");}})();`,
          }}
        />
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
