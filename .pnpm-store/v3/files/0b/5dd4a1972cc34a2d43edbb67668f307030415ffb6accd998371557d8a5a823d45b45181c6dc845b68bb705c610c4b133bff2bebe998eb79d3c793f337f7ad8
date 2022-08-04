import { escape } from "html-escaper";
const escapeHTML = escape;
class HTMLString extends String {
}
const markHTMLString = (value) => {
  if (value instanceof HTMLString) {
    return value;
  }
  if (typeof value === "string") {
    return new HTMLString(value);
  }
  return value;
};
export {
  HTMLString,
  escapeHTML,
  markHTMLString
};
