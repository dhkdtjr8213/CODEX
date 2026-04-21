import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const skipEnv = args.has("--skip-env");
const skipBatch = args.has("--skip-batch");
const allowMissing = args.has("--allow-missing");
const reportPath = resolve("docs/manual-kit/preflight-last-report.md");
const checklistPath = resolve("docs/deployment-checklist.md");
const CHECKLIST_START = "<!-- PRECHECK:START -->";
const CHECKLIST_END = "<!-- PRECHECK:END -->";

const envGroups = [
  {
    name: "web",
    required: [
      "NEXT_PUBLIC_SUPABASE_URL",
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    ]
  },
  {
    name: "mobile",
    required: [
      "EXPO_PUBLIC_SUPABASE_URL",
      ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]
    ]
  },
  {
    name: "supabase",
    required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"]
  }
];

function collectMissingRuntimeEnv() {
  const missing = [];

  for (const group of envGroups) {
    for (const requirement of group.required) {
      if (Array.isArray(requirement)) {
        const present = requirement.some((name) => Boolean(process.env[name]?.trim()));
        if (!present) {
          missing.push(`${group.name}: ${requirement.join(" or ")}`);
        }
        continue;
      }

      if (!process.env[requirement]?.trim()) {
        missing.push(`${group.name}: ${requirement}`);
      }
    }
  }

  return missing;
}

function runStep(title, scriptPath) {
  console.log(`\n==> ${title}`);
  console.log(`$ node ${scriptPath}`);

  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    return { ok: false, reason: result.error.message };
  }

  if (result.status !== 0) {
    return { ok: false, reason: `exited with code ${result.status ?? 1}` };
  }

  console.log(`[ok] ${title}`);
  return { ok: true };
}

console.log("Ops preflight check starting");
const failures = [];
const stepResults = [];

if (skipEnv) {
  console.log("[skip] Runtime env validation");
  stepResults.push({ title: "Runtime env validation", status: "skipped", reason: "skip flag enabled" });
} else {
  const result = runStep("Runtime env validation", resolve("scripts/ops/validate-runtime-env.mjs"));
  if (!result.ok) {
    if (allowMissing) {
      console.log(`\n[warn] Runtime env validation: ${result.reason}`);
    } else {
      console.error(`\n[fail] Runtime env validation: ${result.reason}`);
    }
    failures.push("Runtime env validation");
    stepResults.push({ title: "Runtime env validation", status: allowMissing ? "warn" : "failed", reason: result.reason });
  } else {
    stepResults.push({ title: "Runtime env validation", status: "ok", reason: "" });
  }
}

if (skipBatch) {
  console.log("[skip] Recurring batch dry-run check");
  stepResults.push({ title: "Recurring batch dry-run check", status: "skipped", reason: "skip flag enabled" });
} else {
  const result = runStep(
    "Recurring batch dry-run check",
    resolve("scripts/ops/check-recurring-batch.mjs")
  );
  if (!result.ok) {
    if (allowMissing) {
      console.log(`\n[warn] Recurring batch dry-run check: ${result.reason}`);
    } else {
      console.error(`\n[fail] Recurring batch dry-run check: ${result.reason}`);
    }
    failures.push("Recurring batch dry-run check");
    stepResults.push({ title: "Recurring batch dry-run check", status: allowMissing ? "warn" : "failed", reason: result.reason });
  } else {
    stepResults.push({ title: "Recurring batch dry-run check", status: "ok", reason: "" });
  }
}

const webRedirect = process.env.WEB_APP_URL?.trim() || "https://<web-domain>/";
const mobileRedirect =
  process.env.MOBILE_REDIRECT_URL?.trim() || "household-ledger://auth/callback";

console.log("\nGoogle Provider redirect URL checklist");
console.log(`- web: ${webRedirect}`);
console.log(`- mobile: ${mobileRedirect}`);
console.log("- confirm both URLs are registered in Supabase Auth > URL Configuration");
const nowIso = new Date().toISOString();
const overallStatus =
  failures.length === 0 ? "PASS" : allowMissing ? "WARN" : "FAIL";
const missingRuntimeEnv = collectMissingRuntimeEnv();
const reportBody = [
  "# Preflight Last Report",
  "",
  `- generatedAt: ${nowIso}`,
  `- overall: ${overallStatus}`,
  "",
  "## Steps",
  ...stepResults.map(
    (step) =>
      `- ${step.title}: ${step.status}${step.reason ? ` (${step.reason})` : ""}`
  ),
  "",
  "## Missing Runtime Env",
  ...(missingRuntimeEnv.length ? missingRuntimeEnv.map((item) => `- ${item}`) : ["- none"]),
  "",
  "## Redirect Checklist",
  `- web: ${webRedirect}`,
  `- mobile: ${mobileRedirect}`
].join("\n");
writeFileSync(reportPath, reportBody, "utf8");
console.log(`\n[report] Updated ${reportPath}`);

try {
  const checklist = readFileSync(checklistPath, "utf8");
  const startIndex = checklist.indexOf(CHECKLIST_START);
  const endIndex = checklist.indexOf(CHECKLIST_END);

  if (startIndex >= 0 && endIndex > startIndex) {
    const before = checklist.slice(0, startIndex + CHECKLIST_START.length);
    const after = checklist.slice(endIndex);
    const checklistSummary = [
      "",
      "",
      `- 마지막 실행 시각: ${nowIso}`,
      `- 자동 판정: ${overallStatus}`,
      `- 단계 요약:`,
      ...stepResults.map(
        (step) =>
          `  - ${step.title}: ${step.status}${step.reason ? ` (${step.reason})` : ""}`
      ),
      `- 누락 env:`,
      ...(missingRuntimeEnv.length
        ? missingRuntimeEnv.map((item) => `  - ${item}`)
        : ["  - 없음"])
    ].join("\n");

    writeFileSync(checklistPath, `${before}${checklistSummary}\n${after}`, "utf8");
    console.log(`[report] Updated ${checklistPath}`);
  } else {
    console.log(`[warn] Checklist marker not found in ${checklistPath}`);
  }
} catch (error) {
  console.log(`[warn] Failed to update checklist: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  if (allowMissing) {
    console.log("\nOps preflight completed with warnings.");
    console.log(`- failed checks: ${failures.join(", ")}`);
    process.exit(0);
  }

  console.error("\nOps preflight failed.");
  console.error(`- failed checks: ${failures.join(", ")}`);
  process.exit(1);
}

console.log("\nOps preflight completed successfully.");
