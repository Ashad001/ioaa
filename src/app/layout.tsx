import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/archivo";
import "@fontsource-variable/martian-mono";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await siteUrl()),
    title: {
      default: "AdMirror — their best angle, your ad",
      template: "%s · AdMirror",
    },
    description:
      "AdMirror reads your market's live ads off the public Meta Ad Library, lays them out as a contact sheet, ranks them honestly against what it actually collected, and turns the angle you circle into three original ad variants and a test plan.",
    openGraph: {
      title: "AdMirror — their best angle, your ad",
      description:
        "AdMirror reads your market's live ads from the public Ad Library, ranks them honestly against what was actually collected, and turns the angle you pick into your own variants.",
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="bottom-right" />
        {/* Imagine Make preview runtime — only active when framed by the editor. */}
        <Script
          src="https://cdn-chatly.vyro.ai/chatly-make/sites-script/make-preview-runtime.js"
          strategy="afterInteractive"
        />
        {/* Imagine preview heading override — only active when framed. */}
        <Script
          src="https://cdn-chatly.vyro.ai/chatly-make/sites-script/heading-override.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
