import { test, expect } from "@playwright/test";
import { PAGE_URL } from "../playwright.config.mjs";

const TOTAL = 119;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("rainboy-nav-theme"));
  await page.goto(PAGE_URL);
});

test(`baseline structure keeps 11 categories and ${TOTAL} items`, async ({ page }) => {
  await expect(page.locator(".directory-section")).toHaveCount(11);
  await expect(page.locator(".link-card")).toHaveCount(TOTAL);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".directory-section h2")).toHaveCount(11);
  await expect(page.locator("#result-count")).toHaveText(`${TOTAL} LINKS`);
  await expect(page.locator(".category-link")).toHaveCount(11);
  for (const link of await page.locator(".category-link").all()) {
    await expect(link).toHaveAttribute("href", /^#group-/);
  }
});

test("V2 precision-console hierarchy uses indexes and quiet metadata", async ({ page }) => {
  await expect(page.locator("#site-search")).toHaveAttribute("placeholder", "搜索网址、描述或域名");
  await expect(page.locator(".category-icon, .section-icon")).toHaveCount(0);
  await expect(page.locator(".category-index")).toHaveText([
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
  ]);
  await expect(page.locator(".section-index")).toHaveText([
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
  ]);
  await expect(page.locator(".section-unit")).toHaveText(Array(11).fill("LINKS"));
  await expect(page.locator(".link-icon-frame").first()).toHaveCSS("width", "36px");
  await expect(page.locator(".link-icon-frame").first()).toHaveCSS("height", "36px");
  await expect(page.locator("#empty-clear svg")).toHaveCount(1);
  await expect(page.locator("svg symbol")).toHaveCount(6);

  const colors = await page.locator(".link-card").first().evaluate((card) => {
    const resolveColor = (token) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    return {
      external: getComputedStyle(card.querySelector(".link-external")).color,
      tertiary: resolveColor("--color-text-tertiary"),
      signal: resolveColor("--color-signal"),
      hostFont: getComputedStyle(card.querySelector(".link-host")).fontFamily,
    };
  });
  expect(colors.external).toBe(colors.tertiary);
  expect(colors.external).not.toBe(colors.signal);
  expect(colors.hostFont).toContain("monospace");
});

