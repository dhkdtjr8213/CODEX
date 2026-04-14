import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const CORE_TEXTS = [
  "반복배치 실행 로그",
  "실패 사유 검색",
  "필터 초기화",
  "최근 7일 요약"
];

const CASES = [
  {
    label: "baseline",
    path: "/",
    fetchChecks: [
      { label: "section title", kind: "includes", value: "반복배치 실행 로그" },
      { label: "search filter", kind: "includes", value: "실패 사유 검색" }
    ],
    domChecks: []
  },
  {
    label: "query filter",
    path: "/?rff_q=%EC%82%AC%EC%9C%A0",
    fetchChecks: [
      { label: "section title", kind: "includes", value: "반복배치 실행 로그" },
      { label: "search filter", kind: "includes", value: "실패 사유 검색" }
    ],
    domChecks: [{ label: "query input value", kind: "regex", value: /<input[^>]*value="사유"/i }]
  },
  {
    label: "period filter",
    path: "/?rff_p=7d",
    fetchChecks: [
      { label: "section title", kind: "includes", value: "반복배치 실행 로그" },
      { label: "period filter", kind: "includes", value: "최근 7일 요약" }
    ],
    domChecks: [
      {
        label: "selected period option",
        kind: "regex",
        value: /<option[^>]*value="7d"[^>]*selected|selected[^>]*value="7d"/i
      }
    ]
  },
  {
    label: "combined filters",
    path: "/?rff_q=%EC%82%AC%EC%9C%A0&rff_p=30d&rff_s=with_reason",
    fetchChecks: [
      { label: "section title", kind: "includes", value: "반복배치 실행 로그" },
      { label: "summary block", kind: "includes", value: "최근 7일 요약" }
    ],
    domChecks: [
      { label: "query input value", kind: "regex", value: /<input[^>]*value="사유"/i },
      {
        label: "selected period option",
        kind: "regex",
        value: /<option[^>]*value="30d"[^>]*selected|selected[^>]*value="30d"/i
      },
      {
        label: "selected reason-state option",
        kind: "regex",
        value: /<option[^>]*value="with_reason"[^>]*selected|selected[^>]*value="with_reason"/i
      }
    ]
  }
];

const BASE_URL_FROM_ENV = process.env.BASE_URL?.trim() || "";
const DEFAULT_BASE_URL = "http://localhost:3000";
const FETCH_TIMEOUT_MS = Number(process.env.HARNESS_FETCH_TIMEOUT_MS ?? 12000);
const DOM_TIMEOUT_MS = Number(process.env.HARNESS_DOM_TIMEOUT_MS ?? 15000);
const FORCE_FETCH_ONLY = process.env.HARNESS_FETCH_ONLY === "1";

function toUrl(baseUrl, path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function findBrowserExecutable() {
  const directCandidates = [
    process.env.CHROME_PATH?.trim(),
    process.env.EDGE_PATH?.trim(),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const candidate of directCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const whereCandidates = ["chrome", "chrome.exe", "msedge", "msedge.exe"];
  for (const candidate of whereCandidates) {
    const result = spawnSync("where.exe", [candidate], {
      encoding: "utf8",
      shell: false
    });

    if (result.status === 0) {
      const resolved = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      if (resolved && existsSync(resolved)) {
        return resolved;
      }
    }
  }

  return null;
}

function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  return fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeout);
  });
}

function dumpDomWithBrowser(browserPath, url) {
  const attempts = [
    ["--headless=new"],
    ["--headless"]
  ];

  let lastError = "";

  for (const headlessArgs of attempts) {
    const result = spawnSync(
      browserPath,
      [
        ...headlessArgs,
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=6000",
        "--dump-dom",
        url
      ],
      {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        timeout: DOM_TIMEOUT_MS,
        shell: false
      }
    );

    if (result.status === 0 && typeof result.stdout === "string" && result.stdout.trim().length > 0) {
      return {
        dom: result.stdout,
        mode: headlessArgs.join(" ")
      };
    }

    lastError = [
      result.error?.message,
      result.stderr?.trim(),
      `exit code: ${result.status ?? "unknown"}`
    ]
      .filter(Boolean)
      .join(" | ");
  }

  throw new Error(lastError || "Failed to dump DOM with browser.");
}

