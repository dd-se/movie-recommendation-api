#!/usr/bin/env python3

import argparse

from src.populate_db import populate_db
from src.storage.db import QueueStatus, backup_db, update_queue_status, update_user


def parse_args():
    parser = argparse.ArgumentParser(description="Movie API Control Tool")

    subparsers = parser.add_subparsers(dest="command", help="Commands", required=True)

    backup_parser = subparsers.add_parser("backup", help="Backup the database")

    populate_db_parser = subparsers.add_parser("populate-db", help="Populate DB with daily TMDB ID exports")
    populate_db_group = populate_db_parser.add_mutually_exclusive_group(required=True)
    populate_db_group.add_argument("--url", help="Read more here: https://developer.themoviedb.org/docs/daily-id-exports")
    populate_db_group.add_argument("--resume", action="store_true", help="Resume from the last processed export")

    user_parser = subparsers.add_parser("user", help="Manage user accounts and permissions")
    user_subparsers = user_parser.add_subparsers(dest="action", required=True)
    permission_parser = user_subparsers.add_parser("scopes", help="Change user scopes")
    permission_parser.add_argument("email", help="User email")
    permission_parser.add_argument(
        "scopes", nargs="+", choices=["movie:read", "movie:write"], help="Scopes separated by space"
    )
    status_parser = user_subparsers.add_parser("status", help="Disable a user")
    status_parser.add_argument("email", help="User email")
    status_parser.add_argument("disabled", choices=["true", "false"], help="Set 'false' to enable or 'true' to disable")

    movie_desciption_queues_parser = subparsers.add_parser("queue", help="Change the state of a MovieDescriptionQueue row")
    movie_desciption_queues_parser.add_argument(
        "tmdb_ids",
        nargs="*",
        type=int,
        default=None,
        help="TMDB IDs separated by space. Leave empty for all.",
    )
    movie_desciption_queues_parser.add_argument(
        "new_status",
        type=QueueStatus,
        choices=list(QueueStatus),
        help="New queue status",
    )
    movie_desciption_queues_parser.add_argument("--message", type=str, help="Optional message")

    args = parser.parse_args()
    return args


def main():
    args = parse_args()

    print(args.__dict__)

    if args.command == "backup":
        backup_db()

    elif args.command == "populate-db":
        populate_db(args.url, args.resume)

    elif args.command == "queue":
        update_queue_status(args.tmdb_ids, args.new_status, args.message)

    elif args.command == "user":
        if args.action == "status":
            update_user(args.action, args.email, args.disabled.lower() == "true")

        elif args.action == "scopes":
            update_user(args.action, args.email, args.scopes)


if __name__ == "__main__":
    main()
