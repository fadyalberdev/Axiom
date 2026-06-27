import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.env.AXIOM_ROOT;
const outDir = process.env.SCREENSHOT_DIR;
const baseUrl = process.env.FRONTEND_URL;
const chromium = process.env.CHROMIUM_BIN;

if (!root || !outDir || !baseUrl || !chromium) {
  throw new Error("Missing AXIOM_ROOT, SCREENSHOT_DIR, FRONTEND_URL, or CHROMIUM_BIN");
}

mkdirSync(outDir, { recursive: true });

const shots = [
  ["/", "home.png"],
  ["/find-homes", "find-homes.png"],
  ["/dashboard", "dashboard.png"],
  ["/admin/login", "admin-login.png"],
  ["/pricing", "pricing.png"],
];

function run(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: "ignore", ...options });
    child.on("exit", (code) => resolvePromise(code ?? 1));
    child.on("error", () => resolvePromise(1));
  });
}

for (const [route, name] of shots) {
  const file = resolve(outDir, name);
  const url = new URL(route, baseUrl).toString();
  await run(chromium, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--window-size=1440,1100",
    `--screenshot=${file}`,
    url,
  ]);
}

const missing = shots.filter(([, name]) => !existsSync(resolve(outDir, name)));
if (missing.length) {
  throw new Error(`Missing screenshots: ${missing.map(([, name]) => name).join(", ")}`);
}