test("dark cards remain distinct and tilt toward the pointer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-dark");
  const card = page.locator(".link-card").first();
  const contrast = await card.evaluate((node) => {
    const luminance = (color) => {
      const channels = color.match(/\d+/g).slice(0, 3).map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const ratio = (first, second) => {
      const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const style = getComputedStyle(node);
    return {
      surface: ratio(style.backgroundColor, getComputedStyle(document.body).backgroundColor),
      border: ratio(style.borderTopColor, style.backgroundColor),
    };
  });
  expect(contrast.surface).toBeGreaterThan(1.2);
  expect(contrast.border).toBeGreaterThan(1.5);

  const material = await card.evaluate((node) => ({
    backdrop: getComputedStyle(node).backdropFilter,
    highlight: getComputedStyle(node, "::before").backgroundImage,
    shadow: getComputedStyle(node).boxShadow,
  }));
  expect(material.backdrop).toBe("none");
  expect(material.highlight).toContain("radial-gradient");
  expect(material.shadow).not.toBe("none");

  const box = await card.boundingBox();
  const readTilt = () => card.evaluate((node) => ({
    x: Number.parseFloat(node.style.getPropertyValue("--tilt-x")),
    y: Number.parseFloat(node.style.getPropertyValue("--tilt-y")),
    glassX: Number.parseFloat(node.style.getPropertyValue("--glass-x")),
    glassY: Number.parseFloat(node.style.getPropertyValue("--glass-y")),
  }));

  await page.mouse.move(box.x + 1, box.y + 1);
  await expect.poll(async () => (await readTilt()).x).toBeGreaterThan(4.5);
  await expect.poll(() => card.evaluate(
    (node) => getComputedStyle(node).backdropFilter,
  )).not.toBe("none");
  const topLeft = await readTilt();
  expect(topLeft.x).toBeGreaterThan(4.5);
  expect(topLeft.y).toBeLessThan(-4.5);
  expect(Math.abs(topLeft.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(topLeft.y)).toBeLessThanOrEqual(5);
  expect(topLeft.glassX).toBeLessThan(5);
  expect(topLeft.glassY).toBeLessThan(5);

  await page.waitForTimeout(220);
  const tiltedBox = await card.boundingBox();
  await page.mouse.move(tiltedBox.x + tiltedBox.width / 2, tiltedBox.y + tiltedBox.height / 2);
  await expect.poll(async () => {
    const center = await readTilt();
    return Math.max(
      Math.abs(center.x),
      Math.abs(center.y),
      Math.abs(center.glassX - 50),
      Math.abs(center.glassY - 50),
    );
  }).toBeLessThan(0.1);
  await expect.poll(() => card.evaluate(
    (node) => new DOMMatrix(getComputedStyle(node).transform).is2D,
  )).toBe(false);
  await expect.poll(() => card.evaluate(
    (node) => new DOMMatrix(getComputedStyle(node).transform).m42,
  )).toBeLessThan(-2.5);
  await expect.poll(() => card.evaluate(
    (node) => new DOMMatrix(getComputedStyle(node).transform).m11,
  )).toBeGreaterThan(1.005);

  await page.waitForTimeout(220);
  const centeredBox = await card.boundingBox();
  await page.mouse.move(centeredBox.x + centeredBox.width - 8, centeredBox.y + centeredBox.height - 8);
  await expect.poll(async () => (await readTilt()).x).toBeLessThan(-3.5);
  const bottomRight = await readTilt();
  expect(bottomRight.x).toBeLessThan(-3.5);
  expect(bottomRight.y).toBeGreaterThan(4.5);
  expect(Math.abs(bottomRight.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(bottomRight.y)).toBeLessThanOrEqual(5);
  expect(bottomRight.glassX).toBeGreaterThan(90);
  expect(bottomRight.glassY).toBeGreaterThan(80);

  await page.mouse.move(0, 0);
  await expect.poll(() => card.evaluate((node) => [
    "--tilt-x", "--tilt-y", "--glass-x", "--glass-y",
  ].map((property) => node.style.getPropertyValue(property)))).toEqual(["", "", "", ""]);

  await page.mouse.move(box.x + 1, box.y + 1);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(card).toHaveCSS("transform", "none");
  await expect.poll(() => card.evaluate((node) => [
    "--tilt-x", "--tilt-y", "--glass-x", "--glass-y",
  ].map((property) => node.style.getPropertyValue(property)))).toEqual(["", "", "", ""]);
});

test("search samples return exact match counts", async ({ page }) => {
  const samples = {
    github: 10,
    luogu: 6,
    graphviz: 2,
    工具: 38,
    AI: 7,
    不存在的网址: 0,
    "github 教程": 0,
  };
  for (const [query, expected] of Object.entries(samples)) {
    await page.locator("#site-search").fill(query);
    await expect(page.locator(".link-card:not([hidden])")).toHaveCount(expected);
  }
});

test("NFKC normalization handles case and fullwidth differences", async ({ page }) => {
  await page.locator("#site-search").fill("ＧＩＴＨＵＢ");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(10);
  await page.locator("#site-search").fill("GITHUB");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(10);
  await page.locator("#site-search").fill("LuOgU");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(6);
});

test("whitespace-only query restores the full directory", async ({ page }) => {
  await page.locator("#site-search").fill("github");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(10);
  await page.locator("#site-search").fill("   ");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(TOTAL);
  await expect(page.locator(".directory-section")).toHaveCount(11);
  await expect(page.locator("#result-count")).toHaveText(`${TOTAL} LINKS`);
  await expect(page.locator(".link-card mark")).toHaveCount(0);
});

test("clearing a query updates the screen reader result status", async ({ page }) => {
  await page.locator("#site-search").fill("github");
  await expect(page.locator("#search-status")).toHaveText(`找到 10 个网址，共 ${TOTAL} 个`);
  await page.locator("#site-search").fill("");
  await expect(page.locator("#search-status")).toHaveText(`显示全部 ${TOTAL} 个网址`);
});

test("multi-keyword search uses AND semantics without reordering", async ({ page }) => {
  const original = await page.locator(".link-card").evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("href")),
  );
  await page.locator("#site-search").fill("github 教程");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(0);
  await page.locator("#site-search").fill("知识 算法");
  const visible = await page.locator(".link-card:not([hidden])").evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("href")),
  );
  const set = new Set(visible);
  expect(original.filter((href) => set.has(href))).toEqual(visible);
});

