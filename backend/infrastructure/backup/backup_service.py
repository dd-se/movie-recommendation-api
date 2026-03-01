import sqlite3
from datetime import datetime
from pathlib import Path

from backend.core.logging import get_logger

logger = get_logger(__name__)


def backup_db(database_file: Path, backup_path: Path) -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"movies_backup_{timestamp}.db"
    destination_path = backup_path / backup_filename

    source_connection = sqlite3.connect(database_file)
    destination_connection = sqlite3.connect(destination_path)

    try:
        source_connection.backup(destination_connection)
        logger.warning(f"Backup of database created at: '{destination_path}'")
    finally:
        source_connection.close()
        destination_connection.close()
