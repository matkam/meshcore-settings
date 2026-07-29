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
