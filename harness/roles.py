from __future__ import annotations

ROLE_ORDER = [
    "chief",
    "deputy",
    "planner",
    "types",
    "backend",
    "frontend-web",
    "frontend-mobile",
    "designer",
    "tester",
    "reviewer",
    "security",
]

PHASE_PARALLEL_BACKEND_DESIGNER = ["backend", "designer"]
PHASE_PARALLEL_FRONTENDS = ["frontend-web", "frontend-mobile"]

ARTIFACT_KEYS = {
    "chief_kickoff": "chief_kickoff",
    "task_breakdown": "task_breakdown",
    "spec": "spec",
    "types": "types_lockdown",
    "backend": "backend",
    "designer": "designer",
    "frontend-web": "frontend_web",
    "frontend-mobile": "frontend_mobile",
    "tester": "tester",
    "reviewer": "reviewer",
    "security": "security",
    "chief_final": "chief_final",
}

ROLE_HINTS = {
    "chief": "Make an executive decision. Evaluate readiness and gates.",
    "deputy": "Break goals into atomic tasks with dependencies and ownership.",
    "planner": "Write implementation-ready spec with edge cases and acceptance criteria.",
    "types": "Lock shared contracts in packages/types and packages/config first.",
    "backend": "Implement Supabase-side logic/migrations after type contracts are locked.",
    "frontend-web": "Implement only apps/web with Next.js App Router conventions.",
    "frontend-mobile": "Implement only apps/mobile with Expo/RN conventions.",
    "designer": "Provide implementation-friendly UI/tokens/UX guidance for packages/ui.",
    "tester": "Provide explicit pass/fail test evidence and reproducible defects.",
    "reviewer": "Separate blocking and non-blocking maintainability concerns.",
    "security": "Apply Supabase-specific security checks and severity classification.",
}

