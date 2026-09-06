import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = [
  "/", "/watchlist", "/dashboards", "/predictors",
  "/equipment/air-blower", "/equipment/fired-heater", "/equipment/shell-tube-exchanger",
  "/equipment/membrane-analyzer", "/predictors/furnace-skin-temp",
  "/crude-to-profit", "/settings", "/help",
];

test.describe("No critical/serious axe-core violations (WCAG 2 A/AA)", () => {
  for (const route of ROUTES) {
    test(`a11y ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(critical, JSON.stringify(critical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), null, 2)).toHaveLength(0);
    });
  }
});
