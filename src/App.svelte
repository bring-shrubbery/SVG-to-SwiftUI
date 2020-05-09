<script>
  import { parse } from 'svg-parser'
  import SwiftGenerator from './Converter/SwiftGenerator'

  let svgInput = `<svg width="300px" height="300px" viewBox="0 0 300 300" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <path d="M100,100 C100,59.875 100,33.2083333 100,20 C100,6.79166667 106.666667,0.124666263 120,-0.00100120993 L180,-0.00100120993 C193.333333,-0.00387801145 200,6.66312239 200,20 C200,33.3368776 200,60.0035443 200,100 C240,100 266.666667,100 280,100 C293.334856,100 300.002284,106.666667 300.002284,120 L300.002284,180 C300.052004,193.333333 293.384576,200 280,200 C266.615424,200 239.949124,200 200.001101,200 C200.001835,240 200.001835,266.666667 200.001101,280 C200.000367,293.334213 193.333333,300.001319 180,300.001319 L120,300.001319 C106.666667,300.109608 100,293.442502 100,280 C100,266.557498 100,239.890832 100,200 C60,200 33.3333333,200 20,200 C6.66605299,200 -0.000920519104,193.333333 -0.000920519104,180 L-0.000920519104,120 C-0.0324730702,106.666667 6.63450044,100 20,100 C33.3654996,100 60.0321662,100 100,100 Z" id="Path" fill="#000000"></path>
    </g>
</svg>`;
  let swiftOutput = "";

  const generateSwiftCode = () => {
    const svgJsonTree = parse(svgInput.trim())
    swiftOutput = SwiftGenerator(svgJsonTree)
  }
</script>

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