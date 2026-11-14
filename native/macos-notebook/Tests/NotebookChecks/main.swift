import Foundation
import PDFKit
import NotebookCore

struct CheckFailure: Error, CustomStringConvertible { let description: String }
func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw CheckFailure(description: message) }
}
func rejects(_ body: () throws -> Void) throws {
    do { try body() } catch { return }
    throw CheckFailure(description: "Expected rejection, operation succeeded")
}
func sample() -> Notebook {
    Notebook(title: "Fisica · appunti", pages: [
        NotebookPage(title: "Forza e spostamento", paper: .dots, strokes: [InkStroke(color: .blue, points: [InkPoint(x: 30,y: 40,pressure: 0.2),InkPoint(x: 200,y: 140,pressure: 0.8)])]),
        NotebookPage(title: "Energia", paper: .ruled, strokes: [InkStroke(color: .red, width: 7, points: [InkPoint(x: 100,y: 100)])])
    ])
}
var results: [[String: String]] = []
func check(_ name: String, _ body: () throws -> Void) {
    do { try body(); results.append(["name": name, "status": "PASS"]) }
    catch { results.append(["name": name, "status": "FAIL", "error": String(describing: error)]) }
}

check("editable roundtrip retains IDs, pressure, pages and Unicode") {
    let notebook = sample(), decoded = try NotebookCodec.decode(NotebookCodec.encode(notebook))
    try expect(decoded == notebook, "Roundtrip changed document")
}
check("finite coordinates and pressure bounds") {
    for point in [InkPoint(x: .infinity,y: 4),InkPoint(x: 4,y: .nan),InkPoint(x: -1,y: 4),InkPoint(x: 596,y: 4),InkPoint(x: 4,y: 843),InkPoint(x: 4,y: 4,pressure: 1.01)] {
        var notebook = sample(); notebook.pages[0].strokes[0].points = [point]
        try rejects { _ = try notebook.validated() }
    }
}
check("version, duplicate identities, empty pages and point budget rejected") {
    var notebook = sample(); notebook.schemaVersion = 2
    try rejects { _ = try NotebookCodec.encode(notebook) }
    notebook = sample(); notebook.pages[1].id = notebook.pages[0].id
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages[1].strokes[0].id = notebook.pages[0].strokes[0].id
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages = []
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages[0].strokes[0].points = []
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.title = String(repeating: "a", count: 121)
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages = (0...64).map { NotebookPage(title: "Pagina \($0)") }
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages[0].strokes[0].points = Array(repeating: InkPoint(x: 1,y: 1), count: 20_001)
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages[0].strokes = (0...4_000).map { _ in InkStroke(points: [InkPoint(x: 1,y: 1)]) }
    try rejects { _ = try notebook.validated() }
    notebook = sample(); notebook.pages[0].strokes = (0..<13).map { _ in InkStroke(points: Array(repeating: InkPoint(x: 1,y: 1), count: 20_000)) }
    try rejects { _ = try notebook.validated() }
}
check("malformed, oversize and nonfinite JSON rejected") {
    try rejects { _ = try NotebookCodec.decode(Data("{bad".utf8)) }
    try rejects { _ = try NotebookCodec.decode(Data(repeating: 32, count: NotebookLimits.maxFileBytes+1)) }
    let original = try NotebookCodec.encode(sample())
    let huge = String(decoding: original, as: UTF8.self).replacingOccurrences(of: "\"width\":2.5", with: "\"width\":1e999")
    try rejects { _ = try NotebookCodec.decode(Data(huge.utf8)) }
}
check("unknown fields rejected instead of silently dropped") {
    let data = try NotebookCodec.encode(sample())
    var object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    object["futureMetadata"] = "must be preserved"
    try rejects { _ = try NotebookCodec.decode(JSONSerialization.data(withJSONObject: object)) }
    object.removeValue(forKey: "futureMetadata")
    var pages = object["pages"] as! [[String: Any]]
    pages[0]["futurePageProperty"] = true; object["pages"] = pages
    try rejects { _ = try NotebookCodec.decode(JSONSerialization.data(withJSONObject: object)) }
}
check("atomic save and invalid write preserve original") {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("test.ardesiaquaderno"), notebook = sample()
    try NotebookCodec.write(notebook, to: url)
    let loaded = try NotebookCodec.read(url)
    try expect(loaded == notebook, "Disk roundtrip changed data")
    let original = try Data(contentsOf: url)
    var invalid = notebook; invalid.pages[0].strokes[0].width = 100
    try rejects { try NotebookCodec.write(invalid, to: url) }
    let retained = try Data(contentsOf: url)
    try expect(retained == original, "Invalid write changed existing bytes")
    try rejects { _ = try NotebookCodec.read(directory) }
}
check("eraser uses segment sweep and dots, not bounding boxes") {
    let diagonal = InkStroke(width: 2, points: [InkPoint(x: 10,y: 10),InkPoint(x: 100,y: 100)])
    try expect(InkGeometry.intersects(diagonal, from: InkPoint(x: 50,y: 20), to: InkPoint(x: 50,y: 90), eraserRadius: 1), "Crossing missed")
    try expect(!InkGeometry.intersects(diagonal, from: InkPoint(x: 15,y: 95), to: InkPoint(x: 20,y: 95), eraserRadius: 1), "Bounding box false positive")
    let dot = InkStroke(width: 4, points: [InkPoint(x: 40,y: 40)])
    try expect(InkGeometry.intersects(dot, from: InkPoint(x: 0,y: 40), to: InkPoint(x: 80,y: 40), eraserRadius: 1), "Dot sweep missed")
    try expect(!InkGeometry.intersects(dot, from: InkPoint(x: 0,y: 50), to: InkPoint(x: 80,y: 50), eraserRadius: 1), "Distant dot hit")
}
check("page clipping never fabricates edge paths") {
    let exit = InkGeometry.clippedSegment(from: InkPoint(x: 1,y: 10), to: InkPoint(x: -100,y: 10))
    try expect(exit?.1 == InkPoint(x: 0,y: 10), "Wrong exit intersection")
    try expect(InkGeometry.clippedSegment(from: InkPoint(x: -100,y: 10), to: InkPoint(x: -100,y: 200)) == nil, "Outside motion became edge ink")
    let crossing = InkGeometry.clippedSegment(from: InkPoint(x: -100,y: 200), to: InkPoint(x: 700,y: 200))
    try expect(crossing?.0 == InkPoint(x: 0,y: 200) && crossing?.1 == InkPoint(x: 595,y: 200), "Cross-page clipping failed")
    let reentry = InkGeometry.clippedSegment(from: InkPoint(x: -100,y: 200), to: InkPoint(x: 100,y: 300))
    try expect(reentry?.0 == InkPoint(x: 0,y: 250), "Wrong reentry intersection")
    let innocent = InkStroke(points: [InkPoint(x: 5,y: 150),InkPoint(x: 20,y: 150)])
    try expect(!InkGeometry.intersects(innocent, from: InkPoint(x: -100,y: 10), to: InkPoint(x: -100,y: 200)), "Raw outside erase hit page")
}
check("PDF pages, A4 dimensions, rendering and Ardesia byte budget") {
    let data = try NotebookPDF.render(sample())
    guard let pdf = PDFDocument(data: data) else { throw CheckFailure(description: "Invalid PDF") }
    try expect(pdf.pageCount == 2, "Wrong PDF page count")
    try expect(data.count < 32 * 1024 * 1024, "Consumer file budget exceeded")
    for index in 0..<2 {
        guard let page = pdf.page(at: index) else { throw CheckFailure(description: "Missing page") }
        try expect(page.bounds(for: .mediaBox).size == CGSize(width: 595,height: 842), "Wrong A4 bounds")
        try expect(page.thumbnail(of: NSSize(width: 150,height: 210), for: .mediaBox).tiffRepresentation != nil, "PDF rasterization failed")
    }
}

if let index = CommandLine.arguments.firstIndex(of: "--fixture-directory"), CommandLine.arguments.indices.contains(index+1) {
    check("write fresh synthetic interoperability fixtures") {
        let directory = URL(fileURLWithPath: CommandLine.arguments[index+1], isDirectory: true)
        guard !FileManager.default.fileExists(atPath: directory.path) else { throw CheckFailure(description: "Fixture directory already exists; refusing overwrite") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let notebook = sample()
        try NotebookCodec.write(notebook, to: directory.appendingPathComponent("synthetic.ardesiaquaderno"))
        try NotebookPDF.render(notebook).write(to: directory.appendingPathComponent("synthetic.pdf"), options: .withoutOverwriting)
    }
}
let report = try JSONSerialization.data(withJSONObject: ["checks": results, "passed": results.filter { $0["status"] == "PASS" }.count, "failed": results.filter { $0["status"] == "FAIL" }.count], options: [.prettyPrinted, .sortedKeys])
print(String(decoding: report, as: UTF8.self))
if results.contains(where: { $0["status"] == "FAIL" }) { exit(1) }
