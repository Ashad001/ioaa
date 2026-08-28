import "server-only";

const BROWSER_PATH = "/usr/bin/chromium-browser";
const SITE_TIMEOUT_MS = 30_000;
const SITE_SETTLE_MS = 2_000;

/**
 * Reads the page a visitor actually sees when a plain website response contains
 * only the application shell. This is a fallback, never the first request.
 */
export async function readRenderedSite(url: string): Promise<string | null> {
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      executablePath: BROWSER_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    try {
      const context = await browser.newContext({
        locale: "en-US",
        viewport: { width: 1440, height: 1100 },
        serviceWorkers: "block",
      });

      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: SITE_TIMEOUT_MS });
        await page.waitForTimeout(SITE_SETTLE_MS);
        return (await page.content()).slice(0, 900_000);
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}
