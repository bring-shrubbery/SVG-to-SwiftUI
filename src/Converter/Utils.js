export function convertToPixels(number) {
  const unit = String(number).substr(-2, 2);
  if (unit.search(/^[a-z]{2}$/i) != -1) {
    switch (unit) {
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
