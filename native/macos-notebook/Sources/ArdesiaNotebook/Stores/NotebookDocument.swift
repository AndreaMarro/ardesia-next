import AppKit
import SwiftUI
import UniformTypeIdentifiers
import NotebookCore

enum DrawingTool: String, CaseIterable {
    case pen, eraser, hand
    var label: String { switch self { case .pen: return "Penna"; case .eraser: return "Gomma"; case .hand: return "Mano" } }
    var icon: String { switch self { case .pen: return "pencil.tip"; case .eraser: return "eraser"; case .hand: return "hand.draw" } }
}

@objc(ANNotebookDocument)
final class NotebookDocument: NSDocument, ObservableObject {
    @Published private(set) var notebook = Notebook()
    @Published var selectedPageID: UUID?
    @Published var tool: DrawingTool = .pen
    @Published var color: InkColor = .graphite
    @Published var strokeWidth: Double = 2.5
    @Published var zoom: Double = 0.85
    @Published var status = "Pronto · salva il quaderno con ⌘S"
    @Published var historyRevision = 0
    @Published var errorMessage: String?
    var finishGesture: (() -> Void)?
    private var isWritingAutosave = false
    private var undoObservers: [NSObjectProtocol] = []

    override init() {
        super.init()
        selectedPageID = notebook.pages.first?.id
        undoManager = UndoManager()
        undoManager?.levelsOfUndo = 40
        undoManager?.groupsByEvent = false
        for name in [Notification.Name.NSUndoManagerDidUndoChange, .NSUndoManagerDidRedoChange, .NSUndoManagerDidCloseUndoGroup] {
            undoObservers.append(NotificationCenter.default.addObserver(forName: name, object: undoManager, queue: .main) { [weak self] _ in
                guard let self else { return }
                self.historyRevision += 1
            })
        }
    }
    deinit { undoObservers.forEach(NotificationCenter.default.removeObserver) }
    override class var autosavesInPlace: Bool { true }
    override class var autosavesDrafts: Bool { false }
    override class var preservesVersions: Bool { false }
    // Only a location chosen by the user is eligible. Untitled notebooks retain
    // the normal first-save prompt; no separate recovery archive is created.
    override func scheduleAutosaving() {
        guard fileURL != nil else { return }
        super.scheduleAutosaving()
    }
    override func autosave(withImplicitCancellability autosavingIsImplicitlyCancellable: Bool, completionHandler: @escaping (Error?) -> Void) {
        guard fileURL != nil else { completionHandler(nil); return }
        super.autosave(withImplicitCancellability: autosavingIsImplicitlyCancellable, completionHandler: completionHandler)
    }
    override func updateChangeCount(_ change: NSDocument.ChangeType) {
        super.updateChangeCount(change)
        // AppKit may finish its autosave-safety activity after the undo-manager
        // notification. Read the dirty state here, once AppKit has updated it.
        if hasUnautosavedChanges {
            status = fileURL == nil ? "Modifiche da salvare · ⌘S" : "Autosalvataggio in attesa · ⌘S per salvare ora"
        } else {
            status = fileURL == nil ? "Pronto · salva il quaderno con ⌘S" : "Versione salvata · nessuna modifica"
        }
    }
    override func defaultDraftName() -> String { "Quaderno senza titolo" }
    // The model and live pointer input are main-thread owned. Keep NSDocument's
    // safe-write operation synchronous; never touch SwiftUI state from its I/O queue.
    override func canAsynchronouslyWrite(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType) -> Bool { false }
    var selectedIndex: Int { notebook.pages.firstIndex { $0.id == selectedPageID } ?? 0 }
    var page: NotebookPage { notebook.pages[selectedIndex] }
    var canAddPage: Bool { notebook.pages.count < NotebookLimits.maxPages }
    var canUndo: Bool { undoManager?.canUndo == true }
    var canRedo: Bool { undoManager?.canRedo == true }
    var pageCountLabel: String { "\(notebook.pages.count) \(notebook.pages.count == 1 ? "pagina" : "pagine")" }

