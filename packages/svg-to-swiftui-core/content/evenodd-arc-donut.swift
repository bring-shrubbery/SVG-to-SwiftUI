struct EvenOddArcDonutShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0.1*width, y: 0.5*height))
        path.addCurve(to: CGPoint(x: 0.5*width, y: 0.1*height), control1: CGPoint(x: 0.1*width, y: 0.2791*height), control2: CGPoint(x: 0.2791*width, y: 0.1*height))
        path.addCurve(to: CGPoint(x: 0.9*width, y: 0.5*height), control1: CGPoint(x: 0.7209*width, y: 0.1*height), control2: CGPoint(x: 0.9*width, y: 0.2791*height))
        path.addCurve(to: CGPoint(x: 0.5*width, y: 0.9*height), control1: CGPoint(x: 0.9*width, y: 0.7209*height), control2: CGPoint(x: 0.7209*width, y: 0.9*height))
        path.addCurve(to: CGPoint(x: 0.1*width, y: 0.5*height), control1: CGPoint(x: 0.2791*width, y: 0.9*height), control2: CGPoint(x: 0.1*width, y: 0.7209*height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.3*width, y: 0.5*height))
        path.addCurve(to: CGPoint(x: 0.5*width, y: 0.7*height), control1: CGPoint(x: 0.3*width, y: 0.6105*height), control2: CGPoint(x: 0.3895*width, y: 0.7*height))
        path.addCurve(to: CGPoint(x: 0.7*width, y: 0.5*height), control1: CGPoint(x: 0.6105*width, y: 0.7*height), control2: CGPoint(x: 0.7*width, y: 0.6105*height))
        path.addCurve(to: CGPoint(x: 0.5*width, y: 0.3*height), control1: CGPoint(x: 0.7*width, y: 0.3895*height), control2: CGPoint(x: 0.6105*width, y: 0.3*height))
        path.addCurve(to: CGPoint(x: 0.3*width, y: 0.5*height), control1: CGPoint(x: 0.3895*width, y: 0.3*height), control2: CGPoint(x: 0.3*width, y: 0.3895*height))
        path.closeSubpath()
        return path
    }
}