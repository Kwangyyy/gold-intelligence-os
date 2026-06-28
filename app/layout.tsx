import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { ModeProvider } from "@/lib/mode";
import { TierProvider } from "@/lib/tier";
import { ShellLayout } from "@/components/ShellLayout";
import { TierGuard } from "@/components/TierGuard";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Gold Intelligence OS — XAUUSD Market Overview",
  description:
    "AI Trading Intelligence Platform for XAUUSD by EA Profit Lab. Real-time gold market overview, AI recommendation, market score, volatility and news risk.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gold Intelligence OS",
  },
  icons: {
    apple: "/api/pwa-icon?size=192",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5c451",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GIOS" />
        <link rel="apple-touch-icon" href="/api/pwa-icon?size=192" />
      </head>
      <body className="font-sans antialiased">
        <SwRegister />
        <LanguageProvider>
          <ModeProvider>
            <TierProvider>
              <ShellLayout>
                <TierGuard>{children}</TierGuard>
              </ShellLayout>
            </TierProvider>
          </ModeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
