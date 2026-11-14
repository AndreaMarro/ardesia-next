#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
case "$MODE" in run|--build-only|--verify|--debug|--logs|--telemetry) ;; *) echo 'Usage: script/build_and_run.sh [run|--build-only|--verify|--debug|--logs|--telemetry]' >&2; exit 2;; esac
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ROOT="${ARDESIA_NOTEBOOK_BUILD_ROOT:-${TMPDIR:-/tmp}/ardesia-notebook-build-$(id -u)}"
mkdir -p "$BUILD_ROOT"
BUILD_ROOT="$(cd "$BUILD_ROOT" && pwd)"
SOURCE_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PROJECT_DIR")"
case "$BUILD_ROOT/" in "$SOURCE_ROOT/"*) echo 'Build output must be outside the source repository.' >&2; exit 2;; esac

# Never kill a document app with unsaved user work. Existing windows must be
# closed explicitly before a development relaunch; build-only is always safe.
if [ "$MODE" != '--build-only' ] && pgrep -x ArdesiaNotebook >/dev/null; then
  echo 'Ardesia Quaderno is already running. Save and quit it before relaunching, or use --build-only.' >&2
  exit 3
fi

SWIFT_ARGS=(--package-path "$PROJECT_DIR" --scratch-path "$BUILD_ROOT/swiftpm" --cache-path "$BUILD_ROOT/swiftpm-cache" --config-path "$BUILD_ROOT/swiftpm-config" --security-path "$BUILD_ROOT/swiftpm-security" --manifest-cache local --disable-dependency-cache -Xswiftc -module-cache-path -Xswiftc "$BUILD_ROOT/module-cache")
xcrun swift build "${SWIFT_ARGS[@]}" -c release
BIN_DIR="$(xcrun swift build "${SWIFT_ARGS[@]}" -c release --show-bin-path)"
mkdir -p "$BUILD_ROOT/bundles"
STAGING_DIR="$(mktemp -d "$BUILD_ROOT/bundles/build.XXXXXX")"
APP_BUNDLE="$STAGING_DIR/Ardesia Quaderno.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"
cp "$BIN_DIR/ArdesiaNotebook" "$APP_BUNDLE/Contents/MacOS/ArdesiaNotebook"
cp "$PROJECT_DIR/Resources/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
chmod +x "$APP_BUNDLE/Contents/MacOS/ArdesiaNotebook"
plutil -lint "$APP_BUNDLE/Contents/Info.plist"
codesign --force --sign - "$APP_BUNDLE"
codesign --verify --strict "$APP_BUNDLE"
printf '%s\n' "$APP_BUNDLE" > "$BUILD_ROOT/latest-bundle.txt"
printf 'APP_BUNDLE=%s\n' "$APP_BUNDLE"

case "$MODE" in
  --build-only) ;;
  run) open -n "$APP_BUNDLE" ;;
  --verify) open -n "$APP_BUNDLE"; sleep 2; pgrep -x ArdesiaNotebook >/dev/null ;;
  --debug) lldb -- "$APP_BUNDLE/Contents/MacOS/ArdesiaNotebook" ;;
  --logs) open -n "$APP_BUNDLE"; /usr/bin/log stream --info --style compact --predicate 'process == "ArdesiaNotebook"' ;;
  --telemetry) open -n "$APP_BUNDLE"; /usr/bin/log stream --info --style compact --predicate 'subsystem == "it.ardesia.quaderno"' ;;
esac
