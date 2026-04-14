import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const skipEnv = args.has("--skip-env");
const skipBatch = args.has("--skip-batch");
const allowMissing = args.has("--allow-missing");

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

if (skipEnv) {
  console.log("[skip] Runtime env validation");
} else {
  const result = runStep("Runtime env validation", resolve("scripts/ops/validate-runtime-env.mjs"));
  if (!result.ok) {
    if (allowMissing) {
      console.log(`\n[warn] Runtime env validation: ${result.reason}`);
    } else {
      console.error(`\n[fail] Runtime env validation: ${result.reason}`);
    }
    failures.push("Runtime env validation");
  }
}

if (skipBatch) {
  console.log("[skip] Recurring batch dry-run check");
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
  }
}

const webRedirect = process.env.WEB_APP_URL?.trim() || "https://<web-domain>/";
const mobileRedirect =
  process.env.MOBILE_REDIRECT_URL?.trim() || "household-ledger://auth/callback";

console.log("\nGoogle Provider redirect URL checklist");
console.log(`- web: ${webRedirect}`);
console.log(`- mobile: ${mobileRedirect}`);
console.log("- confirm both URLs are registered in Supabase Auth > URL Configuration");

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
