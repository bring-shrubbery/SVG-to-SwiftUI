struct NonZeroTwoRectsShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0, y: 0))
        path.addLine(to: CGPoint(x: width, y: 0))
        path.addLine(to: CGPoint(x: width, y: height))
        path.addLine(to: CGPoint(x: 0, y: height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.3*width, y: 0.3*height))
        path.addLine(to: CGPoint(x: 0.7*width, y: 0.3*height))
        path.addLine(to: CGPoint(x: 0.7*width, y: 0.7*height))
        path.addLine(to: CGPoint(x: 0.3*width, y: 0.7*height))
        path.closeSubpath()
        return path
    }
}