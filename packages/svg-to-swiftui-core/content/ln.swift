struct LnIcon: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.addRect(CGRect(x: 0, y: 0, width: width, height: height))
        path.move(to: CGPoint(x: 0.884836*width, y: 0.863637*height))
        path.addLine(to: CGPoint(x: 0.884836*width, y: 0.863606*height))
        path.addLine(to: CGPoint(x: 0.885027*width, y: 0.863606*height))
        path.addLine(to: CGPoint(x: 0.885027*width, y: 0.596879*height))
        path.addCurve(to: CGPoint(x: 0.693765*width, y: 0.365879*height), control1: CGPoint(x: 0.885027*width, y: 0.466394*height), control2: CGPoint(x: 0.855285*width, y: 0.365879*height))
        path.addCurve(to: CGPoint(x: 0.542739*width, y: 0.444273*height), control1: CGPoint(x: 0.616119*width, y: 0.365879*height), control2: CGPoint(x: 0.564012*width, y: 0.406121*height))
        path.addLine(to: CGPoint(x: 0.540493*width, y: 0.444273*height))
        path.addLine(to: CGPoint(x: 0.540493*width, y: 0.378061*height))
        path.addLine(to: CGPoint(x: 0.387349*width, y: 0.378061*height))
        path.addLine(to: CGPoint(x: 0.387349*width, y: 0.863606*height))
        path.addLine(to: CGPoint(x: 0.546813*width, y: 0.863606*height))
        path.addLine(to: CGPoint(x: 0.546813*width, y: 0.623182*height))
        path.addCurve(to: CGPoint(x: 0.642525*width, y: 0.498667*height), control1: CGPoint(x: 0.546813*width, y: 0.559879*height), control2: CGPoint(x: 0.559519*width, y: 0.498667*height))
        path.addCurve(to: CGPoint(x: 0.72553*width, y: 0.627243*height), control1: CGPoint(x: 0.724311*width, y: 0.498667*height), control2: CGPoint(x: 0.72553*width, y: 0.57091*height))
        path.addLine(to: CGPoint(x: 0.72553*width, y: 0.863637*height))
        path.addLine(to: CGPoint(x: 0.884836*width, y: 0.863637*height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.127681*width, y: 0.37809*height))
        path.addLine(to: CGPoint(x: 0.287338*width, y: 0.37809*height))
        path.addLine(to: CGPoint(x: 0.287338*width, y: 0.863637*height))
        path.addLine(to: CGPoint(x: 0.127681*width, y: 0.863637*height))
        path.addLine(to: CGPoint(x: 0.127681*width, y: 0.37809*height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.207445*width, y: 0.136364*height))
        path.addCurve(to: CGPoint(x: 0.114974*width, y: 0.223698*height), control1: CGPoint(x: 0.156396*width, y: 0.136364*height), control2: CGPoint(x: 0.114974*width, y: 0.175485*height))
        path.addCurve(to: CGPoint(x: 0.207445*width, y: 0.311849*height), control1: CGPoint(x: 0.114974*width, y: 0.27191*height), control2: CGPoint(x: 0.156396*width, y: 0.311849*height))
        path.addCurve(to: CGPoint(x: 0.299915*width, y: 0.223698*height), control1: CGPoint(x: 0.258493*width, y: 0.311849*height), control2: CGPoint(x: 0.299915*width, y: 0.27191*height))
        path.addCurve(to: CGPoint(x: 0.207445*width, y: 0.136364*height), control1: CGPoint(x: 0.299883*width, y: 0.175485*height), control2: CGPoint(x: 0.258461*width, y: 0.136364*height))
        path.addLine(to: CGPoint(x: 0.207445*width, y: 0.136364*height))
        path.closeSubpath()
        return path
    }
}