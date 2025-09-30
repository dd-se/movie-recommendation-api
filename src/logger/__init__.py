import logging
import os
from pathlib import Path

LOG_DIR = Path(__file__).parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "logs.txt"
LOGLEVEL = getattr(logging, os.getenv("LOGLEVEL", "INFO"), logging.INFO)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(LOGLEVEL)

    if not logger.handlers:
        file_handler = logging.FileHandler(LOG_FILE)
        console_handler = logging.StreamHandler()
        file_handler.setLevel(logging.WARNING)
        console_handler.setLevel(LOGLEVEL)

        formatter = logging.Formatter(
            "[%(asctime)s] | %(levelname)-7s | %(name)s %(funcName)s() | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)

        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        logger.propagate = False
    return logger
