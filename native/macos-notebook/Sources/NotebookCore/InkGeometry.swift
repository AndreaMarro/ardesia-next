import Foundation

public enum InkGeometry {
    public static func radius(width: Double, pressure: Double) -> Double { width * (0.35 + 0.65 * pressure) / 2 }

    /// Liang–Barsky clipping of the real pointer segment. Clamping endpoints
    /// independently would fabricate lines along the page edge.
    public static func clippedSegment(from a: InkPoint, to b: InkPoint) -> (InkPoint, InkPoint)? {
        guard [a.x,a.y,a.pressure,b.x,b.y,b.pressure].allSatisfy(\.isFinite) else { return nil }
        let dx = b.x-a.x, dy = b.y-a.y
        var lower = 0.0, upper = 1.0
        for (p,q) in [(-dx,a.x),(dx,NotebookLimits.pageWidth-a.x),(-dy,a.y),(dy,NotebookLimits.pageHeight-a.y)] {
            if p == 0 { if q < 0 { return nil }; continue }
            let ratio = q/p
            if p < 0 { lower = max(lower,ratio) } else { upper = min(upper,ratio) }
            if lower > upper { return nil }
        }
        func point(_ t: Double) -> InkPoint {
            InkPoint(x: max(0,min(NotebookLimits.pageWidth,a.x+t*dx)), y: max(0,min(NotebookLimits.pageHeight,a.y+t*dy)), pressure: max(0,min(1,a.pressure+t*(b.pressure-a.pressure))))
        }
        return (point(lower),point(upper))
    }

    public static func squaredDistance(_ p: InkPoint, _ a: InkPoint, _ b: InkPoint) -> Double {
        let dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy
        let t = length == 0 ? 0 : max(0, min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
        let ex = p.x - a.x - t * dx, ey = p.y - a.y - t * dy
        return ex * ex + ey * ey
    }

    private static func segmentsIntersect(_ a: InkPoint, _ b: InkPoint, _ c: InkPoint, _ d: InkPoint) -> Bool {
        func cross(_ p: InkPoint, _ q: InkPoint, _ r: InkPoint) -> Double { (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x) }
        let abC = cross(a,b,c), abD = cross(a,b,d), cdA = cross(c,d,a), cdB = cross(c,d,b)
        // Collinear/zero-length cases are handled by distance below.
        return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
    }

    public static func intersects(_ stroke: InkStroke, from: InkPoint, to: InkPoint, eraserRadius: Double = 10) -> Bool {
        guard let first = stroke.points.first else { return false }
        if stroke.points.count == 1 {
            let r = eraserRadius + radius(width: stroke.width, pressure: first.pressure)
            return squaredDistance(first, from, to) <= r*r
        }
        for i in 1..<stroke.points.count {
            let a = stroke.points[i-1], b = stroke.points[i]
            let r = eraserRadius + max(radius(width: stroke.width, pressure: a.pressure), radius(width: stroke.width, pressure: b.pressure))
            if segmentsIntersect(a,b,from,to) || min(squaredDistance(a,from,to), squaredDistance(b,from,to), squaredDistance(from,a,b), squaredDistance(to,a,b)) <= r*r { return true }
        }
        return false
    }
}
