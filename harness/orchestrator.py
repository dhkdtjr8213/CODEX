from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
import textwrap
from typing import Any, Dict, List, Optional

from roles import (
    ARTIFACT_KEYS,
    PHASE_PARALLEL_BACKEND_DESIGNER,
    PHASE_PARALLEL_FRONTENDS,
    ROLE_HINTS,
)
from schemas import AgentResult, TaskState


ROOT = pathlib.Path(__file__).resolve().parents[1]
SKILLS_DIR = ROOT / ".agents" / "skills"
WORK_DIR = ROOT / "work" / "tasks"
DEPENDENCY_ORDER = [
    "packages/types",
    "packages/config",
    "packages/supabase",
    "packages/ui",
    "apps/web + apps/mobile",
]
ARTIFACT_ORDER = [
    "chief_kickoff",
    "task_breakdown",
    "spec",
    "types_lockdown",
    "backend",
    "designer",
    "frontend_web",
    "frontend_mobile",
    "tester",
    "reviewer",
    "security",
    "chief_final",
]
ROLE_ARTIFACT_SCOPE = {
    "deputy": ["chief_kickoff"],
    "planner": ["chief_kickoff", "task_breakdown"],
    "types": ["task_breakdown", "spec"],
    "backend": ["task_breakdown", "spec", "types_lockdown"],
    "designer": ["task_breakdown", "spec", "types_lockdown"],
    "frontend-web": ["spec", "types_lockdown", "backend", "designer"],
    "frontend-mobile": ["spec", "types_lockdown", "backend", "designer"],
    "tester": ["spec", "types_lockdown", "backend", "designer", "frontend_web", "frontend_mobile"],
    "reviewer": ["spec", "types_lockdown", "backend", "designer", "frontend_web", "frontend_mobile"],
    "security": ["spec", "types_lockdown", "backend", "designer", "frontend_web", "frontend_mobile"],
    # chief final decision only needs condensed upstream artifacts; kickoff has none yet.
    "chief": [
        "spec",
        "tester",
        "reviewer",
        "security",
    ],
}


