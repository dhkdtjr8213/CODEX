const args = new Set(process.argv.slice(2));
const applyMode = args.has("--apply");
const owner = (process.env.GITHUB_REPO_OWNER || "dhkdtjr8213").trim();
const repo = (process.env.GITHUB_REPO_NAME || "CODEX").trim();
const branch = (process.env.GITHUB_PROTECTED_BRANCH || "main").trim();
const token = (process.env.GITHUB_TOKEN || "").trim();

const requiredChecks = ["Typecheck", "Lint", "Smoke"];

const protectionPayload = {
  required_status_checks: {
    strict: true,
    contexts: requiredChecks
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 1,
    require_last_push_approval: false
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true,
  lock_branch: false,
  allow_fork_syncing: false
};

const summary = [
  `repo: ${owner}/${repo}`,
  `branch: ${branch}`,
  `required checks: ${requiredChecks.join(", ")}`,
  "require PR: yes (1 approval, stale approval dismiss)",
  "conversation resolution: yes",
  "direct push restriction: maintain via branch protection + admin enforcement"
];

console.log("GitHub branch protection setup");
for (const line of summary) {
  console.log(`- ${line}`);
}

if (!applyMode) {
  console.log("\n[dry-run] No remote changes were made.");
  console.log("Use --apply with GITHUB_TOKEN to apply settings.");
  process.exit(0);
}

if (!token) {
  console.error("Missing required env: GITHUB_TOKEN");
  process.exit(1);
}

const endpoint = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`;

let response;
try {
  response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(protectionPayload)
  });
} catch (error) {
  console.error("Failed to call GitHub API.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!response.ok) {
  const text = await response.text();
  console.error(`Failed to apply branch protection (status: ${response.status})`);
  console.error(text.slice(0, 1000));
  process.exit(1);
}

console.log("[ok] Branch protection applied successfully.");
