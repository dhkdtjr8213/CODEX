import { spawnSync } from "node:child_process";

const required = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET"
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error("Missing required env:");
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

function run(title, args) {
  console.log(`\n==> ${title}`);
  console.log(`$ npx supabase ${args.join(" ")}`);

  const result = spawnSync("npx", ["supabase", ...args], {
    stdio: "inherit",
    shell: true,
    env: process.env
  });

  if (result.error) {
    throw new Error(`${title} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${title} failed: exited with code ${result.status ?? 1}`);
  }
}

try {
  run("Deploy function", [
    "functions",
    "deploy",
    "run-recurring-batch",
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF,
    "--no-verify-jwt"
  ]);

  run("Set function secrets", [
    "secrets",
    "set",
    `SUPABASE_URL=${process.env.SUPABASE_URL}`,
    `SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    `CRON_SECRET=${process.env.CRON_SECRET}`,
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF
  ]);

  console.log("\nRecurring function deploy completed.");
} catch (error) {
  console.error("\nRecurring function deploy failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
