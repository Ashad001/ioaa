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
      "AdMirror maps live paid-social creative from the public Meta Ad Library, ranks the observed signals honestly, and turns the angle you choose into original ad variants and a test plan.",
    openGraph: {
      title: "AdMirror — their best angle, your ad",
      description:
        "AdMirror maps live paid-social creative from the public Ad Library, ranks observed signals honestly, and turns the angle you choose into your own variants.",
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
