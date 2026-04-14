import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const withEnv = args.has("--with-env");
const withBatch = args.has("--with-batch");
const withWebHarness = args.has("--with-web-harness");

function runNodeScript(title, scriptPath, scriptArgs = []) {
  console.log(`\n==> ${title}`);
  console.log(`$ node ${scriptPath}${scriptArgs.length ? ` ${scriptArgs.join(" ")}` : ""}`);

  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw new Error(`${title} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${title} failed: exited with code ${result.status ?? 1}`);
  }
}

function runCommand(title, command, commandArgs = []) {
  console.log(`\n==> ${title}`);
  console.log(`$ ${command} ${commandArgs.join(" ")}`.trim());

  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: true
  });

  if (result.error) {
    throw new Error(`${title} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${title} failed: exited with code ${result.status ?? 1}`);
  }
}

function main() {
  console.log("Ops ready-check starting");
  console.log(
    `- mode: withEnv=${withEnv ? "yes" : "no"}, withBatch=${withBatch ? "yes" : "no"}, withWebHarness=${withWebHarness ? "yes" : "no"}`
  );

  runCommand("Smoke test", "pnpm", [withEnv ? "smoke:with-env" : "smoke"]);
  runCommand("Progress report", "pnpm", ["ops:progress"]);

  const preflightArgs = [];
  if (!withEnv) {
    preflightArgs.push("--skip-env");
  }
  if (!withBatch) {
    preflightArgs.push("--skip-batch");
  }
  preflightArgs.push("--allow-missing");

  runNodeScript("Ops preflight", resolve("scripts/ops/preflight.mjs"), preflightArgs);

  if (withWebHarness) {
    runCommand("Web recurring harness", "pnpm", ["ops:harness:web"]);
  } else {
    console.log("\n[skip] Web recurring harness");
  }

  console.log("\nOps ready-check completed successfully.");
}

try {
  main();
} catch (error) {
  console.error("\nOps ready-check failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
