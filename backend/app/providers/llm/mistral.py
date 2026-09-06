"""
Mistral LLM provider implementation.
Uses mistral-large-latest for complex planning and mistral-small-latest for extraction.
"""
from __future__ import annotations

import json
from typing import Any

try:
    from mistralai.client.sdk import Mistral
except ImportError:
    try:
        from mistralai import Mistral
    except ImportError:
        from mistralai.client import Mistral
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import get_logger
from app.providers.base import LLMProvider, ProviderStatus

logger = get_logger(__name__)
settings = get_settings()


class MistralProvider(LLMProvider):
    """Production Mistral API integration."""

    _client: Any

    def __init__(self) -> None:
        if settings.mistral_available:
            self._client = Mistral(api_key=settings.mistral_api_key)
        else:
            self._client = None

    @property
    def status(self) -> ProviderStatus:
        if not settings.mistral_available:
            return ProviderStatus(available=False, reason="MISTRAL_API_KEY not configured")
        return ProviderStatus(available=True)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        response_format: Any = None,
        temperature: float = 0.3,
        model: str | None = None,
    ) -> str:
        if not self._client:
            raise RuntimeError("Mistral API key not configured")

        model = model or settings.mistral_model_large
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format:
            kwargs["response_format"] = response_format

        response = await self._client.chat.complete_async(**kwargs)
        raw_content = response.choices[0].message.content if response.choices and response.choices[0].message else ""
        content = str(raw_content or "")
        logger.debug(
            "mistral_completion",
            model=model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )
        return content

    async def complete_structured(
        self,
        system_prompt: str,
        user_message: str,
        output_schema: type,
        temperature: float = 0.1,
        model: str | None = None,
    ) -> Any:
        """Use Mistral with JSON mode to get a structured Pydantic output."""
        if not isinstance(output_schema, type) or not issubclass(output_schema, BaseModel):
            raise TypeError("output_schema must be a Pydantic BaseModel")
        model = model or settings.mistral_model_small

        schema_str = json.dumps(output_schema.model_json_schema(), indent=2)
        augmented_system = (
            f"{system_prompt}\n\n"
            f"You MUST respond ONLY with valid JSON that conforms to this schema:\n{schema_str}\n"
            "Do not include any explanation, markdown, or surrounding text. Only output JSON."
        )

        raw = await self.complete(
            system_prompt=augmented_system,
            user_message=user_message,
            response_format={"type": "json_object"},
            temperature=temperature,
            model=model,
        )

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("```", 2)[1].removeprefix("json").strip()
                return output_schema.model_validate_json(cleaned)
            except Exception as exc:
                last_error = exc
                if attempt == 2:
                    break
                raw = await self.complete(
                    system_prompt=(
                        f"{augmented_system}\nThe previous response failed validation: {exc}. "
                        "Repair it and return only valid JSON."
                    ),
                    user_message=f"Original request:\n{user_message}\n\nInvalid response:\n{raw}",
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    model=model,
                )
        raise ValueError(f"Structured LLM output failed schema validation after 3 attempts: {last_error}") from last_error
