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
    prior_artifacts = []
    artifact_order = [
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
    for key in artifact_order:
        if key in state.artifacts:
            prior_artifacts.append(f"\n## {key}\n{state.artifacts[key]}")

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

    def __init__(self, command_template: str):
        self.command_template = command_template

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

        completed = subprocess.run(
            command,
            shell=True,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )

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

        def _run(role: str) -> AgentResult:
            return self.run_role(state, role, artifact_key=ARTIFACT_KEYS[role])

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(roles)) as executor:
            future_map = {executor.submit(_run, role): role for role in roles}
            for future in concurrent.futures.as_completed(future_map):
                role = future_map[future]
                outputs[role] = future.result()

        return outputs

    def execute(self, task_id: str, goal: str) -> TaskState:
        state = self.init_task(task_id, goal)
        state.status = "running"
        self.save_state(state)

        # 1) chief kickoff
        self.run_role(state, "chief", artifact_key=ARTIFACT_KEYS["chief_kickoff"])

        # 2) deputy breakdown
        self.run_role(state, "deputy", artifact_key=ARTIFACT_KEYS["task_breakdown"])

        # 3) planner specification
        self.run_role(state, "planner", artifact_key=ARTIFACT_KEYS["spec"])

        # 4) types lockdown
        self.run_role(state, "types", artifact_key=ARTIFACT_KEYS["types"])

        # 5) backend + designer in parallel
        self.run_parallel(state, PHASE_PARALLEL_BACKEND_DESIGNER)

        # 6) web + mobile frontend in parallel
        self.run_parallel(state, PHASE_PARALLEL_FRONTENDS)

        # 7) gates
        self.run_role(state, "tester", artifact_key=ARTIFACT_KEYS["tester"])
        self.run_role(state, "reviewer", artifact_key=ARTIFACT_KEYS["reviewer"])
        self.run_role(state, "security", artifact_key=ARTIFACT_KEYS["security"])

        # 8) chief final decision
        self.run_role(state, "chief", artifact_key=ARTIFACT_KEYS["chief_final"])

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
    return CommandRunner(cmd)


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
