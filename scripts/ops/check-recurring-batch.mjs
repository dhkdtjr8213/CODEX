const getEnv = (name) => {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
};

const supabaseUrl = getEnv("SUPABASE_URL");
const cronSecret = getEnv("CRON_SECRET");
const customFunctionUrl = getEnv("RUN_RECURRING_BATCH_URL");

if (!supabaseUrl) {
  console.error("Missing required env: SUPABASE_URL");
  process.exit(1);
}

if (!cronSecret) {
  console.error("Missing required env: CRON_SECRET");
  process.exit(1);
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const parsedLimit = Number(limitArg?.split("=")[1] ?? "10");
const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.trunc(parsedLimit))) : 10;

const endpointBase = customFunctionUrl || `${supabaseUrl.replace(/\/$/, "")}/functions/v1/run-recurring-batch`;
const endpoint = `${endpointBase}?dry_run=true&limit=${limit}`;

console.log("Recurring batch dry-run check");
console.log(`- endpoint: ${endpointBase}`);
console.log(`- limit: ${limit}`);

let response;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-cron-secret": cronSecret
    }
  });
} catch (error) {
  console.error("Failed to call recurring batch function.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let body = null;
try {
  body = await response.json();
} catch {
  console.error(`Unexpected response format (status: ${response.status}).`);
  process.exit(1);
}

if (!response.ok || !body?.ok) {
  console.error(`Recurring batch dry-run failed (status: ${response.status}).`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log("Dry-run succeeded.");
console.log(`- dueCount: ${body.dueCount ?? 0}`);
console.log(`- preview: ${Array.isArray(body.preview) ? body.preview.length : 0} item(s)`);

