<script>
  let svgInput = "";
  let swiftOutput = "";
  let size = {};

  const moveToSwiftString = point => `path.move(to: CGPoint(x: ${point.x/size.width}*width, y: ${point.y/size.height}*height))`;
  const lineToSwiftString = point => `path.addLine(to: CGPoint(x: ${point.x/size.width}*width, y: ${point.y/size.height}*height))`;
  const closePathSwiftString = point => "path.closeSubpath()";
  const curveToSwiftString = pts => {
    return [`path.addCurve(to: CGPoint(x: ${pts.p.x/size.width}*width, y: ${pts.p.y/size.height}*height),`,
    `control1: CGPoint(x: ${pts.c1.x/size.width}*width, y: ${pts.c1.y/size.height}*height),`,
    `control2: CGPoint(x: ${pts.c2.x/size.width}*width, y: ${pts.c2.y/size.height}*height))`
    ].join(" ")
  }


  const generateFinalSwiftString = (props) => {
    const points = [...props.points];
    let swiftPoints = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      switch(p.flag) {
        case "M":
          swiftPoints.push(moveToSwiftString(p));
          break;
        case "L":
          swiftPoints.push(lineToSwiftString(p));
          break;

        case "C":
          const c1 = points[i+1];
          const c2 = points[i+2];

          swiftPoints.push(curveToSwiftString({ p: c2, c1: p, c2: c1 }));

          break;

        case "Z":
          swiftPoints.push(closePathSwiftString(p));
          break;

        case "H":
          console.log("Horizontal lines are not implemented!")
          break;

        case "V":
          console.log("Vertical lines are not implemented!")
          break;

        case "S":
          console.log("S lines are not implemented!")
          break;

        case "Q":
          console.log("Q lines are not implemented!")
          break;

        case "T":
          console.log("T lines are not implemented!")
          break;

        case "A":
          console.log("A lines are not implemented!")
          break;
        default:
          console.log("HMMMMMmmmmm");
      }
    }

    console.log(swiftPoints)

    return [
      `struct ${props.title}: Shape {`,
      `    func path(in rect: CGRect) -> Path {`,
      `        var path = Path()`,
      `        let width = rect.size.width`,
      `        let height = rect.size.height`,
      ``,
      ...swiftPoints.map(v => "        "+v),
      ``,
      `        return path`,
      `    }`,
      `}`
    ].join('\n');
  }

  const getPathIndex = text => {
    console.log(text);
    const pattern = /\<path(.|\n|\r)*((\><\/path\>)|(\/\>))/;
    const regex = RegExp(pattern);
    return regex.exec(text);
  };

  const getDataString = text => {
    console.log(text);
    const pattern = /\sd\=\"(.|\n|\r)+\"(\s|\>)(?!\<\/path\>)/;
    const regex = RegExp(pattern);
    return regex.exec(text);
  };

  const getPoints = text => {
    text = String(text).trim();
    const s_points = String(text).split(" ");
    return s_points.map(val => {
      let flag = "";
      if (RegExp(/^\D/).test(val[0])) {
        flag = val[0];
        val = val.substring(1);
      }

      const nums = String(val)
        .split(",")
        .map(s_num => parseFloat(s_num));

      return { flag, x: nums[0], y: nums[1] };
    });
  };

  const getWidthAndHeight = svg => {
    let text = String(svg);

    const widthRegex = /\swidth\=\".*\"/
    const heightRegex = /\sheight\=\".*\"/

    const widthString = String(RegExp(widthRegex).exec(text));
    const heightString = String(RegExp(heightRegex).exec(text));

    if (widthString == 'undefined' || heightString == 'undefined') {
      // const viewBoxRegex = /\sviewBox\=\".*\"/
      // TODO: Load viewBox dimensions.
    } else {
      return {
        width: parseInt(widthString.substring(8, widthString.length-2)),
        height: parseInt(heightString.substring(9, heightString.length-2))
      }
    }
  };

  const generateSwiftCode = () => {
    size = getWidthAndHeight(svgInput);

    console.log(size)

    const pathString = getPathIndex(svgInput)[0];
    const dataString = getDataString(pathString)[0].substring(
      4,
      pathString.length - 2
    );
    const points = getPoints(dataString);
    console.log(points);

    const swiftString = generateFinalSwiftString({
      title: "MyCustomShape",
      points
    });

    swiftOutput = swiftString;
  };
</script>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
    margin: 10px auto;
  }

  textarea {
    width: 600px;
    height: 200px;
    max-width: 600px;
    max-height: 200px;
    min-width: 300px;
    min-height: 100px;
    font-family: "Courier New", Courier, monospace;
    font-size: 10pt;
  }

  #swift-output-area {
    max-height: 1000px;
    height: 400px;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>

<main>
  <h1>Welcome!</h1>
  <i>Functionality is very limited for now, feel free to contribute on <a href="https://github.com/bring-shrubbery/SVG-to-SwiftUI" target="_blank">Github</a>.</i>
  <h2>Paste SVG code below:</h2>
  <div>
    <textarea bind:value={svgInput} />
  </div>
  <button on:click={generateSwiftCode}>Convert to SwiftUI Shape!</button>
  <h2>Swift code wil be shown below:</h2>
  <div>
    <textarea value={swiftOutput} id="swift-output-area"/>
  </div>
</main>
