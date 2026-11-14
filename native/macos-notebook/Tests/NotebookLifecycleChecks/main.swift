import AppKit
import Foundation
import NotebookCore

// Calls real document/canvas APIs against synthetic events and an offscreen
// window. It never posts OS input, launches a GUI app, or touches user documents.
let mode = CommandLine.arguments[1]
let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let file = directory.appendingPathComponent("document.ardesiaquaderno")
let expected = directory.appendingPathComponent("expected.ardesiaquaderno")
let type = "it.ardesia.notebook.document"
let app = NotebookApplication.shared
precondition(app is NotebookApplication)

func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fputs("FAIL: \(message)\n", stderr); exit(1) }
}
func waitUntil(_ condition: () -> Bool, seconds: TimeInterval = 5) {
    let deadline = Date().addingTimeInterval(seconds)
    while !condition() && Date() < deadline {
        RunLoop.main.run(until: Date().addingTimeInterval(0.01))
    }
    require(condition(), "Timed out waiting for native lifecycle callback")
}
func diskMatches(_ document: NotebookDocument) -> Bool {
    guard let disk = try? NotebookCodec.read(file) else { return false }
    return disk.strokeCount == 1 && disk == document.notebook
}
final class CloseResult: NSObject {
    var called = false
    var shouldClose = false
    @objc func decided(_ document: NSDocument, shouldClose: Bool, contextInfo: UnsafeMutableRawPointer?) {
        called = true; self.shouldClose = shouldClose
    }
}

// An actual NSApplication event loop is necessary to reproduce first-edit
// autosave-safety serialization. The outer script supplies a hard process bound.
Timer.scheduledTimer(withTimeInterval: 0.01, repeats: false) { _ in
    do {
        let document = NotebookDocument()
        var saved = false
        var saveError: Error?
        document.save(to: file, ofType: type, for: .saveAsOperation) { saveError = $0; saved = true }
        waitUntil { saved }
        require(saveError == nil && !document.hasUnautosavedChanges, "Initial named save failed")

        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 900), styleMask: [.titled], backing: .buffered, defer: false)
        let canvas = InkCanvasView(frame: NSRect(x: 0, y: 0, width: 659, height: 906))
        window.contentView = canvas
        canvas.page = document.page
        canvas.tool = .pen
        canvas.onStroke = { strokes, page in document.append(strokes, to: page) }
        document.addWindowController(NSWindowController(window: window))
        NSDocumentController.shared.addDocument(document)
        document.finishGesture = {
            canvas.finish()
            // Capture the exact production-codec bytes after the pending gesture
            // commits, even when real NSApplication.terminate exits this process.
            do { try NotebookCodec.encode(document.notebook).write(to: expected) }
            catch { fputs("Expected-state fixture failed: \(error)\n", stderr); exit(1) }
        }
        func event(_ type: NSEvent.EventType, _ x: Double, _ y: Double) -> NSEvent {
            let location = canvas.convert(NSPoint(x: x + 32, y: y + 32), to: nil)
            return NSEvent.mouseEvent(with: type, location: location, modifierFlags: [], timestamp: 0,
                windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!
        }
        canvas.mouseDown(with: event(.leftMouseDown, 40, 40))
        canvas.mouseDragged(with: event(.leftMouseDragged, 100, 100))
        require(document.notebook.strokeCount == 0, "Fixture must begin with a still-live first gesture")

        switch mode {
        case "quit":
            // This must really exit via NSApplication, not a mocked boundary.
            // Parent checks exit code AND exact saved bytes after process exit.
            app.terminate(nil)
        case "close":
            let callback = CloseResult()
            document.canClose(withDelegate: callback, shouldClose: #selector(CloseResult.decided(_:shouldClose:contextInfo:)), contextInfo: nil)
            waitUntil { callback.called }
            require(callback.shouldClose && diskMatches(document), "Close failed to preserve the first live gesture")
            document.close()
            exit(0)
        case "save":
            document.save(nil)
            waitUntil { diskMatches(document) }
            require(!document.hasUnautosavedChanges, "Save left committed changes unsaved")
            exit(0)
        case "nested":
            // Mimic NSApplication's nested modal wait while a main-dispatch
            // callback is active. DispatchQueue.main.async continuations starve;
            // NSDocument's native continuation must save before this loop ends.
            DispatchQueue.main.async {
                document.save(nil)
                waitUntil({ diskMatches(document) }, seconds: 1)
                exit(0)
            }
        default:
            require(false, "Unknown lifecycle test mode")
        }
    } catch {
        fputs("Lifecycle fixture failed: \(error)\n", stderr)
        exit(1)
    }
}
app.run()
