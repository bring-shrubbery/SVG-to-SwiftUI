<script>
  import { parse } from "svg-parser";
  import SwiftGenerator from "./Converter/SwiftGenerator";

  let svgInput = ``;
  let swiftOutput = "";

  let settingsShown = false;
  const toggleSettings = () => (settingsShown = !settingsShown);
  let options = {
    decimalPoints: 5
  };

  const generateSwiftCode = () => {
    const svgJsonTree = parse(svgInput.trim());
    swiftOutput = SwiftGenerator(svgJsonTree, options);
  };
</script>

<main>
  <h1>Welcome!</h1>
  <i>
    Functionality is limited for now, feel free to contribute on
    <a href="https://github.com/quassummanus/SVG-to-SwiftUI" target="_blank">
      Github
    </a>
    .
  </i>
  <img
    id="settings-button"
    src="https://img.icons8.com/ios-filled/50/000000/settings.png"
    alt="settings icon"
    width="16px"
    on:click={toggleSettings}
    title={`${settingsShown ? 'Hide' : 'Show'} settings`} />
  {#if settingsShown}
    <ul>
      <li>
        <label for="precision-control-input">Round to decimal points:</label>
        <input
          id="precision-control-input"
          type="number"
          min="0"
          max="10"
          bind:value={options.decimalPoints} />
      </li>
    </ul>
  {/if}
  <h2>Paste SVG code below:</h2>
  <div>
    <textarea bind:value={svgInput} placeholder="Paste SVG Code here" />
  </div>
  <button on:click={generateSwiftCode}>Convert to SwiftUI Shape!</button>
  <h2>Swift code wil be shown below:</h2>
  <div>
    <textarea value={swiftOutput} id="swift-output-area" />
  </div>
</main>
