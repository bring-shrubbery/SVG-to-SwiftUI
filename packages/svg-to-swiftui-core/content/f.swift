struct FaIcon: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.addRect(CGRect(x: 0, y: 0, width: width, height: height))
        path.move(to: CGPoint(x: 0.55886*width, y: height))
        path.addLine(to: CGPoint(x: 0.55886*width, y: 0.61328*height))
        path.addLine(to: CGPoint(x: 0.68923*width, y: 0.61328*height))
        path.addLine(to: CGPoint(x: 0.708762*width, y: 0.461914*height))
        path.addLine(to: CGPoint(x: 0.55886*width, y: 0.461914*height))
        path.addLine(to: CGPoint(x: 0.55886*width, y: 0.365508*height))
        path.addCurve(to: CGPoint(x: 0.633696*width, y: 0.291992*height), control1: CGPoint(x: 0.55886*width, y: 0.321784*height), control2: CGPoint(x: 0.570998*width, y: 0.291992*height))
        path.addLine(to: CGPoint(x: 0.713156*width, y: 0.291992*height))
        path.addLine(to: CGPoint(x: 0.713156*width, y: 0.156974*height))
        path.addCurve(to: CGPoint(x: 0.59671*width, y: 0.151023*height), control1: CGPoint(x: 0.699332*width, y: 0.155135*height), control2: CGPoint(x: 0.6519*width, y: 0.151023*height))
        path.addCurve(to: CGPoint(x: 0.40261*width, y: 0.350516*height), control1: CGPoint(x: 0.481474*width, y: 0.151023*height), control2: CGPoint(x: 0.40261*width, y: 0.221336*height))
        path.addLine(to: CGPoint(x: 0.40261*width, y: 0.461914*height))
        path.addLine(to: CGPoint(x: 0.272728*width, y: 0.461914*height))
        path.addLine(to: CGPoint(x: 0.272728*width, y: 0.61328*height))
        path.addLine(to: CGPoint(x: 0.40261*width, y: 0.61328*height))
        path.addLine(to: CGPoint(x: 0.40261*width, y: height))
        path.addLine(to: CGPoint(x: 0.55886*width, y: height))
        path.closeSubpath()
        return path
    }
}