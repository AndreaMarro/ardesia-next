import SwiftUI
import NotebookCore

struct DrawingToolbar: View {
    @ObservedObject var document: NotebookDocument
    var body: some View {
        HStack(spacing: 14) {
            Picker("Strumento", selection: Binding(get: { document.tool }, set: { document.finishGesture?(); document.tool = $0 })) {
                ForEach(DrawingTool.allCases, id: \.self) { tool in Label(tool.label, systemImage: tool.icon).tag(tool) }
            }.pickerStyle(.segmented).labelsHidden().frame(width: 185).help("Penna ⌘1 · Gomma a tratto ⌘2 · Mano ⌘3")
            Divider().frame(height: 22)
            HStack(spacing: 7) {
                ForEach(InkColor.palette, id: \.0) { name, color in
                    Button { document.finishGesture?(); document.color = color; document.tool = .pen } label: {
                        Circle().fill(Color(red: color.red, green: color.green, blue: color.blue))
                            .frame(width: 17, height: 17)
                            .padding(3)
                            .overlay(Circle().stroke(document.color == color ? Color.primary.opacity(0.7) : .clear, lineWidth: 1.4))
                    }.buttonStyle(.plain).help(name).accessibilityLabel("Colore \(name)")
                }
            }
            Menu {
                ForEach([1.0, 2.5, 4.0, 7.0, 12.0], id: \.self) { width in
                    Button { document.finishGesture?(); document.strokeWidth = width } label: {
                        if document.strokeWidth == width { Label("\(width.formatted()) pt", systemImage: "checkmark") }
                        else { Text("\(width.formatted()) pt") }
                    }
                }
            } label: { Text("\(document.strokeWidth.formatted()) pt").font(.system(size: 11, design: .monospaced)) }
            .frame(width: 65).help("Spessore della penna")
            Spacer(minLength: 0)
            Button { document.undoDrawing(nil) } label: { Image(systemName: "arrow.uturn.backward") }.disabled(!document.canUndo).help("Annulla · ⌘Z")
            Button { document.redoDrawing(nil) } label: { Image(systemName: "arrow.uturn.forward") }.disabled(!document.canRedo).help("Ripristina · ⇧⌘Z")
            Menu {
                ForEach(PaperStyle.allCases, id: \.self) { style in Button(style.label) { document.setPaper(style) } }
            } label: { Image(systemName: "square.grid.3x3") }.frame(width: 36).help("Carta: \(document.page.paper.label)")
        }.buttonStyle(.borderless).padding(.horizontal, 14).padding(.vertical, 12)
    }
}
