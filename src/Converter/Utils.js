export function convertToPixels(number) {
  if (typeof number !== "number" && typeof number !== "string") {
    throw new Error("Function only accepts strings or numbers.");
  }

  if (typeof number == "number") return number;

  const unit = String(number).substr(-2, 2);

  if (unit.search(/^[a-z]{2}$/i) != -1) {
    switch (unit.toLowerCase()) {
      case "em":
        return 0;
      case "ex":
        return 0;
      case "px":
        return parseFloat(number);
      case "pt":
        return parseFloat(number);
      case "pc":
        return 0;
      case "cm":
        return 0;
      case "mm":
        return 0;
      case "in":
        return 0;
      default:
        return 0;
    }
  } else {
    return parseFloat(number);
  }
}
