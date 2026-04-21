import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function run(command, args) {
  const cmdline = `${command} ${args.join(" ")}`.trim();
  console.log(`\n==> ${cmdline}`);
  const result = spawnSync(cmdline, {
    shell: true,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env }
  });
  return {
    cmdline,
    status: result.status ?? 1,
    ok: (result.status ?? 1) === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function firstLine(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) || "";
}

const now = new Date().toISOString();
const reportPath = resolve("docs/manual-kit/pr-rehearsal-last-report.md");

const branchResult = run("git", ["branch", "--show-current"]);
const branch = firstLine(branchResult.stdout);
const statusResult = run("git", ["status", "--short"]);

const checks = [
  run("pnpm.cmd", ["typecheck"]),
  run("pnpm.cmd", ["lint"]),
  run("npm.cmd", ["run", "smoke"])
];

const allPass = checks.every((item) => item.ok);
const summaryLines = [
  "# PR Rehearsal Last Report",
  "",
  `- generatedAt: ${now}`,
  `- currentBranch: ${branch || "unknown"}`,
  `- branchIsMain: ${branch === "main" ? "yes" : "no"}`,
  `- changedFilesCount: ${
    statusResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length
  }`,
  `- ciLikeChecks: ${allPass ? "PASS" : "FAIL"}`,
  "",
  "## Checks",
  ...checks.map((item) => `- ${item.cmdline}: ${item.ok ? "ok" : `fail (${item.status})`}`),
  "",
  "## Failure Snippets",
  ...checks
    .filter((item) => !item.ok)
    .flatMap((item) => [
      `### ${item.cmdline}`,
      "```",
      (item.stderr || item.stdout || "(no output)").slice(0, 2000),
      "```"
    ]),
  "",
  "## Notes",
  branch === "main"
    ? "- currently on `main`; create a feature branch before opening PR"
    : "- feature branch detected; PR creation path is ready",
  "- if branch protection is enabled, merge should require PR + required checks",
  "",
  "## Git Status (short)",
  "```",
  statusResult.stdout.trim() || "(clean)",
  "```"
];

writeFileSync(reportPath, summaryLines.join("\n"), "utf8");
console.log(`\n[report] Updated ${reportPath}`);

if (!allPass) {
  console.error("\nPR rehearsal checks failed.");
  process.exit(1);
}

console.log("\nPR rehearsal checks passed.");