    override func makeWindowControllers() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1130, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.minSize = NSSize(width: 850, height: 580)
        window.title = "Ardesia · Quaderno"
        window.setFrameAutosaveName("ArdesiaNotebookWindow")
        window.contentView = NSHostingView(rootView: ContentView(document: self))
        window.center()
        addWindowController(NSWindowController(window: window))
    }

    override func read(from url: URL, ofType typeName: String) throws {
        notebook = try NotebookCodec.read(url)
        selectedPageID = notebook.pages.first?.id
        undoManager?.removeAllActions()
        status = "Quaderno aperto · \(pageCountLabel)"
    }
    override func read(from data: Data, ofType typeName: String) throws {
        notebook = try NotebookCodec.decode(data)
        selectedPageID = notebook.pages.first?.id
        undoManager?.removeAllActions()
    }
    override func data(ofType typeName: String) throws -> Data {
        // A periodic save must not end a pointer gesture halfway through. Its
        // committed strokes are saved now; mouseUp makes the live gesture dirty.
        if !isWritingAutosave { finishGesture?() }
        return try NotebookCodec.encode(notebook)
    }
    // Finalizing the first gesture can start AppKit's asynchronous autosave
    // safety activity. Queue the following document action behind that activity
    // instead of synchronously waiting inside the same event (which can deadlock).
    func finishGestureForDocumentAction(_ continuation: @escaping () -> Void) {
        finishGesture?()
        performActivity(withSynchronousWaiting: false) { completed in
            completed()
            self.continueAsynchronousWorkOnMainThread(continuation)
        }
    }
    override func save(_ sender: Any?) {
        finishGestureForDocumentAction { super.save(sender) }
    }
    override func saveAs(_ sender: Any?) {
        finishGestureForDocumentAction { super.saveAs(sender) }
    }
    override func writeSafely(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType) throws {
        let prior = isWritingAutosave
        isWritingAutosave = saveOperation == .autosaveInPlaceOperation || saveOperation == .autosaveElsewhereOperation || saveOperation == .autosaveAsOperation
        defer { isWritingAutosave = prior }
        do {
            try super.writeSafely(to: url, ofType: typeName, for: saveOperation)
            if saveOperation == .autosaveInPlaceOperation {
                status = "Salvataggio automatico sul Mac · \(pageCountLabel)"
            } else if saveOperation == .saveOperation || saveOperation == .saveAsOperation {
                status = "Salvato sul Mac · autosalvataggio attivo"
            }
        } catch {
            status = "Salvataggio non riuscito · modifiche in memoria"
            throw error
        }
    }
    override func canClose(withDelegate delegate: Any, shouldClose shouldCloseSelector: Selector?, contextInfo: UnsafeMutableRawPointer?) {
        // A still-pressed pointer lives in the canvas until finalized. Include
        // it BEFORE NSDocument decides whether a save/discard prompt is needed.
        finishGestureForDocumentAction {
            super.canClose(withDelegate: delegate, shouldClose: shouldCloseSelector, contextInfo: contextInfo)
        }
    }
    override func close() {
        finishGesture?()
        finishGesture = nil
        super.close()
    }

    func selectPage(_ id: UUID) { finishGesture?(); selectedPageID = id }

    private func replace(_ value: Notebook, action: String) {
        let old = notebook
        guard old != value else { return }
        let manager = undoManager
        let ownsGroup = manager != nil && manager!.groupingLevel == 0 && !manager!.isUndoing && !manager!.isRedoing
        if ownsGroup { manager?.beginUndoGrouping() }
        defer { if ownsGroup { manager?.endUndoGrouping() } }
        undoManager?.registerUndo(withTarget: self) { target in target.replace(old, action: action) }
        undoManager?.setActionName(action)
        notebook = value
        if !value.pages.contains(where: { $0.id == selectedPageID }) { selectedPageID = value.pages.first?.id }
        // NSDocument observes this undo manager's close/undo/redo notifications
        // and updates its change count. Manually incrementing here double-counts
        // edits and makes a fully undone saved document appear dirty.
        historyRevision += 1
        status = fileURL == nil ? "Modifiche da salvare · ⌘S" : "Autosalvataggio in attesa · ⌘S per salvare ora"
    }
    func edit(_ action: String, _ mutation: (inout Notebook) -> Void) {
        var next = notebook
        mutation(&next)
        do { replace(try next.validated(), action: action) }
        catch { report(error) }
    }
    func report(_ error: Error) { errorMessage = error.localizedDescription }
    func append(_ stroke: InkStroke, to pageID: UUID) {
        append([stroke], to: pageID)
    }
    func append(_ strokes: [InkStroke], to pageID: UUID) {
        guard !strokes.isEmpty else { return }
        guard let index = notebook.pages.firstIndex(where: { $0.id == pageID }) else { return }
        edit("Tratto") { $0.pages[index].strokes.append(contentsOf: strokes) }
    }
    func erase(_ ids: Set<UUID>, on pageID: UUID) {
        guard !ids.isEmpty, let index = notebook.pages.firstIndex(where: { $0.id == pageID }) else { return }
        edit("Gomma") { $0.pages[index].strokes.removeAll { ids.contains($0.id) } }
    }
    @objc func addPage(_ sender: Any?) {
        finishGesture?()
        guard canAddPage else { errorMessage = "Questo quaderno ha già 64 pagine. Crea un nuovo quaderno per continuare."; return }
        let next = NotebookPage(title: "Pagina \(notebook.pages.count + 1)", paper: page.paper)
        edit("Aggiungi pagina") { $0.pages.append(next) }
        selectedPageID = next.id
    }
    func duplicatePage() {
        finishGesture?()
        guard canAddPage else { return }
        var copy = page
        copy.id = UUID(); copy.title = String((copy.title + " · copia").prefix(120))
        copy.strokes = copy.strokes.map { var stroke = $0; stroke.id = UUID(); return stroke }
        let index = selectedIndex
        edit("Duplica pagina") { $0.pages.insert(copy, at: index + 1) }
        if notebook.pages.contains(where: { $0.id == copy.id }) { selectedPageID = copy.id }
    }
    func removePage() {
        finishGesture?()
        guard notebook.pages.count > 1 else { return }
        let index = selectedIndex
        edit("Elimina pagina") { $0.pages.remove(at: index) }
        selectedPageID = notebook.pages[min(index, notebook.pages.count-1)].id
    }
    func movePage(_ delta: Int) {
        finishGesture?()
        let index = selectedIndex, next = index + delta
        guard notebook.pages.indices.contains(next) else { return }
        edit("Sposta pagina") { $0.pages.swapAt(index, next) }
    }
    func renamePage(_ text: String) {
        let title = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let index = selectedIndex
        edit("Titolo pagina") { $0.pages[index].title = String(title.prefix(120)) }
    }
    func setPaper(_ paper: PaperStyle) {
        finishGesture?(); let index = selectedIndex
        edit("Carta") { $0.pages[index].paper = paper }
    }
    @objc func undoDrawing(_ sender: Any?) { finishGesture?(); undoManager?.undo() }
    @objc func redoDrawing(_ sender: Any?) { finishGesture?(); undoManager?.redo() }
    @objc func usePen(_ sender: Any?) { finishGesture?(); tool = .pen }
    @objc func useEraser(_ sender: Any?) { finishGesture?(); tool = .eraser }
    @objc func useHand(_ sender: Any?) { finishGesture?(); tool = .hand }
    @objc func zoomIn(_ sender: Any?) { zoom = min(2.5, zoom * 1.2) }
    @objc func zoomOut(_ sender: Any?) { zoom = max(0.35, zoom / 1.2) }
    @objc func actualSize(_ sender: Any?) { zoom = 1 }

    @objc func exportPDF(_ sender: Any?) {
        finishGesture?()
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pdf]
        panel.nameFieldStringValue = (fileURL?.deletingPathExtension().lastPathComponent ?? "Quaderno Ardesia") + ".pdf"
        panel.title = "Esporta le pagine in PDF"
        panel.message = "Il PDF mantiene la scrittura vettoriale. Conserva anche il quaderno .ardesiaquaderno per modificare i tratti."
        guard let window = windowControllers.first?.window else { return }
        panel.beginSheetModal(for: window) { [weak self] response in
            guard let self, response == .OK, let url = panel.url else { return }
            do {
                // The save panel supplies explicit replacement confirmation. JSON is untouched.
                try NotebookPDF.render(self.notebook).write(to: url, options: .atomic)
                self.status = "PDF esportato · \(self.pageCountLabel) · pronto per Ardesia"
            } catch { self.report(error) }
        }
    }
}
