import sqlite3
from datetime import datetime
from pathlib import Path

from ..core.database import FILE
from ..core.logging import get_logger

logger = get_logger(__name__)

BACKUP_PATH = Path(__file__).parent.parent.parent / "data" / "db" / "backups"
BACKUP_PATH.mkdir(parents=True, exist_ok=True)


def backup_db() -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"movies_backup_{timestamp}.db"
    destination_path = BACKUP_PATH / backup_filename

    source_connection = sqlite3.connect(FILE)
    destination_connection = sqlite3.connect(destination_path)

    try:
        source_connection.backup(destination_connection)
        logger.warning(f"Backup of database created at: '{destination_path}'")
    finally:
        source_connection.close()
        destination_connection.close()
