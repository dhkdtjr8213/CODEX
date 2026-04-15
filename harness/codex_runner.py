from __future__ import annotations

import argparse
import json
import os
import pathlib
import textwrap
import urllib.error
import urllib.parse
import urllib.request


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Codex runner for orchestrator integration")
    parser.add_argument("--role", required=True)
    parser.add_argument("--skill", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def load_text(path: str) -> str:
    return pathlib.Path(path).read_text(encoding="utf-8")


def save_text(path: str, content: str) -> None:
    output = pathlib.Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")


def fallback_result(role: str, skill_text: str, input_text: str, reason: str) -> str:
    return textwrap.dedent(
        f"""
        1. summary
        codex_runner fallback response for role={role}

        2. note
        {reason}

        3. diagnostics
        skill_chars={len(skill_text)}
        input_chars={len(input_text)}
        """
    ).strip()


def extract_response_api_text(response_json: dict) -> str:
    output_items = response_json.get("output", [])
    parts: list[str] = []
    for item in output_items:
        content = item.get("content", [])
        for chunk in content:
            if chunk.get("type") == "output_text" and isinstance(chunk.get("text"), str):
                parts.append(chunk["text"])
    return "\n".join(parts).strip()


def extract_chat_completion_text(response_json: dict) -> str:
    choices = response_json.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts).strip()
    return ""


def extract_gemini_text(response_json: dict) -> str:
    candidates = response_json.get("candidates") or []
    if not candidates:
        return ""
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str):
            texts.append(part["text"])
    return "\n".join(texts).strip()


def http_json_request(
    url: str,
    method: str,
    payload: dict,
    headers: dict[str, str],
    timeout: int,
) -> dict:
    req = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method=method,
        headers={"Content-Type": "application/json", **headers},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        body = res.read().decode("utf-8")
    return json.loads(body)


def resolve_provider() -> str:
    provider = os.getenv("AGENT_PROVIDER", "openai_responses").strip().lower()
    allowed = {"openai_responses", "openai_compatible_chat", "gemini_generate_content"}
    if provider in allowed:
        return provider
    return "openai_responses"


def resolve_timeout(provider: str) -> int:
    default_timeout = 600 if provider == "openai_compatible_chat" else 120
    raw = os.getenv("AGENT_TIMEOUT_SEC", str(default_timeout)).strip()
    try:
        parsed = int(raw)
    except ValueError:
        return default_timeout
    return max(30, min(3600, parsed))


def resolve_api_key(provider: str) -> str:
    if provider == "gemini_generate_content":
        return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    return (os.getenv("AGENT_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()


def call_openai_responses(model: str, api_key: str, prompt: str, timeout_sec: int) -> str:
    api_base = os.getenv("AGENT_API_BASE", "https://api.openai.com").rstrip("/")
    payload = {"model": model, "input": prompt}
    parsed = http_json_request(
        url=f"{api_base}/v1/responses",
        method="POST",
        payload=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=timeout_sec,
    )
    text = extract_response_api_text(parsed)
    return text if text else json.dumps(parsed, ensure_ascii=False, indent=2)


def call_openai_compatible_chat(model: str, api_key: str, prompt: str, timeout_sec: int) -> str:
    api_base = os.getenv("AGENT_API_BASE", "http://127.0.0.1:11434").rstrip("/")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a strict engineering assistant. Follow the requested output format."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    parsed = http_json_request(
        url=f"{api_base}/v1/chat/completions",
        method="POST",
        payload=payload,
        headers=headers,
        timeout=timeout_sec,
    )
    text = extract_chat_completion_text(parsed)
    return text if text else json.dumps(parsed, ensure_ascii=False, indent=2)


def call_gemini_generate_content(model: str, api_key: str, prompt: str, timeout_sec: int) -> str:
    base = os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com").rstrip("/")
    encoded_model = urllib.parse.quote(model, safe="")
    url = f"{base}/v1beta/models/{encoded_model}:generateContent?key={urllib.parse.quote(api_key, safe='')}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
        },
    }
    parsed = http_json_request(
        url=url,
        method="POST",
        payload=payload,
        headers={},
        timeout=timeout_sec,
    )
    text = extract_gemini_text(parsed)
    return text if text else json.dumps(parsed, ensure_ascii=False, indent=2)


def main() -> None:
    args = parse_args()
    skill_text = load_text(args.skill)
    input_text = load_text(args.input)
    provider = resolve_provider()
    timeout_sec = resolve_timeout(provider)

    model_default = "gpt-5.3-codex" if provider != "gemini_generate_content" else "gemma-3-27b-it"
    model = os.getenv("AGENT_MODEL", model_default).strip()
    api_key = resolve_api_key(provider)

    prompt = textwrap.dedent(
        f"""
        # ROLE
        {args.role}

        # SKILL
        {skill_text}

        # TASK_INPUT
        {input_text}
        """
    ).strip()

    # openai_compatible_chat can run without key in local setups.
    key_required = provider in {"openai_responses", "gemini_generate_content"}
    if key_required and not api_key:
        save_text(
            args.output,
            fallback_result(
                args.role,
                skill_text,
                input_text,
                f"API key missing for provider={provider}. Returned fallback output.",
            ),
        )
        return

    try:
        if provider == "openai_responses":
            result_text = call_openai_responses(
                model=model, api_key=api_key, prompt=prompt, timeout_sec=timeout_sec
            )
        elif provider == "openai_compatible_chat":
            result_text = call_openai_compatible_chat(
                model=model, api_key=api_key, prompt=prompt, timeout_sec=timeout_sec
            )
        else:
            result_text = call_gemini_generate_content(
                model=model, api_key=api_key, prompt=prompt, timeout_sec=timeout_sec
            )
        save_text(args.output, result_text.strip())
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        save_text(
            args.output,
            fallback_result(
                args.role,
                skill_text,
                input_text,
                f"Provider HTTPError {error.code} ({provider}): {body[:500]}",
            ),
        )
    except Exception as error:  # noqa: BLE001
        save_text(
            args.output,
            fallback_result(
                args.role,
                skill_text,
                input_text,
                f"Provider call failed ({provider}): {error}",
            ),
        )


if __name__ == "__main__":
    main()
