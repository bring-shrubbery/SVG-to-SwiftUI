struct EvenOddMoonShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0.1*width, y: 0.5*height))
        path.addLine(to: CGPoint(x: 0.5*width, y: 0.1*height))
        path.addLine(to: CGPoint(x: 0.9*width, y: 0.5*height))
        path.addLine(to: CGPoint(x: 0.5*width, y: 0.9*height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.55*width, y: 0.5*height))
        path.addLine(to: CGPoint(x: 0.7*width, y: 0.5*height))
        path.addLine(to: CGPoint(x: 0.7*width, y: 0.35*height))
        path.addLine(to: CGPoint(x: 0.55*width, y: 0.35*height))
        path.closeSubpath()
        return path
    }
}