test("counts stay in sync across workbar, navigation and section headings", async ({ page }) => {
  await page.locator("#site-search").fill("github");
  await expect(page.locator("#result-count")).toHaveText(`10 / ${TOTAL}`);
  await expect(page.locator("#search-status")).toHaveText(`找到 10 个网址，共 ${TOTAL} 个`);
  const sections = await page.locator(".directory-section:not([hidden])").all();
  expect(sections.length).toBeGreaterThan(0);
  for (const section of sections) {
    const groupId = await section.getAttribute("data-group-id");
    const cardCount = await section.locator(".link-card:not([hidden])").count();
    await expect(section.locator(".section-count")).toHaveText(String(cardCount));
    const navLink = page.locator(`.category-link[data-group-id="${groupId}"]`);
    await expect(navLink).toBeVisible();
    await expect(navLink.locator(".category-count")).toHaveText(String(cardCount));
  }
});

test("zero results shows empty state and hides navigation", async ({ page }) => {
  await page.locator("#site-search").fill("不存在的网址");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(0);
  await expect(page.locator(".directory-section:not([hidden])")).toHaveCount(0);
  await expect(page.locator("#category-sidebar")).toBeHidden();
  await expect(page.locator("#search-empty")).toBeVisible();
  await expect(page.locator("#empty-query")).toHaveText("不存在的网址");
  await expect(page.locator('.category-link[aria-current="true"]')).toHaveCount(0);
  await page.locator("#empty-clear").click();
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(TOTAL);
  await expect(page.locator("#category-sidebar")).toBeVisible();
  await expect(page.locator("#search-empty")).toBeHidden();
  await expect(page.locator("#site-search")).toBeFocused();
});

