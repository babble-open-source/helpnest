# apps/agent/src/agent/providers.py
from agent.plugins import create_stt, create_llm, create_tts

def resolve_drivers(config: dict) -> tuple:
    stt = create_stt(language=config.get("language", "en"))
    llm = create_llm(
        provider=config.get("aiProvider", "ANTHROPIC"),
        model=config.get("aiModel"),
        api_key=config.get("aiApiKey"),
    )
    tts = create_tts(voice_settings=config.get("voiceSettings"))
    return stt, llm, tts
