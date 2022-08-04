import eol from "eol";
import fs from "fs";
import { codeFrame, createSafeError } from "./util.js";
var AstroErrorCodes = /* @__PURE__ */ ((AstroErrorCodes2) => {
  AstroErrorCodes2[AstroErrorCodes2["UnknownError"] = 1e3] = "UnknownError";
  AstroErrorCodes2[AstroErrorCodes2["ConfigError"] = 1001] = "ConfigError";
  AstroErrorCodes2[AstroErrorCodes2["UnknownCompilerError"] = 2e3] = "UnknownCompilerError";
  AstroErrorCodes2[AstroErrorCodes2["UnknownCompilerCSSError"] = 2001] = "UnknownCompilerCSSError";
  return AstroErrorCodes2;
})(AstroErrorCodes || {});
function cleanErrorStack(stack) {
  return stack.split(/\n/g).filter((l) => /^\s*at/.test(l)).join("\n");
}
function fixViteErrorMessage(_err, server) {
  const err = createSafeError(_err);
  server.ssrFixStacktrace(err);
  if (err.message === "import.meta.glob() can only accept string literals.") {
    err.message = "Astro.glob() and import.meta.glob() can only accept string literals.";
  }
  return err;
}
const incompatiblePackages = {
  "react-spectrum": `@adobe/react-spectrum is not compatible with Vite's server-side rendering mode at the moment. You can still use React Spectrum from the client. Create an island React component and use the client:only directive. From there you can use React Spectrum.`
};
const incompatPackageExp = new RegExp(`(${Object.keys(incompatiblePackages).join("|")})`);
function generateHint(err) {
  if (/Unknown file extension \"\.(jsx|vue|svelte|astro|css)\" for /.test(err.message)) {
    return "You likely need to add this package to `vite.ssr.noExternal` in your astro config file.";
  } else {
    const res = incompatPackageExp.exec(err.stack);
    if (res) {
      const key = res[0];
      return incompatiblePackages[key];
    }
  }
  return void 0;
}
function collectErrorMetadata(e) {
  if (e.stack) {
    e.stack = eol.lf(e.stack);
  }
  if (e.name === "YAMLException") {
    const err = e;
    err.loc = { file: e.id, line: e.mark.line, column: e.mark.column };
    err.message = e.reason;
    if (!err.frame) {
      try {
        const fileContents = fs.readFileSync(err.loc.file, "utf8");
        err.frame = codeFrame(fileContents, err.loc);
      } catch {
      }
    }
  }
  if (Array.isArray(e.errors)) {
    const { location, pluginName, text } = e.errors[0];
    const err = e;
    if (location) {
      err.loc = { file: location.file, line: location.line, column: location.column };
      err.id = err.id || (location == null ? void 0 : location.file);
    }
    const possibleFilePath = err.pluginCode || err.id || (location == null ? void 0 : location.file);
    if (possibleFilePath && !err.frame) {
      try {
        const fileContents = fs.readFileSync(possibleFilePath, "utf8");
        err.frame = codeFrame(fileContents, err.loc);
      } catch {
      }
    }
    if (pluginName) {
      err.plugin = pluginName;
    }
    err.hint = generateHint(err);
    return err;
  }
  e.hint = generateHint(e);
  return e;
}
export {
  AstroErrorCodes,
  cleanErrorStack,
  collectErrorMetadata,
  fixViteErrorMessage
};