test("a long zero-result query never creates page-level horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator("#site-search").fill("x".repeat(500));
  await expect(page.locator("#search-empty")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("Escape clears the query first, then moves focus out", async ({ page }) => {
  await page.locator("#site-search").fill("luogu");
  await page.locator("#site-search").press("Escape");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(TOTAL);
  await expect(page.locator("#site-search")).toBeFocused();
  await page.locator("#site-search").press("Escape");
  await expect(page.locator("#site-search")).not.toBeFocused();
});

test("ArrowDown moves focus to the first visible item; Enter does not open it", async ({ page }) => {
  await page.locator("#site-search").fill("graphviz");
  await page.locator("#site-search").press("ArrowDown");
  await expect(page.locator(".link-card:not([hidden])").first()).toBeFocused();
  const href = await page.locator(".link-card:not([hidden])").first().getAttribute("href");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(PAGE_URL);
  expect(href).toBe("https://magjac.com/graphviz-visual-editor/");
});

test("slash and Ctrl+K focus the search box, but not inside an editable", async ({ page }) => {
  await page.locator("#site-search").fill("abc");
  await page.keyboard.press("/");
  await expect(page.locator("#site-search")).toBeFocused();
  await expect(page.locator("#site-search")).toHaveValue("abc/");
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("/");
  await expect(page.locator("#site-search")).toBeFocused();
  await expect(page.locator("#site-search")).toHaveValue("abc/");
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Control+K");
  await expect(page.locator("#site-search")).toBeFocused();
});

test("first non-empty query scrolls to directory top exactly once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.locator("#site-search").fill("g");
  await page.waitForTimeout(150);
  const afterFirst = await page.evaluate(() => window.scrollY);
  expect(afterFirst).toBeLessThan(300);
  await page.locator("#site-search").fill("gi");
  await page.waitForTimeout(150);
  const afterMore = await page.evaluate(() => window.scrollY);
  expect(afterMore).toBe(afterFirst);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const atBottom = await page.evaluate(() => window.scrollY);
  expect(atBottom).toBeGreaterThan(0);
  await page.locator("#site-search").fill("");
  await page.waitForTimeout(150);
  const afterClear = await page.evaluate(() => window.scrollY);
  expect(afterClear).toBeGreaterThan(0);
  expect(afterClear).toBeGreaterThanOrEqual(atBottom - 1);
});

test("IME composition does not update the list until commit", async ({ page }) => {
  const counts = await page.evaluate(() => {
    const input = document.getElementById("site-search");
    input.value = "图";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    const composing = document.querySelectorAll(".link-card:not([hidden])").length;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: false }));
    const committed = document.querySelectorAll(".link-card:not([hidden])").length;
    input.value = "";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: false }));
    return { composing, committed };
  });
  expect(counts.composing).toBe(TOTAL);
  expect(counts.committed).toBe(5);
});

test("highlight only uses safe mapped fragments in title, description and domain", async ({ page }) => {
  await page.locator("#site-search").fill("github");
  const marks = await page.locator(".link-card:not([hidden]) mark").all();
  expect(marks.length).toBeGreaterThan(0);
  for (const mark of marks) {
    await expect(mark.locator("xpath=ancestor::span[contains(@class,'link-title') or contains(@class,'link-description') or contains(@class,'link-host')][1]")).toHaveCount(1);
  }
  await page.locator("#site-search").fill("ＧＩＴＨＵＢ");
  await expect(page.locator(".link-card:not([hidden]) mark").first()).toBeVisible();
  await page.locator("#site-search").fill("");
  await expect(page.locator("mark")).toHaveCount(0);
});

test("malicious query text never becomes HTML nodes", async ({ page }) => {
  const dialogs = [];
  page.on("dialog", (dialog) => dialogs.push(dialog.message()));
  const beforeImgs = await page.locator(".link-card img").count();
  await page.locator("#site-search").fill('<img src=x onerror=alert(1)>');
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(0);
  await expect(page.locator(".link-card img")).toHaveCount(beforeImgs);
  expect(dialogs).toEqual([]);
  await expect(page.locator("mark")).toHaveCount(0);
});

test("category click sets aria-current and scrolls the rail on narrow screens", async ({ page }) => {
  const isNarrow = (await page.viewportSize()).width < 1024;
  if (isNarrow) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".category-link", { hasText: "知识" }).click();
  await expect(page.locator('.category-link[aria-current="true"]')).toHaveText(/知识/);
  if (isNarrow) {
    const scrollLeft = await page.locator("#category-list").evaluate((el) => el.scrollLeft);
    expect(scrollLeft).toBeGreaterThan(0);
    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(hScroll).toBe(0);
    const overlap = await page.evaluate(() => {
      const rail = document.querySelector("#category-sidebar").getBoundingClientRect();
      const heading = document.querySelector("#group-8 .section-heading-row").getBoundingClientRect();
      return rail.bottom - heading.top;
    });
    expect(overlap).toBeLessThanOrEqual(1);
  }
});

