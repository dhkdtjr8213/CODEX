import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

function canRunPython(bin) {
  const probe = spawnSync(bin, ["-V"], {
    shell: false,
    encoding: "utf8",
  });
  return !probe.error && probe.status === 0;
}

function resolvePythonBin() {
  const explicit = process.env.PYTHON_BIN?.trim();
  const candidates = [];
  if (explicit) candidates.push(explicit);
  candidates.push("C:\\Python314\\python.exe", "C:\\WINDOWS\\py.exe", "python", "py");

  for (const candidate of candidates) {
    const isPathCandidate = candidate.includes("\\") || candidate.includes("/");
    if (isPathCandidate && !existsSync(candidate)) {
      continue;
    }
    if (canRunPython(candidate)) {
      return candidate;
    }
  }
  return null;
}

const pythonBin = resolvePythonBin();
const provider = (process.env.AGENT_PROVIDER || "openai_responses").trim();
const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
const hasAgentApiKey = Boolean(process.env.AGENT_API_KEY?.trim());
const hasGeminiApiKey = Boolean(
  process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
);
const allowFallback = (process.env.HARNESS_ALLOW_FALLBACK || "").trim() === "1";
const quickMode = (process.env.HARNESS_QUICK_MODE || "1").trim() !== "0";
const goal = process.env.HARNESS_GOAL?.trim() || "harness runner connectivity check";
const compactMode = (process.env.AGENT_COMPACT_MODE || "1").trim();
const maxOutputTokensForHarness = (() => {
  const explicit = (process.env.HARNESS_MAX_OUTPUT_TOKENS || "").trim();
  if (explicit) return explicit;
  const existing = (process.env.AGENT_MAX_OUTPUT_TOKENS || "").trim();
  if (existing) return existing;
  if (provider === "openai_compatible_chat" && compactMode === "1") {
    return "32";
  }
  return "";
})();
const disableParallelForHarness = (() => {
  const explicit = (process.env.HARNESS_DISABLE_PARALLEL || "").trim();
  if (explicit) return explicit;
  if (provider === "openai_compatible_chat") {
    return "1";
  }
  return "0";
})();
const artifactCharLimitForHarness = (() => {
  const explicit = (process.env.HARNESS_ARTIFACT_CHAR_LIMIT || "").trim();
  if (explicit) return explicit;
  if (provider === "openai_compatible_chat") {
    return "480";
  }
  return "";
})();
const fullModeTimeoutMsRaw = (process.env.HARNESS_FULL_TIMEOUT_MS || "900000").trim();
const fullModeTimeoutMs = Number.isFinite(Number(fullModeTimeoutMsRaw))
  ? Math.max(60_000, Math.min(3_600_000, Number(fullModeTimeoutMsRaw)))
  : 900_000;

const providerHasCredential = (() => {
  if (provider === "gemini_generate_content") {
    return hasGeminiApiKey;
  }
  if (provider === "openai_compatible_chat") {
    // local openai-compatible servers may not require a key
    return hasAgentApiKey || hasOpenAiKey;
  }
  return hasAgentApiKey || hasOpenAiKey;
})();

if (!pythonBin) {
  console.error("[fail] Python runtime not found. Set PYTHON_BIN or install python/py launcher.");
  process.exit(1);
}

const runnerCmd = `${pythonBin} harness/codex_runner.py --role {role} --skill {skill_file} --input {input_file} --output {output_file}`;

function warmupRunner() {
  const tempDir = mkdtempSync(resolve(tmpdir(), "harness-warmup-"));
  const skillFile = resolve(tempDir, "skill.md");
  const inputFile = resolve(tempDir, "input.md");
  const outputFile = resolve(tempDir, "output.md");

  writeFileSync(
    skillFile,
    `---
name: warmup-check
description: warmup call before full orchestration
---

Return exactly:
1. summary
2. note`,
    "utf8"
  );
  writeFileSync(
    inputFile,
    "1. summary\nwarmup\n2. note\nok",
    "utf8"
  );

  const warmup = spawnSync(
    pythonBin,
    [
      "harness/codex_runner.py",
      "--role",
      "warmup-check",
      "--skill",
      skillFile,
      "--input",
      inputFile,
      "--output",
      outputFile,
    ],
    {
      shell: false,
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_COMPACT_MODE: compactMode,
        ...(maxOutputTokensForHarness
          ? { AGENT_MAX_OUTPUT_TOKENS: maxOutputTokensForHarness }
          : {}),
        HARNESS_DISABLE_PARALLEL: disableParallelForHarness,
      },
    }
  );

  const output = existsSync(outputFile) ? readFileSync(outputFile, "utf8") : "";
  const fallback = output.includes("fallback response");

  rmSync(tempDir, { recursive: true, force: true });

  if (warmup.error) {
    return { ok: false, note: warmup.error.message, fallback };
  }
  if (warmup.status !== 0) {
    return {
      ok: false,
      note: (warmup.stderr || warmup.stdout || "unknown warmup failure").trim(),
      fallback,
    };
  }
  return { ok: true, note: "ok", fallback };
}

