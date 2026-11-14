import AppKit
import SwiftUI
import NotebookCore

/// SwiftUI owns document values. This boundary owns only live pointer input and viewport.
struct InkCanvas: NSViewRepresentable {
    @ObservedObject var document: NotebookDocument

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = CanvasScrollView()
        scroll.hasVerticalScroller = true; scroll.hasHorizontalScroller = true
        scroll.autohidesScrollers = true
        scroll.allowsMagnification = true; scroll.minMagnification = 0.35; scroll.maxMagnification = 2.5
        scroll.backgroundColor = .underPageBackgroundColor
        scroll.contentView = CenteredClipView()
        scroll.contentView.drawsBackground = false
        let canvas = InkCanvasView(frame: NSRect(x: 0, y: 0, width: NotebookLimits.pageWidth+64, height: NotebookLimits.pageHeight+64))
        canvas.setAccessibilityElement(true)
        canvas.setAccessibilityRole(.image)
        canvas.setAccessibilityLabel("Pagina del quaderno. Disegna con il puntatore; usa Mano per spostarti e i controlli Zoom per ingrandire.")
        scroll.documentView = canvas
        scroll.onZoom = { [weak document] value in
            guard let document, abs(document.zoom-value) > 0.005 else { return }
            document.zoom = value
        }
        return scroll
    }
    func updateNSView(_ scroll: NSScrollView, context: Context) {
        guard let canvas = scroll.documentView as? InkCanvasView else { return }
        if canvas.page?.id != document.page.id { canvas.finish() }
        canvas.page = document.page
        canvas.tool = document.tool; canvas.color = document.color; canvas.lineWidth = document.strokeWidth
        canvas.remainingPoints = NotebookLimits.maxPoints - document.notebook.pointCount
        canvas.remainingStrokes = NotebookLimits.maxStrokes - document.notebook.strokeCount
        canvas.onStroke = { [weak document] stroke, id in document?.append(stroke, to: id) }
        canvas.onErase = { [weak document] ids, page in document?.erase(ids, on: page) }
        canvas.onStatus = { [weak document] text in document?.status = text }
        document.finishGesture = { [weak canvas] in canvas?.finish() }
        if abs(scroll.magnification-document.zoom) > 0.005 { scroll.setMagnification(document.zoom, centeredAt: NSPoint(x: canvas.bounds.midX, y: canvas.visibleRect.midY)) }
    }
    static func dismantleNSView(_ scroll: NSScrollView, coordinator: ()) { (scroll.documentView as? InkCanvasView)?.finish() }
}

private final class CanvasScrollView: NSScrollView {
    var onZoom: ((Double) -> Void)?
    override func magnify(with event: NSEvent) { super.magnify(with: event); onZoom?(magnification) }
}

private final class CenteredClipView: NSClipView {
    override func constrainBoundsRect(_ proposedBounds: NSRect) -> NSRect {
        var rect = super.constrainBoundsRect(proposedBounds)
        guard let documentView else { return rect }
        if rect.width > documentView.frame.width { rect.origin.x = (documentView.frame.width-rect.width)/2 }
        if rect.height > documentView.frame.height { rect.origin.y = (documentView.frame.height-rect.height)/2 }
        return rect
    }
}

