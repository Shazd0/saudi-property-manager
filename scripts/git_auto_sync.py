#!/usr/bin/env python3
"""Automatically sync a git repo with GitHub.

The script periodically:
1. Commits local edits.
2. Fetches the configured remote.
3. Pulls remote updates.
4. Pushes local commits.

It intentionally stops on merge/rebase conflicts so a human can resolve them.
"""

from __future__ import annotations

import argparse
import datetime as dt
import shlex
import subprocess
import sys
import time
from pathlib import Path


SECRET_EXCLUDES = (
    ":!*.env",
    ":!*.env.*",
    ":!*.local",
    ":!*.pem",
    ":!*.key",
    ":!**/credentials.json",
    ":!**/*secret*",
)


def run_git(
    repo: Path,
    args: list[str],
    *,
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    command = ["git", *args]
    print(f"$ {shlex.join(command)}", flush=True)
    result = subprocess.run(
        command,
        cwd=repo,
        text=True,
        capture_output=capture,
    )
    if capture:
        if result.stdout.strip():
            print(result.stdout.strip(), flush=True)
        if result.stderr.strip():
            print(result.stderr.strip(), file=sys.stderr, flush=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"git command failed with exit code {result.returncode}")
    return result


def ensure_git_repo(repo: Path) -> None:
    if not repo.exists():
        raise RuntimeError(f"Repo path does not exist: {repo}")
    result = run_git(repo, ["rev-parse", "--is-inside-work-tree"], check=False)
    if result.returncode != 0 or result.stdout.strip() != "true":
        raise RuntimeError(f"Not a git repository: {repo}")


def current_branch(repo: Path) -> str:
    result = run_git(repo, ["branch", "--show-current"])
    branch = result.stdout.strip()
    if not branch:
        raise RuntimeError("Detached HEAD is not supported. Check out a branch first.")
    return branch


def upstream_ref(repo: Path) -> str | None:
    result = run_git(
        repo,
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def has_local_changes(repo: Path) -> bool:
    result = run_git(repo, ["status", "--porcelain"], capture=True)
    return bool(result.stdout.strip())


def has_staged_changes(repo: Path) -> bool:
    result = run_git(repo, ["diff", "--cached", "--quiet"], check=False)
    return result.returncode == 1


def commit_local_changes(repo: Path, message_prefix: str) -> bool:
    if not has_local_changes(repo):
        return False

    run_git(repo, ["add", "-A", "--", ".", *SECRET_EXCLUDES])
    if not has_staged_changes(repo):
        print("Local changes exist, but nothing safe was staged to commit.", flush=True)
        return False

    timestamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    run_git(repo, ["commit", "-m", f"{message_prefix}: {timestamp}"])
    return True


def remote_has_branch(repo: Path, remote: str, branch: str) -> bool:
    result = run_git(
        repo,
        ["ls-remote", "--exit-code", "--heads", remote, branch],
        check=False,
    )
    return result.returncode == 0


def sync_once(repo: Path, remote: str, branch: str | None, message_prefix: str) -> None:
    ensure_git_repo(repo)
    active_branch = branch or current_branch(repo)
    print(f"Syncing {repo} on branch {active_branch}", flush=True)

    committed = commit_local_changes(repo, message_prefix)

    run_git(repo, ["fetch", "--prune", remote], check=False)
    remote_branch = f"{remote}/{active_branch}"
    configured_upstream = upstream_ref(repo)

    if configured_upstream or remote_has_branch(repo, remote, active_branch):
        if has_local_changes(repo):
            print(
                "Uncommitted local changes remain after auto-commit. Skipping pull/push.",
                flush=True,
            )
            return

        if committed:
            run_git(repo, ["pull", "--rebase", remote, active_branch])
        else:
            run_git(repo, ["pull", "--ff-only", remote, active_branch])
        run_git(repo, ["push", remote, active_branch])
        return

    print(f"Remote branch {remote_branch} does not exist yet. Creating it.", flush=True)
    run_git(repo, ["push", "-u", remote, active_branch])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automatically commit, pull, and push a git repository."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to the git repository. Defaults to this script's repository.",
    )
    parser.add_argument("--remote", default="origin", help="Git remote name.")
    parser.add_argument(
        "--branch",
        default=None,
        help="Branch to sync. Defaults to the currently checked-out branch.",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Seconds between sync checks when running continuously.",
    )
    parser.add_argument(
        "--message-prefix",
        default="auto-sync",
        help="Prefix for automatic commit messages.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one sync cycle and exit.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo = args.repo.expanduser().resolve()

    while True:
        try:
            sync_once(repo, args.remote, args.branch, args.message_prefix)
        except KeyboardInterrupt:
            print("Stopped.", flush=True)
            return 0
        except Exception as exc:
            print(f"Sync failed: {exc}", file=sys.stderr, flush=True)
            print("Fix the git issue above, then run the script again.", flush=True)
            return 1

        if args.once:
            return 0

        print(f"Waiting {args.interval} seconds...", flush=True)
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
