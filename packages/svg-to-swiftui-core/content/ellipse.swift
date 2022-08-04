struct EllipseShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.addEllipse(in: CGRect(x: 0.075*width, y: 0.26*height, width: 0.75*width, height: 0.68*height))
        return path
    }
}