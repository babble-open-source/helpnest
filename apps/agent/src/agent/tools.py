# apps/agent/src/agent/tools.py
from livekit.agents import function_tool, RunContext
from agent.config import search_articles as api_search, post_confidence, post_escalate

@function_tool
async def search_articles(ctx: RunContext, query: str) -> str:
    """Search the help center for articles matching the customer's question."""
    workspace_id = ctx.userdata["workspace_id"]
    results = await api_search(workspace_id, query, limit=5)

    if not results:
        return "No relevant articles found."

    parts = []
    for article in results[:3]:
        parts.append(
            f'<article title="{article["title"]}">\n'
            f'{article["content"]}\n'
            f'</article>'
        )
    ctx.userdata["last_sources"] = [
        {"id": a["id"], "title": a["title"], "slug": a["slug"], "collectionSlug": a.get("collectionSlug", "")}
        for a in results[:3]
    ]
    return "\n\n".join(parts)

@function_tool
async def report_confidence(ctx: RunContext, confidence: float, query: str) -> str:
    """Report confidence in your answer (0.0-1.0). Call after every answer."""
    await post_confidence(
        workspace_id=ctx.userdata["workspace_id"],
        conversation_id=ctx.userdata["conversation_id"],
        message_id=ctx.userdata.get("last_agent_message_id", ""),
        confidence=confidence,
        query=query,
    )
    return "Confidence recorded."

@function_tool
async def escalate_to_human(ctx: RunContext, reason: str) -> str:
    """Escalate to human support when you cannot help the customer."""
    await post_escalate(
        workspace_id=ctx.userdata["workspace_id"],
        conversation_id=ctx.userdata["conversation_id"],
        reason=reason,
    )
    return "Escalation triggered. Tell the customer you're connecting them to support."
