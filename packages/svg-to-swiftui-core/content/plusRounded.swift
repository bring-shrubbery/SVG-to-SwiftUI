struct MyCustomShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0.33333*width, y: 0.33333*height))
        path.addCurve(to: CGPoint(x: 0.33333*width, y: 0.06667*height), control1: CGPoint(x: 0.33333*width, y: 0.19958*height), control2: CGPoint(x: 0.33333*width, y: 0.11069*height))
        path.addCurve(to: CGPoint(x: 0.4*width, y: 0), control1: CGPoint(x: 0.33333*width, y: 0.02264*height), control2: CGPoint(x: 0.35556*width, y: 0.00042*height))
        path.addLine(to: CGPoint(x: 0.6*width, y: 0))
        path.addCurve(to: CGPoint(x: 0.66667*width, y: 0.06667*height), control1: CGPoint(x: 0.64444*width, y: -0.00001*height), control2: CGPoint(x: 0.66667*width, y: 0.02221*height))
        path.addCurve(to: CGPoint(x: 0.66667*width, y: 0.33333*height), control1: CGPoint(x: 0.66667*width, y: 0.11112*height), control2: CGPoint(x: 0.66667*width, y: 0.20001*height))
        path.addCurve(to: CGPoint(x: 0.93333*width, y: 0.33333*height), control1: CGPoint(x: 0.8*width, y: 0.33333*height), control2: CGPoint(x: 0.88889*width, y: 0.33333*height))
        path.addCurve(to: CGPoint(x: 1.00001*width, y: 0.4*height), control1: CGPoint(x: 0.97778*width, y: 0.33333*height), control2: CGPoint(x: 1.00001*width, y: 0.35556*height))
        path.addLine(to: CGPoint(x: 1.00001*width, y: 0.6*height))
        path.addCurve(to: CGPoint(x: 0.93333*width, y: 0.66667*height), control1: CGPoint(x: 1.00017*width, y: 0.64444*height), control2: CGPoint(x: 0.97795*width, y: 0.66667*height))
        path.addCurve(to: CGPoint(x: 0.66667*width, y: 0.66667*height), control1: CGPoint(x: 0.88872*width, y: 0.66667*height), control2: CGPoint(x: 0.79983*width, y: 0.66667*height))
        path.addCurve(to: CGPoint(x: 0.66667*width, y: 0.93333*height), control1: CGPoint(x: 0.66667*width, y: 0.8*height), control2: CGPoint(x: 0.66667*width, y: 0.88889*height))
        path.addCurve(to: CGPoint(x: 0.6*width, y: height), control1: CGPoint(x: 0.66667*width, y: 0.97778*height), control2: CGPoint(x: 0.64444*width, y: height))
        path.addLine(to: CGPoint(x: 0.4*width, y: height))
        path.addCurve(to: CGPoint(x: 0.33333*width, y: 0.93333*height), control1: CGPoint(x: 0.35556*width, y: 1.00037*height), control2: CGPoint(x: 0.33333*width, y: 0.97814*height))
        path.addCurve(to: CGPoint(x: 0.33333*width, y: 0.66667*height), control1: CGPoint(x: 0.33333*width, y: 0.88852*height), control2: CGPoint(x: 0.33333*width, y: 0.79964*height))
        path.addCurve(to: CGPoint(x: 0.06667*width, y: 0.66667*height), control1: CGPoint(x: 0.2*width, y: 0.66667*height), control2: CGPoint(x: 0.11111*width, y: 0.66667*height))
        path.addCurve(to: CGPoint(x: 0, y: 0.6*height), control1: CGPoint(x: 0.02222*width, y: 0.66667*height), control2: CGPoint(x: 0, y: 0.64444*height))
        path.addLine(to: CGPoint(x: 0, y: 0.4*height))
        path.addCurve(to: CGPoint(x: 0.06667*width, y: 0.33333*height), control1: CGPoint(x: -0.00011*width, y: 0.35556*height), control2: CGPoint(x: 0.02212*width, y: 0.33333*height))
        path.addCurve(to: CGPoint(x: 0.33333*width, y: 0.33333*height), control1: CGPoint(x: 0.11122*width, y: 0.33333*height), control2: CGPoint(x: 0.20011*width, y: 0.33333*height))
        path.closeSubpath()
        return path
    }
}