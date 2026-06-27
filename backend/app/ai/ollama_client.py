import httpx
from app.config import settings


class OllamaClient:
    """
    Thin async wrapper around the Ollama local inference server.
    All methods gracefully return fallback values if Ollama is unreachable.
    """

    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.embed_model = settings.ollama_embed_model

    async def health(self) -> bool:
        """Return True if the Ollama server is reachable and responding."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    async def generate(self, prompt: str, system: str = "") -> str:
        """
        Generate a completion using the configured model.
        Returns an empty string on failure — callers should check health() first.
        """
        payload: dict = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(f"{self.base_url}/api/generate", json=payload)
            r.raise_for_status()
            return r.json().get("response", "")

    async def embed(self, text: str) -> list[float]:
        """
        Generate an embedding vector for `text` using the embed model.
        Uses the Ollama v0.5+ /api/embed endpoint.
        Returns an empty list on failure.
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{self.base_url}/api/embed",
                json={"model": self.embed_model, "input": text},
            )
            r.raise_for_status()
            return r.json().get("embeddings", [[]])[0]

    async def generate_stream(self, prompt: str, system: str = ""):
        """
        Async generator that yields token chunks for streaming responses.
        Yields string chunks; raises on HTTP errors.
        """
        payload: dict = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{self.base_url}/api/generate", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip():
                        import json
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue

    async def chat_stream(self, messages: list[dict]):
        """
        Async generator using Ollama's /api/chat endpoint with proper role-separated messages.
        messages: list of {"role": "system"|"user"|"assistant", "content": str}
        Yields string token chunks; raises on HTTP errors.
        """
        import json as _json
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{self.base_url}/api/chat", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = _json.loads(line)
                            token = (data.get("message") or {}).get("content", "")
                            if token:
                                yield token
                            if data.get("done"):
                                break
                        except _json.JSONDecodeError:
                            continue


ollama = OllamaClient()
