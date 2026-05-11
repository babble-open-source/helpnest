# apps/agent/src/main.py
import logging
from livekit.agents import WorkerOptions, cli
from agent.worker import entrypoint

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
