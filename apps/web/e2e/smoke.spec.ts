import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@atome.studio";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

async function login(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

test.describe("Atome Studio smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.state).toMatch(/ok|degraded/);
    expect(Array.isArray(body.services)).toBeTruthy();
  });

  test("login API sets at cookie", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const setCookie = res.headers()["set-cookie"];
    expect(setCookie).toMatch(/at=/);
  });

  test("CSRF blocks POST without token", async ({ request }) => {
    // Login first to obtain at + csrf cookies in playwright's cookie jar
    await request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const res = await request.post(`${BASE}/api/autonomy/sessions/TEST/pause`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });

  test("scanner paths are dropped on https edge", async ({ request }) => {
    const edge = process.env.EDGE_URL ?? "https://atome-farm.duckdns.org";
    try {
      const res = await request.get(`${edge}/owa/auth/x.js`, {
        maxRedirects: 0,
        timeout: 5_000,
        ignoreHTTPSErrors: true,
      });
      expect(res.status()).not.toBe(200);
    } catch (e) {
      expect((e as Error).message).toMatch(/socket|ECONNRESET|abort|closed|hang/i);
    }
  });

  test("galaxy loads + login + shortcuts + palette (combined)", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/atome|Atome/i);

    await login(page);

    // shortcut g+p → /phones
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(150);
    await page.keyboard.press("g");
    await page.waitForTimeout(120);
    await page.keyboard.press("p");
    await page.waitForURL(/\/phones/, { timeout: 8_000 });

    // command palette Ctrl+K
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+KeyK");
    await expect(page.getByPlaceholder("Type a command…")).toBeVisible({ timeout: 5_000 });
  });
});
