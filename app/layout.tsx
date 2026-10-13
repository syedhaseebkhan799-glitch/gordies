import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { PresenceProvider } from "@/lib/presence";
import OfflineBanner from "@/components/OfflineBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gordies",
  description: "Chat app for Gordon College friends",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Runs before the page paints, so the saved theme shows with no white flash.
const themeScript = `(function(){try{
var s=JSON.parse(localStorage.getItem('gordies-theme')||'{}');
var A={blue:'#2563eb',green:'#16a34a',purple:'#7c3aed',red:'#dc2626',orange:'#ea580c',pink:'#db2777'};
var m=s.mode||'system',r=document.documentElement;
r.dataset.theme=m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;
r.dataset.wallpaper=s.wallpaper||'dots';r.dataset.bubble=s.bubble||'round';
r.style.setProperty('--accent',A[s.accent]||A.blue);
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">
        <ThemeProvider>
          <AuthProvider>
            <PresenceProvider>
              <div className="mx-auto flex h-full max-w-2xl flex-col bg-bg sm:border-x sm:border-line">
                <OfflineBanner />
                <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
              </div>
            </PresenceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
