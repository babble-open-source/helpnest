# apps/agent/src/agent/worker.py
import json
import asyncio
import logging
from livekit import rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions
from agent.config import load_workspace_config, post_message
from agent.providers import resolve_drivers
from agent.prompt import build_system_prompt
from agent.tools import search_articles, report_confidence, escalate_to_human

logger = logging.getLogger(__name__)

async def entrypoint(ctx: rtc.JobContext):
    await ctx.connect()

    raw_metadata = ctx.room.metadata or "{}"
    meta = json.loads(raw_metadata)

    workspace_id = meta.get("workspaceId", "")
    conversation_id = meta.get("conversationId", "")
    greeting = meta.get("greeting")
    language = meta.get("language", "en")
    voice_settings = meta.get("voiceSettings")

    config = await load_workspace_config(workspace_id)

    config["voiceSettings"] = voice_settings
    config["language"] = language

    stt, llm, tts = resolve_drivers(config)
    system_prompt = build_system_prompt(config, greeting)

    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=tts,
    )

    userdata = {
        "workspace_id": workspace_id,
        "conversation_id": conversation_id,
        "last_user_message_id": "",
        "last_agent_message_id": "",
        "last_sources": [],
    }

    @session.on("user_input_transcribed")
    async def on_transcript(ev):
        if ev.is_final and ev.transcript.strip():
            msg = await post_message(conversation_id, "CUSTOMER", ev.transcript)
            userdata["last_user_message_id"] = msg.get("messageId", "")

            data = json.dumps({"type": "transcript_user", "text": ev.transcript, "isFinal": True})
            await ctx.room.local_participant.publish_data(data.encode(), kind=rtc.DataPacket.KIND_RELIABLE)

    @session.on("agent_speech_committed")
    async def on_speech(ev):
        text = ev.content if hasattr(ev, "content") else str(ev)
        sources = userdata.get("last_sources")
        msg = await post_message(conversation_id, "AI", text, sources)
        userdata["last_agent_message_id"] = msg.get("messageId", "")

        data = json.dumps({"type": "transcript_agent", "text": text, "isFinal": True})
        await ctx.room.local_participant.publish_data(data.encode(), kind=rtc.DataPacket.KIND_RELIABLE)

        if sources:
            src_data = json.dumps({"type": "sources", "sources": sources})
            await ctx.room.local_participant.publish_data(src_data.encode(), kind=rtc.DataPacket.KIND_RELIABLE)
            userdata["last_sources"] = []

    agent = Agent(
        instructions=system_prompt,
        tools=[search_articles, report_confidence, escalate_to_human],
        userdata=userdata,
    )

    await session.start(agent=agent, room=ctx.room)

    if greeting:
        await session.generate_reply(instructions=f'Say: "{greeting}"')

    logger.info("Voice session started for workspace=%s conversation=%s", workspace_id, conversation_id)

    # 10-minute max session duration
    async def session_timeout():
        await asyncio.sleep(480)  # 8 minutes — warn
        warn_data = json.dumps({"type": "transcript_agent", "text": "Just a heads up — this voice session will end in about 2 minutes. Feel free to switch to text chat if you need more time.", "isFinal": True})
        await ctx.room.local_participant.publish_data(warn_data.encode(), kind=rtc.DataPacket.KIND_RELIABLE)
        await session.generate_reply(instructions="Tell the customer the voice session will end in 2 minutes and they can continue via text chat.")

        await asyncio.sleep(120)  # 10 minutes total — disconnect
        end_data = json.dumps({"type": "session_end", "reason": "timeout"})
        await ctx.room.local_participant.publish_data(end_data.encode(), kind=rtc.DataPacket.KIND_RELIABLE)
        await asyncio.sleep(2)
        ctx.shutdown()

    asyncio.create_task(session_timeout())
