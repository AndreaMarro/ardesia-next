#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ROOT="${ARDESIA_NOTEBOOK_BUILD_ROOT:-${TMPDIR:-/tmp}/ardesia-notebook-build-$(id -u)}"
mkdir -p "$BUILD_ROOT"
BUILD_ROOT="$(cd "$BUILD_ROOT" && pwd)"
SOURCE_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PROJECT_DIR")"
case "$BUILD_ROOT/" in "$SOURCE_ROOT/"*) echo 'Build output must be outside the source repository.' >&2; exit 2;; esac

# Standard-library runner owns bounded process groups and a fresh temporary
# fixture directory. No XCTest, GUI automation, dependency download or app kill.
exec python3 - "$PROJECT_DIR" "$BUILD_ROOT" <<'PY'
import hashlib, json, os, pathlib, signal, subprocess, sys, tempfile
project, build = map(pathlib.Path, sys.argv[1:])
def interrupted(signum, frame):
    raise KeyboardInterrupt()
for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
    signal.signal(signum, interrupted)

def run(command, timeout):
    child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             text=True, start_new_session=True)
    try:
        out, err = child.communicate(timeout=timeout)
        return child.returncode, out, err
    except BaseException:
        # Only this runner's newly spawned process group, never by app name.
        try: os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        try: child.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            child.communicate()
        raise

try:
    with tempfile.TemporaryDirectory(prefix='lifecycle-', dir=build) as temporary:
        scratch = pathlib.Path(temporary)
        # Extract the exact real application class; do not maintain a test copy.
        # Fail closed if the app entry layout changes and needs a new boundary.
        source = (project/'Sources/ArdesiaNotebook/App/main.swift').read_text()
        marker = '\nfinal class AppDelegate:'
        if source.count(marker) != 1:
            raise RuntimeError('Expected exactly one AppDelegate boundary in real main.swift')
        application = source.split(marker, 1)[0]
        if 'final class NotebookApplication: NSApplication' not in application:
            raise RuntimeError('Real application subclass was not extracted')
        (scratch/'ApplicationClass.swift').write_text(application)
        cache = build/'module-cache'
        core = sorted(map(str, (project/'Sources/NotebookCore').glob('*.swift')))
        views = sorted(map(str, (project/'Sources/ArdesiaNotebook/Views').glob('*.swift')))
        stores = sorted(map(str, (project/'Sources/ArdesiaNotebook/Stores').glob('*.swift')))
        commands = [
            ['xcrun','swiftc','-emit-library','-emit-module','-module-name','NotebookCore',*core,
             '-o',str(scratch/'libNotebookCore.dylib'),'-emit-module-path',str(scratch/'NotebookCore.swiftmodule'),'-module-cache-path',str(cache)],
            ['xcrun','swiftc',*stores,*views,str(scratch/'ApplicationClass.swift'),str(project/'Tests/NotebookLifecycleChecks/main.swift'),
             '-I',str(scratch),'-L',str(scratch),'-lNotebookCore','-Xlinker','-rpath','-Xlinker',str(scratch),
             '-module-cache-path',str(cache),'-o',str(scratch/'LifecycleChecks')]
        ]
        for command in commands:
            code, out, err = run(command, 180)
            if code:
                sys.stderr.write(out+err)
                raise RuntimeError('Lifecycle harness compilation failed')
        results = []
        for case in ('save','close','quit','nested'):
            fixture = scratch/case
            fixture.mkdir()
            try:
                code, out, err = run([str(scratch/'LifecycleChecks'),case,str(fixture)], 12)
            except subprocess.TimeoutExpired:
                code, out, err = 124, '', 'Child exceeded 12 seconds; its process group was stopped.'
            actual, expected = fixture/'document.ardesiaquaderno', fixture/'expected.ardesiaquaderno'
            equal = actual.is_file() and expected.is_file() and actual.read_bytes() == expected.read_bytes()
            # Expected state must contain the flushed gesture, not two empty files.
            one_stroke = expected.is_file() and sum(len(p['strokes']) for p in json.loads(expected.read_text())['pages']) == 1
            passed = code == 0 and equal and one_stroke
            result = {'case':case,'status':'PASS' if passed else 'FAIL','processExitCode':code,
                      'exactSavedBytes':equal,'expectedStrokes':1 if one_stroke else 0,
                      'sha256':hashlib.sha256(actual.read_bytes()).hexdigest() if actual.is_file() else None}
            if err.strip(): result['diagnostic'] = err.strip()
            results.append(result)
        report = {'checks':results,'passed':sum(r['status']=='PASS' for r in results),
                  'failed':sum(r['status']=='FAIL' for r in results),'fixtureCleanup':'on exit',
                  'scope':'Real NSDocument/NSApplication lifecycle; offscreen synthetic events, no OS UI input'}
    # TemporaryDirectory has removed every generated notebook and binary here.
    report['fixtureCleanup'] = 'complete'
    print(json.dumps(report, indent=2))
    sys.exit(1 if report['failed'] else 0)
except KeyboardInterrupt:
    sys.stderr.write('Lifecycle checks interrupted; owned child process group stopped and fixtures removed.\n')
    sys.exit(130)
except Exception as error:
    sys.stderr.write(f'Lifecycle checks failed: {error}\n')
    sys.exit(1)
PY
