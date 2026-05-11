# apps/agent/src/agent/plugins.py
import os
import logging

logger = logging.getLogger(__name__)

def create_stt(language: str = "en"):
    from livekit.plugins import deepgram
    return deepgram.STT(
        model="nova-3",
        language=language,
    )

def create_llm(provider: str, model: str | None, api_key: str | None, system_prompt: str = ""):
    provider = provider.upper()

    if provider == "OPENAI":
        from livekit.plugins import openai
        return openai.LLM(
            model=model or "gpt-4o-mini",
            api_key=api_key or os.environ.get("OPENAI_API_KEY", ""),
        )

    if provider == "GOOGLE":
        from livekit.plugins import google
        return google.LLM(
            model=model or "gemini-2.0-flash",
            api_key=api_key or os.environ.get("GOOGLE_AI_API_KEY", ""),
        )

    # Default: ANTHROPIC (also fallback for MISTRAL)
    from livekit.plugins import anthropic
    if provider == "MISTRAL":
        logger.warning("Mistral not supported for voice; falling back to Anthropic")
    return anthropic.LLM(
        model=model or "claude-haiku-4-5-20251001",
        api_key=api_key or os.environ.get("ANTHROPIC_API_KEY", ""),
    )

def create_tts(voice_settings: dict | None = None):
    settings = voice_settings or {}
    provider = settings.get("provider", "inworld")

    if provider == "inworld":
        from livekit.plugins import inworld
        voice = settings.get("voiceId") or settings.get("voice") or "Ashley"
        model = settings.get("model") or "inworld-tts-1.5-mini"
        logger.info("TTS: inworld voice=%s model=%s", voice, model)
        return inworld.TTS(voice=voice, model=model)

    # Fallback for future providers
    from livekit.plugins import inworld
    logger.warning("Unknown TTS provider %s; falling back to inworld", provider)
    return inworld.TTS(voice="Ashley", model="inworld-tts-1.5-mini")
