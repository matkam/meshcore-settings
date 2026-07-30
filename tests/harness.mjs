/*
 * Shared bits every suite needs: where Chromium is, and where screenshots go.
 *
 * Nothing here is a test. It exists so the suites don't hard-code anything
 * about the machine they happen to be running on.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/*
 * Playwright normally manages its own browser download. Some environments
 * pre-install one instead (PLAYWRIGHT_BROWSERS_PATH), and if its build number
 * doesn't match the npm package, launch() fails with a "browser not found"
 * that reads like a missing dependency. Setting CHROMIUM_PATH points launch()
 * at a specific binary and sidesteps the version check.
 */
export const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : {};

const shotDir = join(here, "screenshots");
mkdirSync(shotDir, { recursive: true });

// Screenshots are for looking at when something breaks, not results. They land
// in tests/screenshots/, which is gitignored.
export function shot(name) {
  return join(shotDir, name);
}

/* ---------- the picker ----------
 * A tree of checkboxes, so tests tick codes rather than driving three selects.
 * Ticking a parent is what reveals its children, so `pick` walks down.
 */

export async function tick(page, ...codes) {
  for (const code of codes) {
    await page.check(`.picker input[data-code="${code}"]`);
    await page.waitForTimeout(110);
  }
}

export async function untick(page, ...codes) {
  for (const code of codes) {
    await page.uncheck(`.picker input[data-code="${code}"]`);
    await page.waitForTimeout(110);
  }
}

// Everything currently ticked, deepest level last.
export function picks(page) {
  return page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code));
}

export function isTicked(page, code) {
  return page.$eval(`.picker input[data-code="${code}"]`, (x) => x.checked).catch(() => false);
}

// Ticking adds to what is already there, so a test that wants a fresh selection
// has to say so. Unticking a region takes everything under it, so clearing the
// top level is enough.
export async function clearPicks(page) {
  const regions = await page.$$eval(".pick-row.lvl-region input:checked",
    (n) => n.map((x) => x.dataset.code));
  for (const code of regions) {
    await page.uncheck(`.picker input[data-code="${code}"]`);
    await page.waitForTimeout(80);
  }
}