def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def ensure_dir(path: pathlib.Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def save_text(path: pathlib.Path, content: str) -> None:
    ensure_dir(path.parent)
    path.write_text(content, encoding="utf-8")


def load_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def save_json(path: pathlib.Path, data: Dict[str, Any]) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: pathlib.Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_skill(role: str) -> str:
    skill_path = SKILLS_DIR / role / "SKILL.md"
    if not skill_path.exists():
        raise FileNotFoundError(f"SKILL.md not found for role '{role}': {skill_path}")
    return skill_path.read_text(encoding="utf-8")


def resolve_artifact_char_limit() -> int:
    raw = os.getenv("HARNESS_ARTIFACT_CHAR_LIMIT", "1800").strip()
    try:
        parsed = int(raw)
    except ValueError:
        return 1800
    return max(500, min(20000, parsed))


def clip_text(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return f"{value[:limit]}\n\n[truncated {len(value) - limit} chars]"


def resolve_role_timeout_sec() -> int:
    raw = os.getenv("HARNESS_ROLE_TIMEOUT_SEC", "90").strip()
    try:
        parsed = int(raw)
    except ValueError:
        return 90
    return max(30, min(900, parsed))


def resolve_max_consecutive_failures() -> int:
    raw = os.getenv("HARNESS_MAX_CONSECUTIVE_FAILURES", "3").strip()
    try:
        parsed = int(raw)
    except ValueError:
        return 3
    return max(0, min(12, parsed))


def resolve_disable_parallel() -> bool:
    return os.getenv("HARNESS_DISABLE_PARALLEL", "0").strip() == "1"


def task_dir(task_id: str) -> pathlib.Path:
    return WORK_DIR / task_id


def state_file(task_id: str) -> pathlib.Path:
    return task_dir(task_id) / "state.json"


def artifact_file(task_id: str, name: str) -> pathlib.Path:
    return task_dir(task_id) / "artifacts" / f"{name}.md"


def request_file(task_id: str, role: str) -> pathlib.Path:
    return task_dir(task_id) / "requests" / f"{role}.md"


def response_file(task_id: str, role: str) -> pathlib.Path:
    return task_dir(task_id) / "responses" / f"{role}.md"


def result_json_file(task_id: str, role: str) -> pathlib.Path:
    return task_dir(task_id) / "results" / f"{role}.json"


def build_context_block(state: TaskState) -> str:
    lines = [
        f"task_id: {state.task_id}",
        f"goal: {state.goal}",
        f"status: {state.status}",
        f"dependency_order: {' -> '.join(DEPENDENCY_ORDER)}",
    ]
    if state.artifacts:
        lines.append("artifacts:")
        for key in sorted(state.artifacts.keys()):
            lines.append(f"- {key}: present")
    if state.results:
        lines.append("results:")
        for role, result in state.results.items():
            lines.append(f"- {role}: {result.get('status', 'unknown')}")
    return "\n".join(lines)


def build_agent_input(state: TaskState, role: str) -> str:
    context = build_context_block(state)
    artifact_char_limit = resolve_artifact_char_limit()
    prior_artifacts = []
    scoped_artifacts = ROLE_ARTIFACT_SCOPE.get(role, ARTIFACT_ORDER)
    for key in scoped_artifacts:
        if key in state.artifacts:
            clipped = clip_text(state.artifacts[key], artifact_char_limit)
            prior_artifacts.append(f"\n## {key}\n{clipped}")

    hint = ROLE_HINTS.get(role, "Respect role scope and return structured output.")

    payload = f"""
# ROLE
{role}

# CONTEXT
{context}

# ROLE_HINT
{hint}

# PROJECT_GOAL
{state.goal}

# AVAILABLE_ARTIFACTS
{''.join(prior_artifacts) if prior_artifacts else 'No prior artifacts yet.'}

# INSTRUCTIONS
- Respect your role scope.
- Do not invent hidden assumptions without labeling them.
- Be explicit about risks and handoff needs.
- Respect monorepo dependency order.
- Return only the structured output promised by your role skill.
"""
    return textwrap.dedent(payload).strip()


class BaseRunner:
    def run(self, task_id: str, role: str, skill_text: str, input_text: str) -> AgentResult:
        raise NotImplementedError


class MockRunner(BaseRunner):
    def run(self, task_id: str, role: str, skill_text: str, input_text: str) -> AgentResult:
        started = now_iso()
        output = (
            "1. summary\n"
            f"Mock output for role={role}\n\n"
            "2. details\n"
            "This is a placeholder response.\n\n"
            "3. note\n"
            "Replace MockRunner with AGENT_RUNNER_CMD integration."
        )
        out_file = response_file(task_id, role)
        save_text(out_file, output)
        finished = now_iso()
        result = AgentResult(
            role=role,
            status="success",
            output_text=output,
            output_file=str(out_file),
            started_at=started,
            finished_at=finished,
        )
        save_json(result_json_file(task_id, role), result.__dict__)
        return result


class CommandRunner(BaseRunner):
    """
    Set AGENT_RUNNER_CMD with placeholders:
    {role}, {input_file}, {output_file}, {skill_file}, {task_id}
    """

    def __init__(self, command_template: str, timeout_sec: int):
        self.command_template = command_template
        self.timeout_sec = timeout_sec

    def run(self, task_id: str, role: str, skill_text: str, input_text: str) -> AgentResult:
        started = now_iso()
        req_file = request_file(task_id, role)
        out_file = response_file(task_id, role)
        skill_file = task_dir(task_id) / "skills_snapshot" / f"{role}.md"
        save_text(skill_file, skill_text)
        save_text(req_file, input_text)

        command = self.command_template.format(
            role=role,
            input_file=str(req_file),
            output_file=str(out_file),
            skill_file=str(skill_file),
            task_id=task_id,
        )

        process = subprocess.Popen(
            command,
            shell=True,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        try:
            stdout, stderr = process.communicate(timeout=self.timeout_sec)
            completed = subprocess.CompletedProcess(
                args=command,
                returncode=process.returncode or 0,
                stdout=stdout,
                stderr=stderr,
            )
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                    capture_output=True,
                    text=True,
                )
            else:
                process.kill()

            try:
                stdout, stderr = process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                stdout = ""
                stderr = ""

            error_output = (
                f"Runner command timed out for role={role}\n"
                f"Timeout sec: {self.timeout_sec}\n"
                f"Partial STDOUT:\n{stdout or ''}\n"
                f"Partial STDERR:\n{stderr or ''}\n"
            )
            save_text(out_file, error_output)
            finished = now_iso()
            result = AgentResult(
                role=role,
                status="failed",
                output_text=error_output,
                output_file=str(out_file),
                started_at=started,
                finished_at=finished,
            )
            save_json(result_json_file(task_id, role), result.__dict__)
            return result

        if completed.returncode != 0:
            error_output = (
                f"Runner command failed for role={role}\n"
                f"Return code: {completed.returncode}\n"
                f"STDOUT:\n{completed.stdout}\n"
                f"STDERR:\n{completed.stderr}\n"
            )
            save_text(out_file, error_output)
            finished = now_iso()
            result = AgentResult(
                role=role,
                status="failed",
                output_text=error_output,
                output_file=str(out_file),
                started_at=started,
                finished_at=finished,
            )
            save_json(result_json_file(task_id, role), result.__dict__)
            return result

        if not out_file.exists():
            save_text(out_file, "Runner finished but no output file was created.")

        output_text = load_text(out_file)
        finished = now_iso()
        result = AgentResult(
            role=role,
            status="success",
            output_text=output_text,
            output_file=str(out_file),
            started_at=started,
            finished_at=finished,
        )
        save_json(result_json_file(task_id, role), result.__dict__)
        return result


class Orchestrator:
    def __init__(self, runner: BaseRunner):
        self.runner = runner
        self.max_consecutive_failures = resolve_max_consecutive_failures()
        self.disable_parallel = resolve_disable_parallel()

    def init_task(self, task_id: str, goal: str) -> TaskState:
        ensure_dir(task_dir(task_id))
        state = TaskState(task_id=task_id, goal=goal, created_at=now_iso(), status="initialized")
        save_json(state_file(task_id), state.to_dict())
        return state

    def save_state(self, state: TaskState) -> None:
        save_json(state_file(state.task_id), state.to_dict())

    def run_role(self, state: TaskState, role: str, artifact_key: Optional[str] = None) -> AgentResult:
        skill_text = load_skill(role)
        input_text = build_agent_input(state, role)
        result = self.runner.run(state.task_id, role, skill_text, input_text)
        state.results[role] = result.__dict__
        if result.status == "success" and artifact_key:
            state.artifacts[artifact_key] = result.output_text
            save_text(artifact_file(state.task_id, artifact_key), result.output_text)
        self.save_state(state)
        return result

    def run_parallel(self, state: TaskState, roles: List[str]) -> Dict[str, AgentResult]:
        outputs: Dict[str, AgentResult] = {}

        if self.disable_parallel or len(roles) <= 1:
            for role in roles:
                outputs[role] = self.run_role(state, role, artifact_key=ARTIFACT_KEYS[role])
            return outputs

        def _run(role: str) -> AgentResult:
            return self.run_role(state, role, artifact_key=ARTIFACT_KEYS[role])

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(roles)) as executor:
            future_map = {executor.submit(_run, role): role for role in roles}
            for future in concurrent.futures.as_completed(future_map):
                role = future_map[future]
                outputs[role] = future.result()

        return outputs

    def should_abort_after_failures(self, consecutive_failures: int) -> bool:
        if self.max_consecutive_failures <= 0:
            return False
        return consecutive_failures >= self.max_consecutive_failures

    def stop_early(self, state: TaskState, reason: str) -> TaskState:
        state.status = "failed"
        state.results["orchestrator"] = {
            "role": "orchestrator",
            "status": "failed",
            "output_text": reason,
            "finished_at": now_iso(),
        }
        self.save_state(state)
        return state

    def execute(self, task_id: str, goal: str) -> TaskState:
        state = self.init_task(task_id, goal)
        state.status = "running"
        self.save_state(state)
        consecutive_failures = 0

        def track(result: AgentResult) -> bool:
            nonlocal consecutive_failures
            if result.status == "success":
                consecutive_failures = 0
            else:
                consecutive_failures += 1
            return self.should_abort_after_failures(consecutive_failures)

        # 1) chief kickoff
        result = self.run_role(state, "chief", artifact_key=ARTIFACT_KEYS["chief_kickoff"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: chief"
                ),
            )

        # 2) deputy breakdown
        result = self.run_role(state, "deputy", artifact_key=ARTIFACT_KEYS["task_breakdown"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: deputy"
                ),
            )

        # 3) planner specification
        result = self.run_role(state, "planner", artifact_key=ARTIFACT_KEYS["spec"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: planner"
                ),
            )

        # 4) types lockdown
        result = self.run_role(state, "types", artifact_key=ARTIFACT_KEYS["types"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: types"
                ),
            )

        # 5) backend + designer in parallel
        results = self.run_parallel(state, PHASE_PARALLEL_BACKEND_DESIGNER)
        for role in PHASE_PARALLEL_BACKEND_DESIGNER:
            result = results.get(role)
            if not result:
                continue
            if track(result):
                return self.stop_early(
                    state,
                    (
                        "Stopped early due to consecutive role failures.\n"
                        f"- threshold: {self.max_consecutive_failures}\n"
                        f"- last_role: {role}"
                    ),
                )

        # 6) web + mobile frontend in parallel
        results = self.run_parallel(state, PHASE_PARALLEL_FRONTENDS)
        for role in PHASE_PARALLEL_FRONTENDS:
            result = results.get(role)
            if not result:
                continue
            if track(result):
                return self.stop_early(
                    state,
                    (
                        "Stopped early due to consecutive role failures.\n"
                        f"- threshold: {self.max_consecutive_failures}\n"
                        f"- last_role: {role}"
                    ),
                )

        # 7) gates
        result = self.run_role(state, "tester", artifact_key=ARTIFACT_KEYS["tester"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: tester"
                ),
            )
        result = self.run_role(state, "reviewer", artifact_key=ARTIFACT_KEYS["reviewer"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: reviewer"
                ),
            )
        result = self.run_role(state, "security", artifact_key=ARTIFACT_KEYS["security"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: security"
                ),
            )

        # 8) chief final decision
        result = self.run_role(state, "chief", artifact_key=ARTIFACT_KEYS["chief_final"])
        if track(result):
            return self.stop_early(
                state,
                (
                    "Stopped early due to consecutive role failures.\n"
                    f"- threshold: {self.max_consecutive_failures}\n"
                    f"- last_role: chief_final"
                ),
            )

        state.status = "completed"
        self.save_state(state)
        return state


def build_default_task_id() -> str:
    return dt.datetime.now().strftime("LEDGER-%Y%m%d-%H%M%S")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Multi-agent Codex orchestration harness")
    parser.add_argument("goal", type=str, help="Top-level goal for the team")
    parser.add_argument("--task-id", type=str, default=build_default_task_id(), help="Task ID")
    parser.add_argument("--mock", action="store_true", help="Use mock runner")
    return parser.parse_args()


def build_runner(use_mock: bool) -> BaseRunner:
    if use_mock:
        return MockRunner()
    cmd = os.getenv("AGENT_RUNNER_CMD", "").strip()
    if not cmd:
        print(
            "AGENT_RUNNER_CMD is not set.\n"
            "Use --mock or set AGENT_RUNNER_CMD for real integration.",
            file=sys.stderr,
        )
        sys.exit(1)
    return CommandRunner(cmd, timeout_sec=resolve_role_timeout_sec())


def main() -> None:
    args = parse_args()
    runner = build_runner(args.mock)
    orchestrator = Orchestrator(runner)
    state = orchestrator.execute(task_id=args.task_id, goal=args.goal)
    print(f"[DONE] task_id={state.task_id}")
    print(f"state: {state_file(state.task_id)}")
    print(f"artifacts: {task_dir(state.task_id) / 'artifacts'}")
    print(f"responses: {task_dir(state.task_id) / 'responses'}")


if __name__ == "__main__":
    main()