if (quickMode) {
  const tempDir = mkdtempSync(resolve(tmpdir(), "harness-check-"));
  const skillFile = resolve(tempDir, "skill.md");
  const inputFile = resolve(tempDir, "input.md");
  const outputFile = resolve(tempDir, "output.md");
  writeFileSync(
    skillFile,
    `---
name: quick-check
description: quick connectivity check
---

Return exactly:
1. summary
2. note`,
    "utf8"
  );
  writeFileSync(
    inputFile,
    "1. summary\n간단 연결 테스트\n\n2. note\n`ok` 한 줄만 반환",
    "utf8"
  );

  const oneShot = spawnSync(
    pythonBin,
    [
      "harness/codex_runner.py",
      "--role",
      "quick-check",
      "--skill",
      skillFile,
      "--input",
      inputFile,
      "--output",
      outputFile,
    ],
    {
      shell: false,
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_COMPACT_MODE: compactMode,
        ...(maxOutputTokensForHarness
          ? { AGENT_MAX_OUTPUT_TOKENS: maxOutputTokensForHarness }
          : {}),
      },
    }
  );

  if (oneShot.error) {
    console.error("[fail] Failed to execute codex_runner.");
    console.error(oneShot.error.message);
    process.exit(1);
  }

  if (oneShot.status !== 0) {
    console.error("[fail] codex_runner exited with non-zero code.");
    console.error(oneShot.stdout || "");
    console.error(oneShot.stderr || "");
    process.exit(1);
  }

  const output = existsSync(outputFile) ? readFileSync(outputFile, "utf8") : "";
  const fallback = output.includes("fallback response");
  console.log("Harness runner quick check");
  console.log(`- provider: ${provider}`);
  console.log(`- provider_credential_present: ${providerHasCredential ? "yes" : "no"}`);
  console.log(`- allow_fallback: ${allowFallback ? "yes" : "no"}`);
  console.log(`- quick_mode: yes`);
  console.log(`- fallback_output: ${fallback ? "yes" : "no"}`);

  rmSync(tempDir, { recursive: true, force: true });

  if (!allowFallback && providerHasCredential && fallback) {
    console.error("[fail] Provider credential exists but fallback output was detected.");
    process.exit(1);
  }

  if (!providerHasCredential) {
    console.log("[warn] Provider credential missing. Fallback mode validation only.");
  }
  if (allowFallback) {
    console.log("[warn] HARNESS_ALLOW_FALLBACK=1 set. Fallback outputs are allowed.");
  }
  console.log("[ok] Harness runner quick check completed.");
  process.exit(0);
}

const warmup = warmupRunner();
if (!warmup.ok) {
  console.log("[warn] Warmup call did not complete cleanly. Continuing full check.");
  console.log(`- warmup_note: ${warmup.note}`);
} else if (warmup.fallback) {
  console.log("[warn] Warmup produced fallback output. Continuing full check.");
} else {
  console.log("[ok] Warmup call completed.");
}

const runResult = spawnSync(
  pythonBin,
  ["harness/orchestrator.py", goal],
  {
    env: {
      ...process.env,
      AGENT_COMPACT_MODE: compactMode,
      ...(maxOutputTokensForHarness
        ? { AGENT_MAX_OUTPUT_TOKENS: maxOutputTokensForHarness }
        : {}),
      HARNESS_DISABLE_PARALLEL: disableParallelForHarness,
      ...(artifactCharLimitForHarness
        ? { HARNESS_ARTIFACT_CHAR_LIMIT: artifactCharLimitForHarness }
        : {}),
      AGENT_RUNNER_CMD: runnerCmd
    },
    shell: false,
    encoding: "utf8",
    timeout: fullModeTimeoutMs,
  }
);

if (runResult.error) {
  if (runResult.error.code === "ETIMEDOUT") {
    console.error("[fail] Orchestrator timed out.");
    console.error(`- timeout_ms: ${fullModeTimeoutMs}`);
    console.error(
      "- hint: increase HARNESS_FULL_TIMEOUT_MS or lower HARNESS_ROLE_TIMEOUT_SEC to fail fast per role."
    );
    process.exit(1);
  }
  console.error("[fail] Failed to execute orchestrator.");
  console.error(runResult.error.message);
  process.exit(1);
}

if (runResult.status !== 0) {
  console.error("[fail] Orchestrator failed.");
  console.error(runResult.stdout || "");
  console.error(runResult.stderr || "");
  process.exit(1);
}

const stdout = runResult.stdout || "";
const match = stdout.match(/task_id=([A-Z0-9-]+)/);
if (!match) {
  console.error("[fail] Could not parse task_id from orchestrator output.");
  console.error(stdout);
  process.exit(1);
}

const taskId = match[1];
const statePath = resolve("work", "tasks", taskId, "state.json");
if (!existsSync(statePath)) {
  console.error(`[fail] state.json not found: ${statePath}`);
  process.exit(1);
}

const state = JSON.parse(readFileSync(statePath, "utf8"));
if (state.status !== "completed") {
  console.error("[fail] Harness task did not complete.");
  console.error(`- state: ${state.status}`);
  const orchestratorResult = state.results?.orchestrator;
  if (orchestratorResult?.output_text) {
    console.error("- reason:");
    console.error(orchestratorResult.output_text);
  }
  process.exit(1);
}
const outputs = Object.values(state.artifacts ?? {}).filter((v) => typeof v === "string");
const fallbackCount = outputs.filter((text) => text.includes("fallback response")).length;

console.log(`Harness runner check`);
console.log(`- task_id: ${taskId}`);
console.log(`- state: ${state.status}`);
console.log(`- fallback_outputs: ${fallbackCount}`);
console.log(`- provider: ${provider}`);
console.log(`- provider_credential_present: ${providerHasCredential ? "yes" : "no"}`);
console.log(`- allow_fallback: ${allowFallback ? "yes" : "no"}`);
console.log(`- quick_mode: no`);

if (!allowFallback && providerHasCredential && fallbackCount > 0) {
  console.error("[fail] Provider credential exists but fallback outputs were detected.");
  process.exit(1);
}

if (!providerHasCredential) {
  console.log("[warn] Provider credential missing. Fallback mode validation only.");
}

if (allowFallback) {
  console.log("[warn] HARNESS_ALLOW_FALLBACK=1 set. Fallback outputs are allowed.");
}

console.log("[ok] Harness runner check completed.");
