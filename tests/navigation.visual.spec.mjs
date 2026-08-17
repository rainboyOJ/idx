import { test, expect } from "@playwright/test";
import { PAGE_URL } from "../playwright.config.mjs";

const SHOTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
  { name: "wide", width: 1920, height: 1080 },
];

const EXPECTED_COLUMNS = {
  phone: 1,
  tablet: 2,
  desktop: 4,
  wide: 5,
};

async function loadStablePage(page, shot, theme) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(PAGE_URL);
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) image.loading = "eager";
  });
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images, (image) =>
        typeof image.decode === "function" ? image.decode().catch(() => {}) : Promise.resolve(),
      ),
    );
  });
}

test("compare baseline screenshots and verify responsive structure", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-light");
  test.setTimeout(120000);
  await page.addInitScript(() => localStorage.removeItem("rainboy-nav-theme"));

  for (const shot of SHOTS) {
    for (const theme of ["light", "dark"]) {
      await loadStablePage(page, shot, theme);

      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box
            ? {
                x: Math.round(box.x),
                y: Math.round(box.y),
                width: Math.round(box.width),
                height: Math.round(box.height),
              }
            : null;
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
          workbarInner: rect(".workbar-inner"),
          brand: rect(".brand"),
          search: rect(".workbar-search"),
          sidebar: rect(".category-sidebar"),
          directory: rect(".directory"),
          iconFrame: rect(".link-icon-frame"),
          columns,
          cardHeight: card ? Math.round(card.height) : 0,
          categoryIcons: document.querySelectorAll(".category-icon, .section-icon").length,
          gradientBackground:
            getComputedStyle(document.body).backgroundImage !== "none",
          cardShadow: getComputedStyle(document.querySelector(".link-card")).boxShadow,
          cardBackdrop: getComputedStyle(document.querySelector(".link-card")).backdropFilter,
          cardHighlight: getComputedStyle(document.querySelector(".link-card"), "::before")
            .backgroundImage,
        };
      });

      expect(layout.hScroll).toBe(0);
      expect(layout.gradientBackground).toBe(false);
      expect(layout.cardShadow).not.toBe("none");
      expect(layout.cardBackdrop).toBe("none");
      expect(layout.cardHighlight).toContain("radial-gradient");
      expect(layout.categoryIcons).toBe(0);
      expect(layout.iconFrame.width).toBe(36);
      expect(layout.iconFrame.height).toBe(36);
      if (shot.width >= 1024) {
        expect(layout.workbar.height).toBe(64);
        expect(layout.sidebar.width).toBe(208);
        expect(layout.brand.x).toBe(layout.sidebar.x);
        expect(layout.search.x).toBe(layout.directory.x);
        expect(layout.cardHeight).toBe(76);
      } else if (shot.width >= 720) {
        expect(layout.columns).toBe(2);
        expect(layout.workbar.height).toBe(112);
        expect(layout.sidebar.height).toBe(48);
        expect(layout.cardHeight).toBe(72);
      } else {
        expect(layout.columns).toBe(1);
        expect(layout.workbar.height).toBe(112);
        expect(layout.sidebar.height).toBe(48);
        expect(layout.cardHeight).toBe(72);
      }
      const expectedColumns = EXPECTED_COLUMNS[shot.name];
      if (Array.isArray(expectedColumns)) {
        expect(expectedColumns).toContain(layout.columns);
      } else {
        expect(layout.columns).toBe(expectedColumns);
      }
      if (shot.width >= 1920) expect(layout.workbarInner.width).toBeLessThanOrEqual(1680);

      await expect(page).toHaveScreenshot(`${shot.name}-${theme}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: true,
      });
    }
  }
});
