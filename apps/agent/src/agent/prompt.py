# apps/agent/src/agent/prompt.py
def build_system_prompt(config: dict, greeting: str | None = None) -> str:
    workspace_name = config.get("workspaceName", "this company")
    instructions = config.get("aiInstructions", "")
    product_ctx = config.get("productContext", "")
    threshold = config.get("escalationThreshold", 0.3)

    parts = [
        f"You are a voice assistant for {workspace_name}.",
        "",
        "You answer customer questions using the company's help center articles.",
        "Always search for articles before answering. Cite which article you found the answer in.",
    ]

    if instructions:
        parts.extend(["", instructions])

    if product_ctx:
        parts.extend(["", f"Product context: {product_ctx}"])

    parts.extend([
        "",
        "Rules:",
        "- Be concise — you are speaking, not writing. Keep answers under 3 sentences when possible.",
        "- If you find a relevant article, answer from it and mention the article title.",
        "- If you cannot find an answer, say so honestly and offer to escalate to a human.",
        f"- After answering, call report_confidence with your confidence score (0-1).",
        f"- If confidence is below {threshold}, call escalate_to_human.",
    ])

    if greeting:
        parts.extend(["", f'Greeting: Start the conversation by saying: "{greeting}"'])

    return "\n".join(parts)
