import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hearth — newborn tracker",
  description:
    "Track nappies, feeds and weight in the first days and weeks. A tracking aid, not medical advice.",
  appleWebApp: {
    capable: true,
    title: "hearth",
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

// Runs before first paint: applies the saved theme (and matching status-bar
// colour) so there's no flash of the wrong palette on load.
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('theme');if(p==='dark'||p==='light')document.documentElement.setAttribute('data-theme',p);var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',d?'#16140f':'#ede9e1');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${schibsted.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
