from __future__ import annotations

import argparse
import json
import os
import pathlib
import socket
import textwrap
import time
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
    if provider == "openai_compatible_chat":
        default_timeout = 600
    elif provider == "openai_responses":
        default_timeout = 300
    else:
        default_timeout = 180
    raw = os.getenv("AGENT_TIMEOUT_SEC", str(default_timeout)).strip()
    try:
        parsed = int(raw)
    except ValueError:
        return default_timeout
    return max(30, min(3600, parsed))


def resolve_max_retries(provider: str) -> int:
    default_retries = 2 if provider == "openai_responses" else 1
    raw = os.getenv("AGENT_MAX_RETRIES", str(default_retries)).strip()
    try:
        parsed = int(raw)
    except ValueError:
        return default_retries
    return max(0, min(5, parsed))


def resolve_retry_backoff_base() -> float:
    raw = os.getenv("AGENT_RETRY_BACKOFF_BASE_SEC", "2").strip()
    try:
        parsed = float(raw)
    except ValueError:
        return 2.0
    return max(0.5, min(10.0, parsed))


def resolve_max_output_tokens(compact_mode: bool) -> int:
    default_value = 320 if compact_mode else 0
    raw = os.getenv("AGENT_MAX_OUTPUT_TOKENS", str(default_value)).strip()
    try:
        parsed = int(raw)
    except ValueError:
        return default_value
    return max(0, min(4096, parsed))


def is_compact_mode_enabled() -> bool:
    return os.getenv("AGENT_COMPACT_MODE", "0").strip() == "1"


def is_retryable_http_status(status_code: int) -> bool:
    return status_code in {408, 409, 425, 429, 500, 502, 503, 504}


def format_retry_wait_seconds(base: float, attempt: int) -> float:
    # exponential backoff: base, base*2, base*4 ...
    return min(30.0, base * (2 ** attempt))


def resolve_api_key(provider: str) -> str:
    if provider == "gemini_generate_content":
        return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    return (os.getenv("AGENT_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()


def call_openai_responses(
    model: str,
    api_key: str,
    prompt: str,
    timeout_sec: int,
    max_output_tokens: int,
) -> str:
    api_base = os.getenv("AGENT_API_BASE", "https://api.openai.com").rstrip("/")
    payload = {"model": model, "input": prompt}
    if max_output_tokens > 0:
        payload["max_output_tokens"] = max_output_tokens
    parsed = http_json_request(
        url=f"{api_base}/v1/responses",
        method="POST",
        payload=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=timeout_sec,
    )
    text = extract_response_api_text(parsed)
    return text if text else json.dumps(parsed, ensure_ascii=False, indent=2)


def call_openai_compatible_chat(
    model: str,
    api_key: str,
    prompt: str,
    timeout_sec: int,
    max_output_tokens: int,
) -> str:
    api_base = os.getenv("AGENT_API_BASE", "http://127.0.0.1:11434").rstrip("/")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a strict engineering assistant. Follow the requested output format."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    if max_output_tokens > 0:
        payload["max_tokens"] = max_output_tokens
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


def call_gemini_generate_content(
    model: str,
    api_key: str,
    prompt: str,
    timeout_sec: int,
    max_output_tokens: int,
) -> str:
    base = os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com").rstrip("/")
    encoded_model = urllib.parse.quote(model, safe="")
    url = f"{base}/v1beta/models/{encoded_model}:generateContent?key={urllib.parse.quote(api_key, safe='')}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
        },
    }
    if max_output_tokens > 0:
        payload["generationConfig"]["maxOutputTokens"] = max_output_tokens
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
    max_retries = resolve_max_retries(provider)
    backoff_base_sec = resolve_retry_backoff_base()
    compact_mode = is_compact_mode_enabled()
    max_output_tokens = resolve_max_output_tokens(compact_mode)

    model_default = "gpt-5.3-codex" if provider != "gemini_generate_content" else "gemma-3-27b-it"
    model = os.getenv("AGENT_MODEL", model_default).strip()
    api_key = resolve_api_key(provider)

    compact_instruction = (
        "- Keep each required section concise.\n"
        "- Prefer short bullet points over long paragraphs.\n"
        "- Keep total response length under 220 words.\n"
    )

    prompt = textwrap.dedent(
        f"""
        # ROLE
        {args.role}

        # SKILL
        {skill_text}

        # TASK_INPUT
        {input_text}

        # RESPONSE_STYLE
        {"compact" if compact_mode else "normal"}

        # EXTRA_INSTRUCTIONS
        {compact_instruction if compact_mode else "- Use normal detail level."}
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

    for attempt in range(max_retries + 1):
        try:
            if provider == "openai_responses":
                result_text = call_openai_responses(
                    model=model,
                    api_key=api_key,
                    prompt=prompt,
                    timeout_sec=timeout_sec,
                    max_output_tokens=max_output_tokens,
                )
            elif provider == "openai_compatible_chat":
                result_text = call_openai_compatible_chat(
                    model=model,
                    api_key=api_key,
                    prompt=prompt,
                    timeout_sec=timeout_sec,
                    max_output_tokens=max_output_tokens,
                )
            else:
                result_text = call_gemini_generate_content(
                    model=model,
                    api_key=api_key,
                    prompt=prompt,
                    timeout_sec=timeout_sec,
                    max_output_tokens=max_output_tokens,
                )
            save_text(args.output, result_text.strip())
            return
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            retryable = is_retryable_http_status(error.code)
            if attempt < max_retries and retryable:
                wait_sec = format_retry_wait_seconds(backoff_base_sec, attempt)
                time.sleep(wait_sec)
                continue
            save_text(
                args.output,
                fallback_result(
                    args.role,
                    skill_text,
                    input_text,
                    (
                        f"Provider HTTPError {error.code} ({provider})"
                        f" after {attempt + 1} attempt(s): {body[:500]}"
                    ),
                ),
            )
            return
        except (TimeoutError, socket.timeout, urllib.error.URLError) as error:
            if attempt < max_retries:
                wait_sec = format_retry_wait_seconds(backoff_base_sec, attempt)
                time.sleep(wait_sec)
                continue
            save_text(
                args.output,
                fallback_result(
                    args.role,
                    skill_text,
                    input_text,
                    f"Provider call failed ({provider}) after {attempt + 1} attempt(s): {error}",
                ),
            )
            return
        except Exception as error:  # noqa: BLE001
            save_text(
                args.output,
                fallback_result(
                    args.role,
                    skill_text,
                    input_text,
                    f"Provider call failed ({provider}) after {attempt + 1} attempt(s): {error}",
                ),
            )
            return


if __name__ == "__main__":
    main()
