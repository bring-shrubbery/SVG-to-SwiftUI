/**
 * Converts number with unit suffix to pixels.
 * @param number Number with the unit as a string.
 */
export function convertToPixels(number: string) {
  const unit = String(number).substr(-2, 2);
  if (unit.search(/^[a-z]{2}$/i) != -1) {
    switch (unit) {
      case "em":
        // TODO: Convert correctly from em.
        return parseFloat(number);
      case "ex":
        // TODO: Convert correctly from ex.
        return parseFloat(number);
      case "px":
        return parseFloat(number);
      case "pt":
        // TODO: Convert correctly from pt.
        return parseFloat(number);
      case "pc":
        // TODO: Convert correctly from pc.
        return parseFloat(number);
      case "cm":
        // TODO: Convert correctly from cm.
        return parseFloat(number);
      case "mm":
        // TODO: Convert correctly from mm.
        return parseFloat(number);
      case "in":
        // TODO: Convert correctly from in.
        return parseFloat(number);
      default:
        return parseFloat(number);
    }
  } else {
    return parseFloat(number);
  }
}
