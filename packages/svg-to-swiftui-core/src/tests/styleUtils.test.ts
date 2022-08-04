import {filterStyleProps} from '../styleUtils';

test('remove non-style props', () => {
  const ogirinalProperties = {
    clip: 'value',
    nonStyle: 'valueDoesntMatter',
  };

  const filteredProperties = JSON.stringify({
    clip: 'value',
  });

  const result = JSON.stringify(filterStyleProps(ogirinalProperties));

  expect(result).toBe(filteredProperties);
});
