import Foundation

public enum NotebookLimits {
    public static let maxFileBytes = 32 * 1024 * 1024
    public static let maxPages = 64
    public static let maxStrokes = 4_000
    public static let maxPoints = 250_000
    public static let maxPointsPerStroke = 20_000
    public static let pageWidth = 595.0
    public static let pageHeight = 842.0
}

public enum NotebookError: LocalizedError, Equatable {
    case invalid(String)
    public var errorDescription: String? {
        switch self { case .invalid(let message): return message }
    }
}

public struct InkColor: Codable, Equatable, Hashable, Sendable {
    public var red: Double
    public var green: Double
    public var blue: Double
    public init(_ red: Double, _ green: Double, _ blue: Double) {
        self.red = red; self.green = green; self.blue = blue
    }
    public static let graphite = InkColor(0.12, 0.19, 0.23)
    public static let forest = InkColor(0.16, 0.38, 0.29)
    public static let blue = InkColor(0.14, 0.34, 0.65)
    public static let red = InkColor(0.72, 0.22, 0.23)
    public static let ochre = InkColor(0.66, 0.40, 0.10)
    public static let purple = InkColor(0.47, 0.29, 0.61)
    public static let palette: [(String, InkColor)] = [
        ("Grafite", .graphite), ("Bosco", .forest), ("Blu", .blue),
        ("Rosso", .red), ("Ocra", .ochre), ("Viola", .purple)
    ]
}

public struct InkPoint: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var pressure: Double
    public init(x: Double, y: Double, pressure: Double = 1) {
        self.x = x; self.y = y; self.pressure = pressure
    }
}

public struct InkStroke: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var color: InkColor
    public var width: Double
    public var points: [InkPoint]
    public init(id: UUID = UUID(), color: InkColor = .graphite, width: Double = 2.5, points: [InkPoint]) {
        self.id = id; self.color = color; self.width = width; self.points = points
    }
}

public enum PaperStyle: String, Codable, CaseIterable, Sendable {
    case dots, ruled, plain
    public var label: String {
        switch self { case .dots: return "Puntini"; case .ruled: return "Righe"; case .plain: return "Bianco" }
    }
}

public struct NotebookPage: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var title: String
    public var paper: PaperStyle
    public var strokes: [InkStroke]
    public init(id: UUID = UUID(), title: String = "Pagina 1", paper: PaperStyle = .dots, strokes: [InkStroke] = []) {
        self.id = id; self.title = title; self.paper = paper; self.strokes = strokes
    }
}

public struct Notebook: Codable, Equatable, Sendable {
    public var format: String
    public var schemaVersion: Int
    public var id: UUID
    public var title: String
    public var pages: [NotebookPage]
    public init(title: String = "Il mio quaderno", pages: [NotebookPage] = [NotebookPage()]) {
        format = "ardesia-native-notebook"; schemaVersion = 1; id = UUID()
        self.title = title; self.pages = pages
    }
    public var pointCount: Int { pages.reduce(0) { $0 + $1.strokes.reduce(0) { $0 + $1.points.count } } }
    public var strokeCount: Int { pages.reduce(0) { $0 + $1.strokes.count } }

    public func validated() throws -> Self {
        func require(_ value: Bool, _ message: String) throws {
            if !value { throw NotebookError.invalid(message) }
        }
        try require(format == "ardesia-native-notebook" && schemaVersion == 1, "Formato o versione del quaderno non supportati. L’originale non è stato modificato.")
        try require(!title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && title.count <= 120, "Il titolo del quaderno deve contenere da 1 a 120 caratteri.")
        try require((1...NotebookLimits.maxPages).contains(pages.count), "Il quaderno deve contenere da 1 a 64 pagine.")
        try require(strokeCount <= NotebookLimits.maxStrokes && pointCount <= NotebookLimits.maxPoints, "Quaderno troppo grande: massimo 4.000 tratti e 250.000 punti. Crea un altro quaderno per continuare.")
        var ids = Set<UUID>([id])
        for page in pages {
            try require(ids.insert(page.id).inserted, "Identità duplicate nel quaderno.")
            try require(!page.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && page.title.count <= 120, "Ogni pagina deve avere un titolo da 1 a 120 caratteri.")
            for stroke in page.strokes {
                try require(ids.insert(stroke.id).inserted, "Identità duplicate nel quaderno.")
                try require(stroke.width.isFinite && (0.5...16).contains(stroke.width), "Spessore di un tratto non valido.")
                try require([stroke.color.red, stroke.color.green, stroke.color.blue].allSatisfy { $0.isFinite && (0...1).contains($0) }, "Colore di un tratto non valido.")
                try require((1...NotebookLimits.maxPointsPerStroke).contains(stroke.points.count), "Un tratto deve contenere da 1 a 20.000 punti.")
                for p in stroke.points {
                    try require(p.x.isFinite && p.y.isFinite && p.pressure.isFinite && (0...NotebookLimits.pageWidth).contains(p.x) && (0...NotebookLimits.pageHeight).contains(p.y) && (0...1).contains(p.pressure), "Coordinate o pressione di un tratto non valide.")
                }
            }
        }
        return self
    }
}
