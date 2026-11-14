#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ROOT="${ARDESIA_NOTEBOOK_BUILD_ROOT:-${TMPDIR:-/tmp}/ardesia-notebook-build-$(id -u)}"
mkdir -p "$BUILD_ROOT"
BUILD_ROOT="$(cd "$BUILD_ROOT" && pwd)"
SOURCE_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PROJECT_DIR")"
case "$BUILD_ROOT/" in "$SOURCE_ROOT/"*) echo 'Build output must be outside the source repository.' >&2; exit 2;; esac
xcrun swift run --package-path "$PROJECT_DIR" --scratch-path "$BUILD_ROOT/swiftpm" --cache-path "$BUILD_ROOT/swiftpm-cache" --config-path "$BUILD_ROOT/swiftpm-config" --security-path "$BUILD_ROOT/swiftpm-security" --manifest-cache local --disable-dependency-cache -Xswiftc -module-cache-path -Xswiftc "$BUILD_ROOT/module-cache" NotebookChecks "$@"
