import Foundation

public enum NotebookCodec {
    public static func decode(_ data: Data) throws -> Notebook {
        guard data.count <= NotebookLimits.maxFileBytes else { throw NotebookError.invalid("Il file supera il limite di 32 MiB.") }
        do {
            // Codable otherwise drops unknown keys on the next save. Reject
            // unrecognized fields rather than silently losing future metadata.
            try validateShape(JSONSerialization.jsonObject(with: data))
            return try JSONDecoder().decode(Notebook.self, from: data).validated()
        }
        catch let error as NotebookError { throw error }
        catch { throw NotebookError.invalid("Il file non è un quaderno Ardesia valido. L’originale è rimasto intatto.") }
    }
    public static func encode(_ notebook: Notebook) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(notebook.validated())
        guard data.count <= NotebookLimits.maxFileBytes else { throw NotebookError.invalid("Il file supera il limite di 32 MiB.") }
        return data
    }
    public static func read(_ url: URL) throws -> Notebook {
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
        guard values.isRegularFile == true, (values.fileSize ?? Int.max) <= NotebookLimits.maxFileBytes else { throw NotebookError.invalid("Scegli un file quaderno regolare, fino a 32 MiB.") }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        return try decode(handle.read(upToCount: NotebookLimits.maxFileBytes + 1) ?? Data())
    }
    /// Only call after an explicit user save destination / replacement confirmation.
    public static func write(_ notebook: Notebook, to url: URL) throws {
        try encode(notebook).write(to: url, options: .atomic)
    }

    private static func validateShape(_ input: Any) throws {
        func object(_ input: Any, keys: Set<String>) throws -> [String: Any] {
            guard let value = input as? [String: Any], Set(value.keys) == keys else {
                throw NotebookError.invalid("Il quaderno contiene campi mancanti o non supportati. L’originale non verrà riscritto.")
            }
            return value
        }
        let notebook = try object(input, keys: ["format", "schemaVersion", "id", "title", "pages"])
        guard let pages = notebook["pages"] as? [Any], (1...NotebookLimits.maxPages).contains(pages.count) else { throw NotebookError.invalid("Numero di pagine non valido.") }
        var totalStrokes = 0, totalPoints = 0
        for rawPage in pages {
            let page = try object(rawPage, keys: ["id", "title", "paper", "strokes"])
            guard let strokes = page["strokes"] as? [Any] else { throw NotebookError.invalid("Tratti non validi.") }
            totalStrokes += strokes.count
            guard totalStrokes <= NotebookLimits.maxStrokes else { throw NotebookError.invalid("Troppi tratti nel quaderno.") }
            for rawStroke in strokes {
                let stroke = try object(rawStroke, keys: ["id", "color", "width", "points"])
                _ = try object(stroke["color"] as Any, keys: ["red", "green", "blue"])
                guard let points = stroke["points"] as? [Any], (1...NotebookLimits.maxPointsPerStroke).contains(points.count) else { throw NotebookError.invalid("Numero di punti non valido.") }
                totalPoints += points.count
                guard totalPoints <= NotebookLimits.maxPoints else { throw NotebookError.invalid("Troppi punti nel quaderno.") }
                for point in points { _ = try object(point, keys: ["x", "y", "pressure"]) }
            }
        }
    }
}
