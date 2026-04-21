const getEnv = (name) => {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
};

const args = new Set(process.argv.slice(2));
const executeMode = args.has("--execute");
const skipLogSummary = args.has("--skip-log-summary");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const parsedLimit = Number(limitArg?.split("=")[1] ?? "10");
const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.trunc(parsedLimit))) : 10;

const supabaseUrl = getEnv("SUPABASE_URL");
const cronSecret = getEnv("CRON_SECRET");
const customFunctionUrl = getEnv("RUN_RECURRING_BATCH_URL");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl) {
  console.error("Missing required env: SUPABASE_URL");
  process.exit(1);
}

if (!cronSecret) {
  console.error("Missing required env: CRON_SECRET");
  process.exit(1);
}

const endpointBase = customFunctionUrl || `${supabaseUrl.replace(/\/$/, "")}/functions/v1/run-recurring-batch`;
const modeParam = executeMode ? "" : "dry_run=true&";
const endpoint = `${endpointBase}?${modeParam}limit=${limit}`;

console.log(`Recurring batch check (${executeMode ? "execute" : "dry-run"})`);
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
  console.error(`Recurring batch check failed (status: ${response.status}).`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

if (!executeMode) {
  console.log("Dry-run succeeded.");
  console.log(`- dueCount: ${body.dueCount ?? 0}`);
  console.log(`- preview: ${Array.isArray(body.preview) ? body.preview.length : 0} item(s)`);
} else {
  console.log("Execute call succeeded.");
  const result = body.result ?? {};
  console.log(`- processed: ${result.processed_count ?? 0}`);
  console.log(`- created: ${result.created_count ?? 0}`);
  console.log(`- advanced: ${result.advanced_count ?? 0}`);
}

if (skipLogSummary) {
  process.exit(0);
}

if (!serviceRoleKey) {
  console.log("- log summary: skipped (SUPABASE_SERVICE_ROLE_KEY not set)");
  process.exit(0);
}

const logUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/recurring_transaction_executions?select=id,status,error_message,executed_at,scheduled_for,transaction_id&order=executed_at.desc&limit=30`;
let logsResponse;
try {
  logsResponse = await fetch(logUrl, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
} catch (error) {
  console.log("- log summary: failed to fetch");
  console.log(`  reason: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}

if (!logsResponse.ok) {
  const text = await logsResponse.text();
  console.log("- log summary: failed to fetch");
  console.log(`  status: ${logsResponse.status}`);
  console.log(`  body: ${text.slice(0, 300)}`);
  process.exit(0);
}

const logItems = await logsResponse.json();
if (!Array.isArray(logItems) || logItems.length === 0) {
  console.log("- log summary: no recent logs");
  process.exit(0);
}

let successCount = 0;
let failureCount = 0;
const reasonMap = new Map();

for (const item of logItems) {
  if (item.status === "success") {
    successCount += 1;
    continue;
  }

  if (item.status === "failed") {
    failureCount += 1;
    const reason =
      typeof item.error_message === "string" && item.error_message.trim()
        ? item.error_message.trim()
        : "사유 없음";
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
  }
}

const topReasons = [...reasonMap.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 3)
  .map(([reason, count]) => `${reason}${count > 1 ? ` (${count})` : ""}`);

console.log("- log summary:");
console.log(`  recent success: ${successCount}`);
console.log(`  recent failure: ${failureCount}`);
if (topReasons.length > 0) {
  console.log(`  top failure reasons: ${topReasons.join(" | ")}`);
} else {
  console.log("  top failure reasons: 없음");
}