function evaluateChecks(source, checks) {
  const failures = [];

  for (const check of checks) {
    const passed =
      check.kind === "includes" ? source.includes(check.value) : check.value.test(source);

    if (!passed) {
      failures.push(check.label);
    }
  }

  return failures;
}

async function main() {
  const baseUrl = await resolveBaseUrl();

  console.log("Web recurring filter URL harness");
  console.log(`- baseUrl: ${baseUrl}`);
  console.log(`- core texts: ${CORE_TEXTS.join(" | ")}`);

  const browserPath = findBrowserExecutable();
  const useBrowserChecks = Boolean(browserPath) && !FORCE_FETCH_ONLY;

  if (useBrowserChecks && browserPath) {
    console.log(`- browser: ${browserPath}`);
  } else if (FORCE_FETCH_ONLY) {
    console.log("- browser: forced fetch-only mode");
  } else {
    console.log("- browser: unavailable, falling back to fetch-only checks");
  }

  const failures = [];

  for (const testCase of CASES) {
    const url = toUrl(baseUrl, testCase.path);
    let status = "fetch-error";
    let finalUrl = url;
    let body = "";
    let domSource = "";
    let domMode = "fetch";

    try {
      const response = await fetchPage(url);
      status = `${response.status}`;
      finalUrl = response.url;
      body = await response.text();

      if (!response.ok) {
        console.error(`- [fail] ${testCase.label}: received HTTP ${response.status} for ${url}`);
        failures.push(`${testCase.label}: HTTP ${response.status}`);
        continue;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`- [fail] ${testCase.label}: fetch failed for ${url}`);
      console.error(`  ${message}`);
      failures.push(`${testCase.label}: fetch failed`);
      continue;
    }

    if (useBrowserChecks && browserPath) {
      try {
        const result = dumpDomWithBrowser(browserPath, url);
        domSource = result.dom;
        domMode = result.mode;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`- [fail] ${testCase.label}: browser DOM dump failed for ${url}`);
        console.error(`  ${message}`);
        failures.push(`${testCase.label}: browser DOM dump failed`);
        continue;
      }
    } else {
      domSource = body;
    }

    const bodyFailures = evaluateChecks(body, testCase.fetchChecks);
    const domFailures = useBrowserChecks ? evaluateChecks(domSource, testCase.domChecks) : [];
    const missing = [...new Set([...bodyFailures, ...domFailures])];
    const checkCount =
      testCase.fetchChecks.length +
      (useBrowserChecks ? testCase.domChecks.length : 0) -
      missing.length;

    console.log(`- [${status}] ${testCase.label}`);
    console.log(`  url: ${finalUrl}`);
    console.log(`  mode: ${domMode}`);
    console.log(
      `  checks: ${checkCount}/${testCase.fetchChecks.length + (useBrowserChecks ? testCase.domChecks.length : 0)} passed`
    );

    if (missing.length > 0) {
      console.log(`  missing: ${missing.join(", ")}`);
      failures.push(`${testCase.label}: ${missing.join(", ")}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nWeb recurring filter URL harness failed.");
    console.error(`- failed cases: ${failures.join(" | ")}`);
    process.exit(1);
  }

  console.log("\nWeb recurring filter URL harness completed successfully.");
}

async function resolveBaseUrl() {
  if (BASE_URL_FROM_ENV) {
    return BASE_URL_FROM_ENV.replace(/\/$/, "");
  }

  const candidates = Array.from({ length: 11 }, (_, index) => `http://localhost:${3000 + index}`);

  for (const candidate of candidates) {
    try {
      const response = await fetchPage(candidate);
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Keep probing candidates.
    }
  }

  return DEFAULT_BASE_URL;
}

main().catch((error) => {
  console.error("Web recurring filter URL harness crashed.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
