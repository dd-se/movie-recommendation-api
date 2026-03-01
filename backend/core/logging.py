import logging

from .settings import get_settings


def get_logger(name: str) -> logging.Logger:
    settings = get_settings()
    log_level = getattr(logging, settings.logging.log_level, logging.INFO)
    log_file = settings.logging.log_file

    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    if not logger.handlers:
        file_handler = logging.FileHandler(log_file)
        console_handler = logging.StreamHandler()
        file_handler.setLevel(logging.WARNING)
        console_handler.setLevel(log_level)

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
