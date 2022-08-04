import { warn } from "../logger/core.js";
const VALID_PARAM_TYPES = ["string", "number", "undefined"];
function validateGetStaticPathsParameter([key, value]) {
  if (!VALID_PARAM_TYPES.includes(typeof value)) {
    throw new Error(`[getStaticPaths] invalid route parameter for "${key}". Expected a string or number, received \`${value}\` ("${typeof value}")`);
  }
}
function validateGetStaticPathsModule(mod, { ssr }) {
  if (mod.createCollection) {
    throw new Error(`[createCollection] deprecated. Please use getStaticPaths() instead.`);
  }
  if (!mod.getStaticPaths && !ssr) {
    throw new Error(`[getStaticPaths] getStaticPaths() function is required. Make sure that you \`export\` the function from your component.`);
  }
}
function validateGetStaticPathsResult(result, logging) {
  if (!Array.isArray(result)) {
    throw new Error(`[getStaticPaths] invalid return value. Expected an array of path objects, but got \`${JSON.stringify(result)}\`.`);
  }
  result.forEach((pathObject) => {
    if (!pathObject.params) {
      warn(logging, "getStaticPaths", `invalid path object. Expected an object with key \`params\`, but got \`${JSON.stringify(pathObject)}\`. Skipped.`);
      return;
    }
    for (const [key, val] of Object.entries(pathObject.params)) {
      if (!(typeof val === "undefined" || typeof val === "string")) {
        warn(logging, "getStaticPaths", `invalid path param: ${key}. A string value was expected, but got \`${JSON.stringify(val)}\`.`);
      }
      if (val === "") {
        warn(logging, "getStaticPaths", `invalid path param: ${key}. \`undefined\` expected for an optional param, but got empty string.`);
      }
    }
  });
}
export {
  validateGetStaticPathsModule,
  validateGetStaticPathsParameter,
  validateGetStaticPathsResult
};
