import {convert} from '../index';
import {loadContentFile} from './utils';

test('conversion-1', () => {
  const rawSVG = loadContentFile('plusRounded.svg');
  const expectedResult = loadContentFile('plusRounded.swift');
  const result = convert(rawSVG, {
    precision: 5,
  });
  expect(result).toBe(expectedResult);
});

test('convert-circle', () => {
  const rawSVG = loadContentFile('circle.svg');
  const expectedResult = loadContentFile('circle.swift');
  const result = convert(rawSVG, {
    precision: 2,
    structName: 'CircleShape',
  });
  expect(result).toBe(expectedResult);
});

test('convert-ellipse', () => {
  const rawSVG = loadContentFile('ellipse.svg');
  const expectedResult = loadContentFile('ellipse.swift');
  const result = convert(rawSVG, {
    precision: 4,
    structName: 'EllipseShape',
  });
  expect(result).toBe(expectedResult);
});

test('convert-rectangle', () => {
  const rawSVG = loadContentFile('rect.svg');
  const expectedResult = loadContentFile('rect.swift');
  const result = convert(rawSVG, {
    precision: 6,
    structName: 'RectangleShape',
  });
  expect(result).toBe(expectedResult);
});

test('convert-github-transat', () => {
  const rawSVG = loadContentFile('transat.svg');
  const expectedResult = loadContentFile('transat.swift');
  const result = convert(rawSVG, {
    precision: 6,
    structName: 'GithubTransatShape',
  });
  expect(result).toBe(expectedResult);
});

test('convert-f', () => {
  const rawSVG = loadContentFile('f.svg');
  const expectedResult = loadContentFile('f.swift');
  const result = convert(rawSVG, {
    precision: 6,
    structName: 'FaIcon',
  });
  expect(result).toBe(expectedResult);
});

test('convert-ln', () => {
  const rawSVG = loadContentFile('ln.svg');
  const expectedResult = loadContentFile('ln.swift');
  const result = convert(rawSVG, {
    precision: 6,
    structName: 'LnIcon',
  });
  expect(result).toBe(expectedResult);
});
