import { chromium } from "playwright";

const W = Number(process.argv[2] ?? 1858);
const H = Number(process.argv[3] ?? 1027);
const TAG = process.argv[4] ?? "w";

const dir = "C:/Users/octav/AppData/Local/Temp/claude/C--Users-octav-Documents-precis-case/d2ea2e46-9f41-4f87-b031-f44d50f7d8b0/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));

await page.goto("http://localhost:3000/map", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${dir}/${TAG}-0empty.png` });

await page.getByRole("button", { name: /Map the category/i }).click();
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(1000);
  if (await page.evaluate(() => /ON THIS ANGLE/.test(document.body.innerText))) break;
}
await page.waitForTimeout(2000);

// hover a tile, then select three of them, so the tooltip and the tray are both on screen
const tiles = page.locator("[data-tile]");
const n = await tiles.count();
await tiles.nth(Math.min(6, n - 1)).hover();
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/${TAG}-1hover.png` });

for (const i of [3, 30, 64]) if (i < n) await tiles.nth(i).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${dir}/${TAG}-2top.png` });

await page.evaluate(() => window.scrollTo(0, 820));
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/${TAG}-3mid.png` });

await page.evaluate(() => window.scrollTo(0, 1700));
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/${TAG}-4low.png` });

const over = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}));
console.log("overflow:", JSON.stringify(over), "errors:", JSON.stringify(errs.slice(0, 6)));
await browser.close();
