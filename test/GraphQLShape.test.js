const Util = require('@coderich/util');
const cloneDeep = require('lodash.clonedeep');
const GraphQLShape = require('../src/GraphQLShape');
const { request, $request, data } = require('./fixtures');

GraphQLShape.define('ucFirst', Util.ucFirst);

describe('GraphQLShape', () => {
  describe('transform', () => {
    test('noop', () => {
      expect(GraphQLShape.transform(cloneDeep(data))).toEqual(data);
    });

    test('array.name', () => {
      expect(GraphQLShape.transform(cloneDeep(data), [
        { key: 'result1.cats', path: '$[*].name' },
      ])).toMatchObject({
        result1: expect.arrayContaining([
          expect.objectContaining({
            cats: ['one', 'two', 'three'],
          }),
        ]),
      });
    });

    test('array.name join', () => {
      expect(GraphQLShape.transform(cloneDeep(data), [
        { key: 'result1.cats', path: '$[*].name', join: ',' },
      ])).toMatchObject({
        result1: expect.arrayContaining([
          expect.objectContaining({
            cats: 'one,two,three',
          }),
        ]),
      });
    });
  });

  describe('parse (and transform)', () => {
    test('fixture', () => {
      const { query, transforms, fragments } = GraphQLShape.parse(request);

      expect(query.replace(/\s+/g, '')).toEqual($request.replace(/\s+/g, ''));

      expect(transforms).toEqual([
        { key: 'result1.cats', path: '$[*].name', map: [{ name: 'ucFirst', args: [''] }], join: ', ' },
        { key: 'result1.str', split: ',', map: [{ name: 'toUpperCase', args: [''] }], slice: [0, -1] },
        { key: 'result1.edges', path: '$[*].node' },
        { key: 'result1.edges.node.location', path: 'address' },
        { key: 'result1.edges.node.location.address.state', map: [{ name: 'toUpperCase', args: [''] }] },
        { key: 'result2', path: 'edges[*].node.location' },
        { key: 'result2.arrObj', path: '$[*].name', join: ', ' },
        { key: 'result2.edges.node.location.address.state', map: [{ name: 'toUpperCase', args: [''] }] },
      ].reverse());

      // Not normalized
      expect(fragments).toEqual({
        frag: [
          { key: 'address.state', map: 'toUpperCase' },
        ],
      });

      expect(GraphQLShape.transform(cloneDeep(data), transforms)).toEqual({
        result1: expect.arrayContaining([{
          id: 1,
          arr: ['one', 'two', 'three'],
          cats: 'One, Two, Three', // ucFirst
          str: ['FIVE', 'SIX', 'SEVEN'], // last one sliced off
          edges: [
            {
              id: 1,
              location: { // Hoisted
                city: 'city1',
                state: 'STATE1',
                zipcode: 'zipcode1',
              },
            },
            {
              id: 2,
              location: { // Hoisted
                city: 'city2',
                state: 'STATE2',
                zipcode: 'zipcode2',
              },
            },
          ],
        }]),
        result2: [
          {
            address: {
              city: 'city1',
              state: 'STATE1',
              zipcode: 'zipcode1',
            },
          },
          {
            address: {
              city: 'city2',
              state: 'STATE2',
              zipcode: 'zipcode2',
            },
          },
        ],
      });
    });
  });
});
