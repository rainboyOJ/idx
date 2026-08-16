import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { PAGE_URL, BASELINE_DIR } from "../playwright.config.mjs";

const SHOTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
  { name: "wide", width: 1920, height: 1080 },
];

const EXPECTED_COLUMNS = {
  phone: 1,
  tablet: 2,
  desktop: [3, 4],
  wide: [4, 5],
};

test("capture baseline screenshots and verify responsive structure", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-light");
  await page.addInitScript(() => localStorage.removeItem("rainboy-nav-theme"));

  for (const shot of SHOTS) {
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width: shot.width, height: shot.height });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(PAGE_URL);
      await page.waitForTimeout(300);

      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box ? { y: Math.round(box.y), height: Math.round(box.height) } : null;
        };
        const grid = document.querySelector(".link-grid");
        const first = grid?.firstElementChild?.getBoundingClientRect();
        let columns = 1;
        if (first) {
          for (let i = 1; i < grid.children.length; i += 1) {
            const box = grid.children[i].getBoundingClientRect();
            if (box.y === first.y) columns += 1;
            else break;
          }
        }
        const card = document.querySelector(".link-card")?.getBoundingClientRect();
        return {
          hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          workbar: rect(".workbar"),
          sidebar: rect(".category-sidebar"),
          columns,
          cardHeight: card ? Math.round(card.height) : 0,
          gradientBackground:
            getComputedStyle(document.body).backgroundImage !== "none",
          cardShadow: getComputedStyle(document.querySelector(".link-card")).boxShadow,
        };
      });

      expect(layout.hScroll).toBe(0);
      expect(layout.gradientBackground).toBe(false);
      expect(layout.cardShadow).toBe("none");
      if (shot.width >= 1024) {
        expect(layout.workbar.height).toBe(64);
        expect(layout.columns).toBeGreaterThanOrEqual(3);
        expect(layout.columns).toBeLessThanOrEqual(5);
      } else if (shot.width >= 720) {
        expect(layout.columns).toBe(2);
      } else {
        expect(layout.columns).toBe(1);
        expect(layout.workbar.height).toBe(120);
      }
      const expectedColumns = EXPECTED_COLUMNS[shot.name];
      if (Array.isArray(expectedColumns)) {
        expect(expectedColumns).toContain(layout.columns);
      } else {
        expect(layout.columns).toBe(expectedColumns);
      }
      expect(layout.cardHeight).toBeGreaterThanOrEqual(76);
      expect(layout.cardHeight).toBeLessThanOrEqual(84);

      mkdirSync(BASELINE_DIR, { recursive: true });
      await page.screenshot({
        path: join(BASELINE_DIR, `${shot.name}-${theme}.png`),
        fullPage: true,
      });
    }
  }
});
