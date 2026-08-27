import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/jetbrains-mono";
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
      "AdMirror researches your brand and its competitors, hands you ready-made public Meta Ad Library searches, ranks the evidence you submit, and turns the angle you pick into three original ad variants and a test plan.",
    openGraph: {
      title: "AdMirror — their best angle, your ad",
      description:
        "Capture competitor ads from the public Ad Library, rank them honestly against what you actually captured, and generate your own variants on the same angle.",
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
