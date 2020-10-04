import { convertToPixels } from "../Utils";

test("Convert '5px' to numberic pixel value", () => {
  expect(convertToPixels("5px")).toBe(5);
});

test("Convert '0.1Px' to numberic pixel value", () => {
  expect(convertToPixels("0.1Px")).toBe(0.1);
});

test("Convert '0.001 pX' to numberic pixel value", () => {
  expect(convertToPixels("0.001 Px")).toBe(0.001);
});

test("Convert '  0.1   Px' to numberic pixel value", () => {
  expect(convertToPixels("  0.1   Px")).toBe(0.1);
});

test("convertToPixels with non-string parameter should throw", () => {
  expect(() => {
    convertToPixels(undefined);
  }).toThrow("Function only accepts strings or numbers.");

  expect(() => {
    convertToPixels({});
  }).toThrow("Function only accepts strings or numbers.");
});
