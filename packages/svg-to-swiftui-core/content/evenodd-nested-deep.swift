struct EvenOddNestedDeepShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0, y: 0))
        path.addLine(to: CGPoint(x: width, y: 0))
        path.addLine(to: CGPoint(x: width, y: height))
        path.addLine(to: CGPoint(x: 0, y: height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.2*width, y: 0.8*height))
        path.addLine(to: CGPoint(x: 0.8*width, y: 0.8*height))
        path.addLine(to: CGPoint(x: 0.8*width, y: 0.2*height))
        path.addLine(to: CGPoint(x: 0.2*width, y: 0.2*height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.4*width, y: 0.4*height))
        path.addLine(to: CGPoint(x: 0.6*width, y: 0.4*height))
        path.addLine(to: CGPoint(x: 0.6*width, y: 0.6*height))
        path.addLine(to: CGPoint(x: 0.4*width, y: 0.6*height))
        path.closeSubpath()
        return path
    }
}