import Foundation
import CoreGraphics

public enum NotebookPDF {
    public static func render(_ notebook: Notebook, includePaper: Bool = true) throws -> Data {
        _ = try notebook.validated()
        let output = NSMutableData()
        var mediaBox = CGRect(x: 0, y: 0, width: NotebookLimits.pageWidth, height: NotebookLimits.pageHeight)
        guard let consumer = CGDataConsumer(data: output), let context = CGContext(consumer: consumer, mediaBox: &mediaBox, [kCGPDFContextTitle: notebook.title, kCGPDFContextCreator: "Ardesia Quaderno · macOS"] as CFDictionary) else { throw NotebookError.invalid("Impossibile creare il PDF.") }
        for page in notebook.pages {
            context.beginPDFPage(nil)
            context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(mediaBox)
            context.translateBy(x: 0, y: NotebookLimits.pageHeight); context.scaleBy(x: 1, y: -1)
            if includePaper { drawPaper(page.paper, in: context) }
            for stroke in page.strokes { draw(stroke, in: context) }
            context.endPDFPage()
        }
        context.closePDF()
        guard output.length <= 32 * 1024 * 1024 else { throw NotebookError.invalid("Il PDF supera i 32 MiB accettati da Ardesia. Dividi le pagine in più quaderni prima di esportare.") }
        return output as Data
    }

    public static func drawPaper(_ paper: PaperStyle, in context: CGContext) {
        context.saveGState(); defer { context.restoreGState() }
        switch paper {
        case .plain: break
        case .dots:
            context.setFillColor(CGColor(gray: 0.80, alpha: 1))
            for x in stride(from: 24.0, through: NotebookLimits.pageWidth - 24, by: 18) {
                for y in stride(from: 24.0, through: NotebookLimits.pageHeight - 24, by: 18) { context.fillEllipse(in: CGRect(x: x-0.6, y: y-0.6, width: 1.2, height: 1.2)) }
            }
        case .ruled:
            context.setStrokeColor(CGColor(gray: 0.85, alpha: 1)); context.setLineWidth(0.5)
            for y in stride(from: 42.0, through: NotebookLimits.pageHeight - 24, by: 24) {
                context.move(to: CGPoint(x: 24, y: y)); context.addLine(to: CGPoint(x: NotebookLimits.pageWidth-24, y: y))
            }
            context.strokePath()
        }
    }

    public static func draw(_ stroke: InkStroke, in context: CGContext) {
        guard let first = stroke.points.first else { return }
        context.saveGState(); defer { context.restoreGState() }
        let color = CGColor(red: stroke.color.red, green: stroke.color.green, blue: stroke.color.blue, alpha: 1)
        context.setFillColor(color); context.setStrokeColor(color); context.setLineCap(.round); context.setLineJoin(.round)
        if stroke.points.count == 1 {
            let r = InkGeometry.radius(width: stroke.width, pressure: first.pressure)
            context.fillEllipse(in: CGRect(x: first.x-r, y: first.y-r, width: 2*r, height: 2*r)); return
        }
        // Mouse input has uniform pressure. Keep it as one vector path instead
        // of replaying thousands of independent segments on each pointer move.
        if stroke.points.allSatisfy({ $0.pressure == first.pressure }) {
            context.setLineWidth(2 * InkGeometry.radius(width: stroke.width, pressure: first.pressure))
            context.move(to: CGPoint(x: first.x, y: first.y))
            for point in stroke.points.dropFirst() { context.addLine(to: CGPoint(x: point.x, y: point.y)) }
            context.strokePath(); return
        }
        // Each segment is vector geometry; pressure changes width without rasterizing.
        for i in 1..<stroke.points.count {
            let a = stroke.points[i-1], b = stroke.points[i]
            context.setLineWidth(2 * InkGeometry.radius(width: stroke.width, pressure: (a.pressure + b.pressure)/2))
            context.move(to: CGPoint(x: a.x, y: a.y)); context.addLine(to: CGPoint(x: b.x, y: b.y)); context.strokePath()
        }
    }
}
