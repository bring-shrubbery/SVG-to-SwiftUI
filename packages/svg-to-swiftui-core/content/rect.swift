struct RectangleShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.addRect(CGRect(x: 0, y: 0, width: 0.454545*width, height: height))
        return path
    }
}