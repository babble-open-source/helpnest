# apps/agent/src/main.py
import logging
from livekit.agents import WorkerOptions, cli

logging.basicConfig(level=logging.INFO)

def _placeholder_entrypoint(ctx):
    pass

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=_placeholder_entrypoint))
