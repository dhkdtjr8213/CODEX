import { createClient } from "jsr:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function toJson(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

function readLimit(req: Request): number {
  const url = new URL(req.url);
  const queryLimit = url.searchParams.get("limit");
  const parsed = queryLimit ? Number(queryLimit) : 100;

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(1, Math.min(1000, Math.trunc(parsed)));
}

function readDryRun(req: Request): boolean {
  const url = new URL(req.url);
  const value = url.searchParams.get("dry_run");
  return value === "1" || value === "true";
}

async function run(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return toJson(405, { ok: false, message: "Method Not Allowed" });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const incomingSecret = req.headers.get("x-cron-secret");
    if (incomingSecret !== cronSecret) {
      return toJson(401, { ok: false, message: "Unauthorized" });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, {
      ok: false,
      message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const limit = readLimit(req);
  const dryRun = readDryRun(req);

  if (dryRun) {
    const [countResult, previewResult] = await Promise.all([
      supabase
        .from("recurring_transactions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .lte("next_run_at", new Date().toISOString()),
      supabase
        .from("recurring_transactions")
        .select("id,next_run_at,type,amount")
        .eq("is_active", true)
        .lte("next_run_at", new Date().toISOString())
        .order("next_run_at", { ascending: true })
        .limit(Math.min(limit, 10))
    ]);

    if (countResult.error) {
      return toJson(500, {
        ok: false,
        dryRun: true,
        message: "Failed to count due recurring transactions",
        error: countResult.error.message
      });
    }

    if (previewResult.error) {
      return toJson(500, {
        ok: false,
        dryRun: true,
        message: "Failed to fetch due recurring transaction preview",
        error: previewResult.error.message
      });
    }

    return toJson(200, {
      ok: true,
      dryRun: true,
      limit,
      dueCount: countResult.count ?? 0,
      preview: previewResult.data ?? []
    });
  }

  const { data, error } = await supabase.rpc("run_due_recurring_transactions", {
    p_limit: limit
  });

  if (error) {
    return toJson(500, {
      ok: false,
      message: "Failed to execute recurring batch",
      error: error.message
    });
  }

  const result = Array.isArray(data) && data.length > 0 ? data[0] : null;

  return toJson(200, {
    ok: true,
    limit,
    result
  });
}

Deno.serve(run);
