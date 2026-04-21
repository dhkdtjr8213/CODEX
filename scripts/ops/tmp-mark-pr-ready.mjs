const repoOwner = "dhkdtjr8213";
const repoName = "CODEX";
const prNumber = 1;

const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
if (!token) {
  console.error("[fail] Missing GITHUB_TOKEN (or GH_TOKEN).");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "User-Agent": "codex-cli",
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
};

async function graphQL(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const payload = await res.json();
  if (!res.ok || payload.errors) {
    const message = payload.errors
      ? JSON.stringify(payload.errors)
      : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return payload.data;
}

try {
  const data = await graphQL(
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          id
          isDraft
          url
        }
      }
    }`,
    { owner: repoOwner, name: repoName, number: prNumber }
  );

  const pr = data?.repository?.pullRequest;
  if (!pr) {
    console.error("[fail] Pull request not found.");
    process.exit(1);
  }

  if (!pr.isDraft) {
    console.log(`[ok] already ready: ${pr.url}`);
    process.exit(0);
  }

  const updated = await graphQL(
    `mutation($id: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $id }) {
        pullRequest {
          isDraft
          url
        }
      }
    }`,
    { id: pr.id }
  );

  const changed = updated?.markPullRequestReadyForReview?.pullRequest;
  if (changed && !changed.isDraft) {
    console.log(`[ok] ready: ${changed.url}`);
    process.exit(0);
  }

  console.error("[fail] Mutation completed but PR is still draft.");
  process.exit(1);
} catch (error) {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
}
