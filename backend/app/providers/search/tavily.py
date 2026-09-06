"""
Tavily search provider implementation.
Uses Tavily API for real-time web research.
"""
from __future__ import annotations

from typing import Any

from tavily import AsyncTavilyClient
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import get_logger
from app.providers.base import ProviderStatus, SearchProvider

logger = get_logger(__name__)
settings = get_settings()


class TavilySearchProvider(SearchProvider):
    """Tavily web search integration for destination, hotel, and activity research."""

    def __init__(self) -> None:
        if settings.tavily_available:
            self._client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        else:
            self._client = None

    @property
    def status(self) -> ProviderStatus:
        if not settings.tavily_available:
            return ProviderStatus(available=False, reason="TAVILY_API_KEY not configured")
        return ProviderStatus(available=True)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def search(
        self,
        query: str,
        max_results: int = 10,
        search_depth: str = "basic",
    ) -> dict[str, Any]:
        """
        Search the web and return structured results.
        Results are extracted facts, NOT raw HTML — safe to pass to agents.
        search_depth: "basic" (faster, cheaper) or "advanced" (slower, more thorough)
        """
        if not self._client:
            raise RuntimeError("Tavily API key not configured")

        logger.debug("tavily_search", query=query, max_results=max_results, depth=search_depth)

        response = await self._client.search(
            query=query,
            search_depth=search_depth,
            max_results=max_results,
            include_answer=True,
            include_images=True,
            include_raw_content=False,  # Don't expose raw HTML to agents (security)
        )

        images = []
        seen_images: set[str] = set()
        for image in response.get("images", []):
            if isinstance(image, dict):
                url = image.get("url")
                desc = image.get("description") or image.get("title") or ""
            else:
                url = image
                desc = ""
                
            if isinstance(url, str) and url.startswith(("http://", "https://")) and url not in seen_images:
                images.append({"url": url, "description": desc})
                seen_images.add(url)

        results = []
        for r in response.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),  # Tavily's extracted snippet
                "score": r.get("score", 0.0),
                "published_date": r.get("published_date"),
                "image_url": None,
            })

        # Prepend Tavily's synthesized answer if present
        if response.get("answer"):
            results.insert(0, {
                "title": "Tavily Answer",
                "url": None,
                "content": response["answer"],
                "score": 1.0,
                "published_date": None,
                "image_url": None,
            })

        logger.debug("tavily_results", count=len(results))
        return {"results": results, "images": images}

    async def search_with_context(
        self,
        query: str,
        max_results: int = 8,
    ) -> str:
        """
        Returns a single string of concatenated search content
        suitable for inclusion in an LLM prompt.
        """
        res = await self.search(query, max_results=max_results, search_depth="advanced")
        results = res.get("results", [])
        if not results:
            return "No search results found."

        parts = []
        for i, r in enumerate(results, 1):
            source = f"[Source {i}: {r['title']}]" if r.get("title") else f"[Source {i}]"
            parts.append(f"{source}\n{r['content']}")

        return "\n\n".join(parts)
