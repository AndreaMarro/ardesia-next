import SwiftUI
import AppKit
import NotebookCore

struct ContentView: View {
    @ObservedObject var document: NotebookDocument
    @State private var rename = ""
    @State private var renaming = false
    @State private var deleting = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "book.closed.fill").font(.title2).foregroundStyle(.tint)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Ardesia Quaderno").font(.system(size: 16, weight: .semibold, design: .serif))
                    Text("Uno spazio per ragionare, una pagina alla volta.").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button { document.save(nil) } label: { Label("Salva", systemImage: "square.and.arrow.down") }
                    .help("Salva il quaderno modificabile · ⌘S")
                Button { document.exportPDF(nil) } label: { Label("Esporta PDF", systemImage: "square.and.arrow.up") }
                    .help("Esporta tutte le pagine per Ardesia · ⇧⌘E")
            }.padding(.horizontal, 20).padding(.vertical, 14)
            Divider()
            HStack(spacing: 0) {
                sidebar.frame(width: 205)
                Divider()
                VStack(spacing: 0) {
                    DrawingToolbar(document: document)
                    Divider()
                    HStack {
                        Button { rename = document.page.title; renaming = true } label: {
                            HStack(spacing: 7) { Text(document.page.title).fontWeight(.medium); Image(systemName: "pencil").font(.caption) }
                        }.buttonStyle(.plain).help("Rinomina questa pagina")
                        Spacer()
                        Text("A4 · \(document.page.strokeCountLabel)").font(.caption).foregroundStyle(.secondary)
                    }.padding(.horizontal, 18).padding(.vertical, 10)
                    InkCanvas(document: document).frame(maxWidth: .infinity, maxHeight: .infinity)
                    footer
                }
            }
        }
        .tint(Color(nsColor: .systemGreen))
        .alert("Rinomina pagina", isPresented: $renaming) {
            TextField("Titolo", text: $rename)
            Button("Annulla", role: .cancel) {}
            Button("Rinomina") { document.renamePage(rename) }
        } message: { Text("Fino a 120 caratteri.") }
        .alert("Eliminare “\(document.page.title)”?", isPresented: $deleting) {
            Button("Annulla", role: .cancel) {}
            Button("Elimina pagina", role: .destructive) { document.removePage() }
        } message: { Text("Puoi recuperarla con Annulla finché il quaderno rimane aperto.") }
        .alert("Operazione non completata", isPresented: Binding(get: { document.errorMessage != nil }, set: { if !$0 { document.errorMessage = nil } })) {
            Button("OK") { document.errorMessage = nil }
        } message: { Text(document.errorMessage ?? "") }
    }
    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("PAGINE").font(.system(size: 10, weight: .semibold)).tracking(1.5).foregroundStyle(.secondary)
                Spacer()
                Text("\(document.notebook.pages.count)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }.padding(16)
            List(selection: Binding<UUID?>(get: { document.selectedPageID }, set: { if let id = $0 { document.selectPage(id) } })) {
                ForEach(Array(document.notebook.pages.enumerated()), id: \.element.id) { index, page in
                    HStack(spacing: 10) {
                        Text(String(format: "%02d", index+1)).font(.system(size: 12, weight: .medium, design: .monospaced)).foregroundStyle(.secondary).frame(width: 25)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(page.title).lineLimit(1).font(.system(size: 12, weight: .medium))
                            Text(page.strokes.isEmpty ? "Una pagina da iniziare" : "\(page.strokeCountLabel) · \(page.paper.label.lowercased())")
                                .font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }.padding(.vertical, 5).tag(page.id)
                }
            }.listStyle(.sidebar)
            Divider()
            VStack(alignment: .leading, spacing: 10) {
                Button { document.addPage(nil) } label: { Label("Nuova pagina", systemImage: "plus") }.disabled(!document.canAddPage)
                Menu {
                    Button("Rinomina…") { rename = document.page.title; renaming = true }
                    Button("Duplica") { document.duplicatePage() }.disabled(!document.canAddPage)
                    Button("Sposta su") { document.movePage(-1) }.disabled(document.selectedIndex == 0)
                    Button("Sposta giù") { document.movePage(1) }.disabled(document.selectedIndex == document.notebook.pages.count-1)
                    Divider()
                    Button("Elimina pagina…") { deleting = true }.disabled(document.notebook.pages.count <= 1)
                } label: { Label("Gestisci pagina", systemImage: "ellipsis.circle") }
                .menuStyle(.borderlessButton)
            }.padding(16)
            Divider()
            VStack(alignment: .leading, spacing: 7) {
                Label("Sul tuo Mac", systemImage: "externaldrive").font(.caption).fontWeight(.medium)
                Text("Salva il quaderno per ritrovare i tratti. Porta il PDF in Ardesia come materiale.").font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }.padding(16)
        }
    }
    private var footer: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: 12) {
                Text(document.status).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(2)
                Spacer(minLength: 8)
                Button { document.zoomOut(nil) } label: { Image(systemName: "minus.magnifyingglass") }.help("Riduci · ⌘−")
                Button { document.actualSize(nil) } label: { Text("\(Int(document.zoom*100))%").font(.system(size: 11, design: .monospaced)).frame(width: 42) }.help("Dimensioni reali · ⌘0")
                Button { document.zoomIn(nil) } label: { Image(systemName: "plus.magnifyingglass") }.help("Ingrandisci · ⌘+")
            }.buttonStyle(.borderless).padding(.horizontal, 14).padding(.vertical, 10)
        }
    }
}

private extension NotebookPage {
    var strokeCountLabel: String { "\(strokes.count) \(strokes.count == 1 ? "tratto" : "tratti")" }
}
