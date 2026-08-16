import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PAGE_URL } from "../playwright.config.mjs";

test("no critical or serious axe violations", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem("rainboy-nav-theme"));
  await page.goto(PAGE_URL);
  await page.waitForTimeout(250);

  const results = await new AxeBuilder({ page }).analyze();
  const blockers = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact),
  );
  const summary = blockers.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.length,
  }));
  expect(summary, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.locator("#site-search").fill("github");
  await page.waitForTimeout(200);
  const filteredResults = await new AxeBuilder({ page }).analyze();
  const filteredBlockers = filteredResults.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact),
  );
  expect(
    filteredBlockers.map((violation) => violation.id),
    JSON.stringify(filteredResults.violations, null, 2),
  ).toEqual([]);
});
