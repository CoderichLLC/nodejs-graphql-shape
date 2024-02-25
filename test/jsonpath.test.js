const { JSONPath } = require('jsonpath-plus');

describe('JSONPath', () => {
  test('null', () => {
    expect(JSONPath({
      path: '',
      wrap: false,
      json: null,
    })).toBeUndefined();
  });

  test('{}', () => {
    expect(JSONPath({
      path: '',
      wrap: false,
      json: {},
    })).toBeUndefined();
  });

  test('array (scalar)', () => {
    expect(JSONPath({
      wrap: false,
      path: 'array',
      json: {
        array: ['one', 'two', 'three'],
      },
    })).toEqual(['one', 'two', 'three']);
  });

  test('array (object)', () => {
    expect(JSONPath({
      wrap: false,
      path: 'array[*].name',
      json: {
        array: [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
      },
    })).toEqual(['one', 'two', 'three']);
  });

  test('select fields', () => {
    expect(JSONPath({
      wrap: false,
      path: '$[a,c]',
      json: { a: 'a', b: 'b', c: 'c' },
    })).toEqual(['a', 'c']);
  });

  test('select keys', () => {
    expect(JSONPath({
      wrap: false,
      path: '$.*~',
      json: { a: 'one', b: 'two', c: 'three' },
    })).toEqual(['a', 'b', 'c']);
  });

  test('select array index', () => {
    expect(JSONPath({
      wrap: false,
      path: 'arr.1',
      json: { arr: ['one', 'two', 'three'] },
    })).toEqual('two');
  });
});
