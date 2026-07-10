import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Beanlo — newborn tracker",
  description:
    "Track nappies, feeds and weight in the first days and weeks. A tracking aid, not medical advice.",
  appleWebApp: {
    capable: true,
    title: "beanlo",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#EDE9E1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // draw into the iPhone safe areas; insets handled in CSS
};

// Keeps the status-bar colour in step with the theme, and — for anyone whose
// preference is still only in localStorage (set before the cookie existed) —
// migrates it to the cookie so the server renders the right palette next time.
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=(dark|light|system)/);var p=m?m[1]:localStorage.getItem('theme');if(!m&&(p==='dark'||p==='light'||p==='system')){document.cookie='theme='+p+'; path=/; max-age=31536000; samesite=lax';if(p==='dark'||p==='light')document.documentElement.setAttribute('data-theme',p);}var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute('content',d?'#16140f':'#ede9e1');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-render the saved theme so the correct palette is present on first
  // paint — no flash and no dependency on a client script running in time.
  const pref = (await cookies()).get("theme")?.value;
  const dataTheme = pref === "dark" || pref === "light" ? pref : undefined;

  return (
    <html
      lang="en"
      className={`${schibsted.variable} h-full antialiased`}
      data-theme={dataTheme}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