final class InkCanvasView: NSView {
    var page: NotebookPage? { didSet { if page != oldValue { needsDisplay = true } } }
    var tool: DrawingTool = .pen { didSet { if oldValue != tool { finish(); window?.invalidateCursorRects(for: self) } } }
    var color = InkColor.graphite
    var lineWidth = 2.5
    var remainingPoints = NotebookLimits.maxPoints
    var remainingStrokes = NotebookLimits.maxStrokes
    var onStroke: (([InkStroke], UUID) -> Void)?
    var onErase: ((Set<UUID>, UUID) -> Void)?
    var onStatus: ((String) -> Void)?
    private var pending: InkStroke?
    private var fragments: [InkStroke] = []
    private var gestureTool: DrawingTool?
    private var gestureColor = InkColor.graphite
    private var gestureWidth = 2.5
    private var gesturePointCount = 0
    private var gesturePage: UUID?
    private var erased = Set<UUID>()
    private var lastPoint: InkPoint?
    private var panStart: NSPoint?
    private var panOrigin: NSPoint?
    private var spaceHeld = false
    private let pageRect = NSRect(x: 32, y: 32, width: NotebookLimits.pageWidth, height: NotebookLimits.pageHeight)
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func resetCursorRects() {
        addCursorRect(bounds, cursor: tool == .hand || spaceHeld ? .openHand : .crosshair)
    }
    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        NSColor.underPageBackgroundColor.setFill(); bounds.fill()
        context.saveGState()
        context.setShadow(offset: CGSize(width: 0, height: 1), blur: 9, color: CGColor(gray: 0, alpha: 0.16))
        context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(pageRect)
        context.restoreGState()
        context.saveGState(); defer { context.restoreGState() }
        context.clip(to: pageRect)
        context.translateBy(x: pageRect.minX, y: pageRect.minY)
        if let page {
            NotebookPDF.drawPaper(page.paper, in: context)
            for stroke in page.strokes where !erased.contains(stroke.id) { NotebookPDF.draw(stroke, in: context) }
        }
        if let pending { NotebookPDF.draw(pending, in: context) }
        for stroke in fragments { NotebookPDF.draw(stroke, in: context) }
    }
    private func point(_ event: NSEvent, requireInside: Bool = false) -> InkPoint? {
        let position = convert(event.locationInWindow, from: nil)
        if requireInside && !pageRect.contains(position) { return nil }
        let tablet = event.subtype == .tabletPoint || event.type == .tabletPoint
        let pressure = tablet ? Double(event.pressure) : 1
        guard position.x.isFinite && position.y.isFinite && pressure.isFinite else { return nil }
        return InkPoint(x: position.x-pageRect.minX, y: position.y-pageRect.minY, pressure: max(0,min(1,pressure)))
    }
    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        finish()
        if tool == .hand || spaceHeld {
            panStart = event.locationInWindow; panOrigin = enclosingScrollView?.contentView.bounds.origin
            NSCursor.closedHand.push(); return
        }
        guard let point = point(event, requireInside: true), let page else { return }
        gesturePage = page.id; lastPoint = point; gestureTool = tool
        gestureColor = color; gestureWidth = lineWidth
        if tool == .pen {
            guard remainingPoints > 0 && remainingStrokes > 0 else {
                gesturePage = nil; onStatus?("Limite del quaderno raggiunto. Salva e crea un nuovo quaderno per continuare."); return
            }
            pending = InkStroke(color: color, width: lineWidth, points: [point])
            gesturePointCount = 1
        } else { erase(from: point, to: point) }
        needsDisplay = true
    }
    override func mouseDragged(with event: NSEvent) {
        if let start = panStart, let origin = panOrigin, let scroll = enclosingScrollView {
            let delta = NSPoint(x: (event.locationInWindow.x-start.x)/scroll.magnification, y: (event.locationInWindow.y-start.y)/scroll.magnification)
            scroll.contentView.scroll(to: NSPoint(x: origin.x-delta.x, y: origin.y+delta.y))
            scroll.reflectScrolledClipView(scroll.contentView); return
        }
        guard gesturePage != nil, let point = point(event), let last = lastPoint else { return }
        if gestureTool == .pen {
            if let (entry,exit) = InkGeometry.clippedSegment(from: last, to: point) {
                if pending == nil && !beginFragment(at: entry) { return }
                if let previous = pending?.points.last,
                   hypot(exit.x-previous.x,exit.y-previous.y) >= 0.45 || abs(exit.pressure-previous.pressure) > 0.05 {
                    if pending!.points.count >= NotebookLimits.maxPointsPerStroke {
                        fragments.append(pending!); pending = nil
                        if !beginFragment(at: previous) { return }
                    }
                    guard gesturePointCount < remainingPoints else { finishAtLimit(); return }
                    pending?.points.append(exit); gesturePointCount += 1
                }
            }
            let outside = point.x < 0 || point.y < 0 || point.x > NotebookLimits.pageWidth || point.y > NotebookLimits.pageHeight
            if outside, let stroke = pending { fragments.append(stroke); pending = nil }
        } else if gestureTool == .eraser { erase(from: last, to: point) }
        lastPoint = point; needsDisplay = true
    }
    override func mouseUp(with event: NSEvent) { mouseDragged(with: event); finish() }
    private func erase(from: InkPoint, to: InkPoint) {
        for stroke in page?.strokes ?? [] where !erased.contains(stroke.id) {
            if InkGeometry.intersects(stroke, from: from, to: to) { erased.insert(stroke.id) }
        }
    }
    private func beginFragment(at point: InkPoint) -> Bool {
        guard fragments.count < remainingStrokes && gesturePointCount < remainingPoints else { finishAtLimit(); return false }
        pending = InkStroke(color: gestureColor, width: gestureWidth, points: [point]); gesturePointCount += 1
        return true
    }
    private func finishAtLimit() {
        finish(); onStatus?("Limite del quaderno raggiunto. I tratti raccolti sono conservati: salva e continua in un nuovo quaderno.")
    }
    func finish() {
        let strokes = fragments + (pending.map { [$0] } ?? []), ids = erased, pageID = gesturePage
        pending = nil; fragments = []; erased = []; gesturePage = nil; lastPoint = nil
        gestureTool = nil; gesturePointCount = 0
        if panStart != nil { NSCursor.pop() }
        panStart = nil; panOrigin = nil
        if let pageID {
            if !strokes.isEmpty { onStroke?(strokes, pageID) }
            else if !ids.isEmpty { onErase?(ids, pageID) }
        }
        if !strokes.isEmpty || !ids.isEmpty { needsDisplay = true }
    }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 49 && !event.isARepeat { finish(); spaceHeld = true; window?.invalidateCursorRects(for: self); return }
        if event.keyCode == 53 { finish(); return }
        super.keyDown(with: event)
    }
    override func keyUp(with event: NSEvent) {
        if event.keyCode == 49 { finish(); spaceHeld = false; window?.invalidateCursorRects(for: self); return }
        super.keyUp(with: event)
    }
    override func resignFirstResponder() -> Bool { finish(); spaceHeld = false; return super.resignFirstResponder() }
    override func viewWillMove(toWindow newWindow: NSWindow?) { if newWindow == nil { finish() }; super.viewWillMove(toWindow: newWindow) }
}
