// `npm audit` over the whole tree, build tools included, with a short list
// of advisories that are accepted on purpose.
//
// npm has no way to acknowledge an advisory: `npm audit` fails on every one,
// including those with no patched release, which leaves a choice between a
// CI that is always red (and so ignored) and a gate loosened for everything.
// This keeps the gate at "any advisory fails" and names the exceptions, each
// with why it can't reach a reader and when to look at it again. An
// advisory not on the list fails the run, as before; one on the list that no
// longer appears is reported, so the list doesn't outlive its reasons.
//
// The production tree (`npm audit --omit=dev`) is checked separately in CI,
// with no exceptions at all.
import { execSync } from "node:child_process";

/** GHSA id -> why it is accepted, and when to check again. */
const ACCEPTED = {
  "GHSA-fc5q-39xc-vjpf": {
    package: "picomatch",
    why:
      "ReDoS in glob patterns with repeated extglobs. picomatch has no patched release " +
      "(4.0.7 is the latest and affected). It is reached only by build tools — Tailwind's " +
      "content scanner, Vite, Vitest, Workbox, Stylelint — matching the project's own fixed " +
      "globs, never input from a visitor, and none of it ships in the bundle.",
    review: "2027-01-31",
  },
};

let raw;
try {
  // A fixed command string (no arguments from anywhere), so the shell is
  // safe here, and it is what finds npm.cmd on Windows.
  raw = execSync("npm audit --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
  raw = error.stdout;
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error("audit: npm audit did not return JSON:\n" + String(raw).slice(0, 2000));
  process.exit(2);
}
if (report.error) {
  console.error("audit: npm audit failed:", report.error.summary || report.error);
  process.exit(2);
}

const found = new Map(); // GHSA id -> { title, severity, packages }
for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object" || !via.url) continue;
    const id = via.url.split("/").pop();
    const entry = found.get(id) ?? { title: via.title, severity: via.severity, packages: new Set() };
    entry.packages.add(name);
    found.set(id, entry);
  }
}

const today = new Date().toISOString().slice(0, 10);
const unaccepted = [...found].filter(([id]) => !ACCEPTED[id]);
const accepted = [...found].filter(([id]) => ACCEPTED[id]);
const stale = Object.keys(ACCEPTED).filter((id) => !found.has(id));

for (const [id, v] of accepted) {
  const a = ACCEPTED[id];
  const due = a.review <= today ? `  REVIEW DUE (${a.review})` : "";
  console.log(`accepted  ${id}  ${v.severity}  ${[...v.packages].join(", ")}${due}`);
}
for (const id of stale) {
  console.log(`no longer reported: ${id} (${ACCEPTED[id].package}). Remove it from ACCEPTED in scripts/audit.mjs.`);
}
if (unaccepted.length) {
  console.error("\nUnaccepted advisories:");
  for (const [id, v] of unaccepted) {
    console.error(`  ${id}  ${v.severity}  ${v.title}  (${[...v.packages].join(", ")})`);
  }
  console.error("\nFix them (npm audit fix, an upgrade, or an override in package.json). Only an advisory that cannot reach the site belongs in ACCEPTED.");
  process.exit(1);
}
console.log(`audit: ${found.size} advisor${found.size === 1 ? "y" : "ies"} in the tree, all accepted.`);
