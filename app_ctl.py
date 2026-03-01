#!/usr/bin/env python3

import argparse
from argparse import Namespace

from backend.populate_db import populate_db
from backend.infrastructure.backup.backup_service import backup_db
from backend.core.settings import get_settings


def parse_args() -> Namespace:
    parser = argparse.ArgumentParser(description="Movie API Control Tool")

    subparsers = parser.add_subparsers(dest="command", help="Commands", required=True)

    subparsers.add_parser("backup", help="Backup the database")

    populate_db_parser = subparsers.add_parser("populate-db", help="Populate DB with daily TMDB ID exports")
    populate_db_group = populate_db_parser.add_mutually_exclusive_group(required=True)
    populate_db_group.add_argument("--url", help="Read more here: https://developer.themoviedb.org/docs/daily-id-exports")
    populate_db_group.add_argument("--resume", action="store_true", help="Resume from the last processed export")

    args = parser.parse_args()
    return args


def main():
    args = parse_args()

    if args.command == "backup":
        settings = get_settings()
        backup_db(settings.database.database_file, settings.database.backup_path)

    elif args.command == "populate-db":
        populate_db(args.url, args.resume)


if __name__ == "__main__":
    main()