test("category rail centering uses an absolute scroll position", async ({ page }) => {
  const isNarrow = (await page.viewportSize()).width < 1024;
  test.skip(!isNarrow, "horizontal category rail only exists below the desktop breakpoint");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const expected = await page.evaluate(() => {
    const list = document.querySelector("#category-list");
    const link = Array.from(document.querySelectorAll(".category-link")).find(
      (candidate) => candidate.querySelector(".category-title").textContent === "AI",
    );
    list.scrollLeft = list.scrollWidth - list.clientWidth;
    const target =
      list.scrollLeft +
      link.getBoundingClientRect().left -
      list.getBoundingClientRect().left -
      (list.clientWidth - link.offsetWidth) / 2;
    const clamped = Math.max(0, Math.min(list.scrollWidth - list.clientWidth, target));
    link.click();
    return clamped;
  });
  await expect
    .poll(() => page.locator("#category-list").evaluate((list) => list.scrollLeft))
    .toBeCloseTo(expected, 0);
});

test("scrollspy updates aria-current and survives filtering", async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await expect(page.locator('.category-link[aria-current="true"]')).toHaveText(/关联/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await expect(page.locator('.category-link[aria-current="true"]')).toHaveText(/网站/);
  await page.locator("#site-search").fill("工具");
  await page.waitForTimeout(200);
  for (const link of await page.locator('.category-link[aria-current="true"]').all()) {
    await expect(link).toBeVisible();
  }
  await page.locator("#site-search").fill("");
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await expect(page.locator('.category-link[aria-current="true"]')).toHaveText(/网站/);
});

test("icon load failure and missing config both keep a same-size letter fallback", async ({ page }) => {
  const fallbackBefore = await page.locator(".link-icon-fallback:not([hidden])").count();
  expect(fallbackBefore).toBeGreaterThan(0);
  const frame = page.locator(".link-icon-frame").first();
  const before = await frame.boundingBox();
  await page.locator(".link-icon").first().dispatchEvent("error");
  const fallback = page.locator(".link-icon-fallback:not([hidden])").first();
  await expect(fallback).toBeVisible();
  const frameAfter = await frame.boundingBox();
  expect(frameAfter.width).toBeCloseTo(before.width, 0);
  expect(frameAfter.height).toBeCloseTo(before.height, 0);
  const fbBox = await fallback.boundingBox();
  expect(fbBox.width).toBeGreaterThanOrEqual(before.width - 4);
  expect(fbBox.height).toBeGreaterThanOrEqual(before.height - 4);
});

test("theme follows system on first visit and persists after manual toggle", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto(PAGE_URL);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await context.close();
});

test("theme still works when localStorage writes fail", async ({ page }) => {
  const initial = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("quota exceeded");
    };
  });
  await page.locator("#theme-toggle").click();
  const next = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(next).not.toBe(initial);
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", initial);
});

test("theme still follows the system when localStorage reads fail", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("storage blocked");
    };
  });
  await page.goto(PAGE_URL);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await context.close();
});

test("back-to-top shows past the threshold and works with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#back-to-top")).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(page.locator("#back-to-top")).toBeVisible();
  await page.locator("#back-to-top").click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 50));
  await expect(page.locator("#back-to-top")).toBeHidden();
});

test("keyboard-only flow reaches every core control", async ({ page }) => {
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await page.locator("#site-search").fill("github");
  await page.locator("#site-search").press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(page.locator(".link-card:not([hidden])").nth(1)).toBeFocused();
  await page.keyboard.press("Control+K");
  await expect(page.locator("#site-search")).toBeFocused();
  await page.locator("#site-search").press("Escape");
  await expect(page.locator(".link-card:not([hidden])")).toHaveCount(TOTAL);
});

test("no page-level horizontal scroll at 320px and at 200% zoom", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await page.waitForTimeout(200);
  const hScroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(hScroll).toBe(0);
  if (browserName !== "chromium") return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 2,
  });
  await page.reload();
  await page.waitForTimeout(200);
  const zoomed = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(zoomed).toBe(0);
  await expect(page.locator(".link-card")).toHaveCount(TOTAL);
});
