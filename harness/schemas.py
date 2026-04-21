from __future__ import annotations

import dataclasses
from typing import Any, Dict


@dataclasses.dataclass
class AgentResult:
    role: str
    status: str
    output_text: str
    output_file: str
    started_at: str
    finished_at: str


@dataclasses.dataclass
class TaskState:
    task_id: str
    goal: str
    created_at: str
    status: str = "created"
    artifacts: Dict[str, Any] = dataclasses.field(default_factory=dict)
    results: Dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)

