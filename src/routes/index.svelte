<script lang="ts">
  import { convert } from "svg-to-swiftui-core";

  let svgInput = "";
  let swiftOutput = "";

  let settingsShown = false;
  const toggleSettings = () => (settingsShown = !settingsShown);
  let options = {
    structName: "MyCustomShape",
    precision: 5,
    indentationSize: 4
  };

  const generateSwiftCode = () => {
    try {
      swiftOutput = convert(svgInput, options);
    } catch (e) {
      alert(e);
    }
  };
</script>

<main>
  <h1>Welcome!</h1>
  <div id="external-buttons">
    <iframe
      src="https://ghbtns.com/github-btn.html?user=quassummanus&repo=SVG-to-SwiftUI&type=star&count=true&v=2"
      frameborder="0"
      scrolling="0"
      width="90"
      height="20"
      title="GitHub" />
    <iframe
      src="https://github.com/sponsors/bring-shrubbery/button"
      title="Sponsor bring-shrubbery"
      height="35"
      width="116"
      style="border: 0;" />
  </div>
  <div style="margin: 8px auto">
    <i>
      Functionality is limited for now, feel free to contribute on
      <a
        href="https://github.com/quassummanus/SVG-to-SwiftUI"
        alt="link to GitHub">
        Github
      </a>
    </i>
  </div>
  <div style="margin: 16px 0">
    <h2 style="display: inline">Paste SVG code below</h2>
    <img
      id="settings-button"
      src="https://img.icons8.com/ios-filled/50/000000/settings.png"
      alt="settings icon"
      width="16px"
      on:click={toggleSettings}
      title={`${settingsShown ? 'Hide' : 'Show'} settings`} />
  </div>
  {#if settingsShown}
    <ul>
      <li>
        <label for="indentation-input">Indentation Spaces:</label>
        <input
          id="indentation-input"
          type="number"
          min="0"
          max="12"
          bind:value={options.indentationSize} />
      </li>
      <li>
        <label for="precision-input">Round to decimal points:</label>
        <input
          id="precision-input"
          type="number"
          min="0"
          max="10"
          bind:value={options.precision} />
      </li>
      <li>
        <label for="name-input">Struct name:</label>
        <input id="name-input" type="text" bind:value={options.structName} />
      </li>
    </ul>
  {/if}
  <div>
    <textarea bind:value={svgInput} placeholder="Paste SVG Code here" />
  </div>
  <button on:click={generateSwiftCode}>Convert to SwiftUI Shape!</button>
  <h2>Swift code will be shown below:</h2>
  <div>
    <textarea value={swiftOutput} id="swift-output-area" />
  </div>
</main>

<style lang="css">
  #external-buttons {
    width: min-content;
    margin: 0 auto;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  #external-buttons > iframe:first-child {
    margin-bottom: 8px;
  }
</style>
