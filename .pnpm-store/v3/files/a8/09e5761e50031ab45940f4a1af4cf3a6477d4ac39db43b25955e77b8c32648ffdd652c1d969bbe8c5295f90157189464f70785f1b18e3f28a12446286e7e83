import { validateGetStaticPathsParameter } from "./validation.js";
function getParams(array) {
  const fn = (match) => {
    const params = {};
    array.forEach((key, i) => {
      if (key.startsWith("...")) {
        params[key.slice(3)] = match[i + 1] ? decodeURIComponent(match[i + 1]) : void 0;
      } else {
        params[key] = decodeURIComponent(match[i + 1]);
      }
    });
    return params;
  };
  return fn;
}
function stringifyParams(params) {
  const validatedParams = Object.entries(params).reduce((acc, next) => {
    validateGetStaticPathsParameter(next);
    const [key, value] = next;
    acc[key] = `${value}`;
    return acc;
  }, {});
  return JSON.stringify(validatedParams, Object.keys(params).sort());
}
export {
  getParams,
  stringifyParams
};
