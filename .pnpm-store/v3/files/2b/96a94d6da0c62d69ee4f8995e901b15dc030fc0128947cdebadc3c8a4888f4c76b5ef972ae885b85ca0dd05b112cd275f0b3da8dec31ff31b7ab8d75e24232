function appendForwardSlash(path) {
  return path.endsWith("/") ? path : path + "/";
}
function prependForwardSlash(path) {
  return path[0] === "/" ? path : "/" + path;
}
function removeTrailingForwardSlash(path) {
  return path.endsWith("/") ? path.slice(0, path.length - 1) : path;
}
function removeLeadingForwardSlash(path) {
  return path.startsWith("/") ? path.substring(1) : path;
}
function trimSlashes(path) {
  return path.replace(/^\/|\/$/g, "");
}
function startsWithForwardSlash(path) {
  return path[0] === "/";
}
function startsWithDotDotSlash(path) {
  const c1 = path[0];
  const c2 = path[1];
  const c3 = path[2];
  return c1 === "." && c2 === "." && c3 === "/";
}
function startsWithDotSlash(path) {
  const c1 = path[0];
  const c2 = path[1];
  return c1 === "." && c2 === "/";
}
function isRelativePath(path) {
  return startsWithDotDotSlash(path) || startsWithDotSlash(path);
}
function isString(path) {
  return typeof path === "string" || path instanceof String;
}
function joinPaths(...paths) {
  return paths.filter(isString).map(trimSlashes).join("/");
}
export {
  appendForwardSlash,
  isRelativePath,
  joinPaths,
  prependForwardSlash,
  removeLeadingForwardSlash,
  removeTrailingForwardSlash,
  startsWithDotDotSlash,
  startsWithDotSlash,
  startsWithForwardSlash,
  trimSlashes
};
