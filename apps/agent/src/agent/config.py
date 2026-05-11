# apps/agent/src/agent/config.py
import os
import httpx

HELPNEST_BASE_URL = os.environ.get("HELPNEST_BASE_URL", "http://localhost:3000")
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "")

_client: httpx.AsyncClient | None = None

def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=HELPNEST_BASE_URL,
            headers={"x-internal-secret": INTERNAL_SECRET},
            timeout=10.0,
        )
    return _client

async def load_workspace_config(workspace_id: str) -> dict:
    client = _get_client()
    resp = await client.get(
        "/api/internal/voice/config",
        params={"workspaceId": workspace_id},
    )
    resp.raise_for_status()
    return resp.json()

async def post_message(conversation_id: str, role: str, content: str, sources: list | None = None) -> dict:
    client = _get_client()
    body: dict = {"conversationId": conversation_id, "role": role, "content": content}
    if sources:
        body["sources"] = sources
    resp = await client.post("/api/internal/voice/messages", json=body)
    resp.raise_for_status()
    return resp.json()

async def post_confidence(workspace_id: str, conversation_id: str, message_id: str, confidence: float, query: str) -> None:
    client = _get_client()
    await client.post("/api/internal/voice/confidence", json={
        "workspaceId": workspace_id,
        "conversationId": conversation_id,
        "messageId": message_id,
        "confidence": confidence,
        "query": query,
    })

async def post_escalate(workspace_id: str, conversation_id: str, reason: str) -> None:
    client = _get_client()
    await client.post("/api/internal/voice/escalate", json={
        "workspaceId": workspace_id,
        "conversationId": conversation_id,
        "reason": reason,
    })

async def search_articles(workspace_id: str, query: str, limit: int = 5) -> list[dict]:
    client = _get_client()
    resp = await client.get(
        "/api/internal/voice/search",
        params={"q": query, "workspaceId": workspace_id, "limit": limit},
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("results", [])
