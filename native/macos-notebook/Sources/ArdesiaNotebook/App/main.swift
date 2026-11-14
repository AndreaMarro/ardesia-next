import AppKit

@objc(ANNotebookApplication)
final class NotebookApplication: NSApplication {
    private var preparingTermination = false
    override func terminate(_ sender: Any?) {
        guard !preparingTermination else { return }
        let documents = NSDocumentController.shared.documents.compactMap { $0 as? NotebookDocument }
        guard !documents.isEmpty else { super.terminate(sender); return }
        preparingTermination = true
        var remaining = documents.count
        for document in documents {
            document.finishGestureForDocumentAction { [self] in
                remaining -= 1
                if remaining == 0 {
                    preparingTermination = false
                    finishTermination(sender)
                }
            }
        }
    }
    private func finishTermination(_ sender: Any?) {
        // Every live gesture and its native change-count activity have completed
        // before NSDocumentController filters the documents requiring a save.
        super.terminate(sender)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool { true }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

func item(_ title: String, _ action: Selector?, _ key: String = "", _ modifiers: NSEvent.ModifierFlags = [.command]) -> NSMenuItem {
    let value = NSMenuItem(title: title, action: action, keyEquivalent: key)
    value.keyEquivalentModifierMask = modifiers
    return value
}

func installMenus() {
    let bar = NSMenu()
    func menu(_ title: String, _ entries: [NSMenuItem]) -> NSMenu {
        let root = NSMenuItem(); let submenu = NSMenu(title: title)
        entries.forEach(submenu.addItem); root.submenu = submenu; bar.addItem(root)
        return submenu
    }
    _ = menu("Ardesia Quaderno", [
        item("Informazioni su Ardesia Quaderno", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
        .separator(), item("Nascondi Ardesia Quaderno", #selector(NSApplication.hide(_:)), "h"),
        item("Nascondi altre", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
        .separator(), item("Esci da Ardesia Quaderno", #selector(NSApplication.terminate(_:)), "q")
    ])
    _ = menu("File", [
        item("Nuovo quaderno", #selector(NSDocumentController.newDocument(_:)), "n"),
        item("Apri…", #selector(NSDocumentController.openDocument(_:)), "o"),
        .separator(), item("Chiudi", #selector(NSWindow.performClose(_:)), "w"),
        item("Salva", #selector(NSDocument.save(_:)), "s"),
        item("Salva con nome…", #selector(NSDocument.saveAs(_:)), "s", [.command, .shift]),
        .separator(), item("Esporta PDF…", #selector(NotebookDocument.exportPDF(_:)), "e", [.command, .shift])
    ])
    _ = menu("Modifica", [
        item("Annulla", Selector(("undo:")), "z"), item("Ripristina", Selector(("redo:")), "z", [.command, .shift]),
        .separator(), item("Taglia", #selector(NSText.cut(_:)), "x"), item("Copia", #selector(NSText.copy(_:)), "c"),
        item("Incolla", #selector(NSText.paste(_:)), "v"), item("Seleziona tutto", #selector(NSText.selectAll(_:)), "a")
    ])
    _ = menu("Quaderno", [
        item("Aggiungi pagina", #selector(NotebookDocument.addPage(_:)), "n", [.command, .shift]),
        .separator(), item("Penna", #selector(NotebookDocument.usePen(_:)), "1"),
        item("Gomma a tratto", #selector(NotebookDocument.useEraser(_:)), "2"),
        item("Mano", #selector(NotebookDocument.useHand(_:)), "3")
    ])
    _ = menu("Vista", [
        item("Ingrandisci", #selector(NotebookDocument.zoomIn(_:)), "+"),
        item("Riduci", #selector(NotebookDocument.zoomOut(_:)), "-"),
        item("Dimensioni reali", #selector(NotebookDocument.actualSize(_:)), "0")
    ])
    let windowMenu = menu("Finestra", [item("Contrai", #selector(NSWindow.performMiniaturize(_:)), "m"), item("Porta tutto in primo piano", #selector(NSApplication.arrangeInFront(_:)))])
    NSApp.windowsMenu = windowMenu
    NSApp.mainMenu = bar
}

// Obtain the actual AppKit singleton through the subclass before any window or
// document controller. A direct init does not register sharedApplication.
let app = NotebookApplication.shared
precondition(app is NotebookApplication, "The document preflight application subclass must own the AppKit singleton.")
let delegate = AppDelegate()
app.delegate = delegate
installMenus()
// Native periodic autosave; AppKit controls exact timing and safe-write lifecycle.
NSDocumentController.shared.autosavingDelay = 15
app.run()
