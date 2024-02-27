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
        { key: 'result1.cats', ops: [{ self: '$[*].name' }] },
      ])).toMatchObject({
        result1: expect.arrayContaining([
          expect.objectContaining({ cats: ['one', 'two', 'three'] }),
          expect.objectContaining({ cats: ['four', 'five', 'six'] }),
        ]),
      });
    });

    test('array.name join', () => {
      expect(GraphQLShape.transform(cloneDeep(data), [
        { key: 'result1.cats', ops: [{ self: '$[*].name' }, { join: ',' }] },
      ])).toMatchObject({
        result1: expect.arrayContaining([
          expect.objectContaining({ cats: 'one,two,three' }),
          expect.objectContaining({ cats: 'four,five,six' }),
        ]),
      });
    });

    test('siblings', () => {
      expect(GraphQLShape.transform({ attr1: 'a', attr2: 'b' }, [
        { key: 'attr2', ops: [{ parent: 'attr1' }] },
      ])).toEqual({ attr1: 'a', attr2: 'a' });
    });

    test('eq (boolean)', () => {
      expect(GraphQLShape.transform({ attr1: 'one', attr2: 'two' }, [
        { key: 'attr2', ops: [{ parent: 'attr1' }, { eq: 'two' }] },
      ])).toEqual({ attr1: 'one', attr2: false });
    });

    test('core methods', () => {
      expect(GraphQLShape.transform({ attr1: 'one', attr2: 'two', attr3: 'three' }, [
        { key: 'attr1', ops: [{ Boolean: null }] },
        { key: 'attr2', ops: [{ Date: 'now' }] },
        { key: 'attr3', ops: [{ Date: 'new' }] },
      ])).toEqual({ attr1: true, attr2: expect.any(Number), attr3: expect.any(Date) });
    });

    test('flatten', () => {
      expect(GraphQLShape.transform({
        a: 'a',
        arr: [{ a: 'a', b: 'b' }, { c: 'c' }, { d: 'd' }],
      }, [
        { key: '', ops: [{ flatten: '' }] },
      ])).toEqual({ a: 'a', 'arr.0.a': 'a', 'arr.0.b': 'b', 'arr.1.c': 'c', 'arr.2.d': 'd' });
    });

    test('transformation rollup', () => {
      expect(GraphQLShape.transform({
        id: 1,
        books: [
          { price: 10, author: 'author1' },
          { price: 20, author: 'author2' },
          { price: 30, author: 'author3' },
        ],
      }, [
        { key: 'books', ops: [{ map: { Object: 'values' } }] },
        { key: 'id', ops: [{ parent: 'books' }, { map: [{ unshift: '$0' }, { join: ':' }] }] },
        { key: '', ops: [{ self: 'id' }] },
      ])).toEqual(['1:10:author1', '1:20:author2', '1:30:author3']);
    });

    test('logic1', () => {
      const transforms = [
        {
          key: 'inherit',
          ops: [
            { parent: 'designation' },
            { eq: ['site', '', '$0'] },
            { eq: ['', '', true, 'Inherit', 'Override'] },
          ],
        },
      ];
      expect(GraphQLShape.transform({ inherit: true, designation: 'poi' }, transforms)).toEqual({ inherit: 'Inherit', designation: 'poi' });
      expect(GraphQLShape.transform({ inherit: false, designation: 'poi' }, transforms)).toEqual({ inherit: 'Override', designation: 'poi' });
      expect(GraphQLShape.transform({ inherit: false, designation: 'site' }, transforms)).toEqual({ inherit: '', designation: 'site' });
    });

    test('logic2', () => {
      const transforms = [
        {
          key: 'obj.name',
          ops: [
            { parent: 'lever' },
            { in: ['a', 'b', 'c'] },
            { eq: [true, '$0', '$1'] },
          ],
        },
      ];
      expect(GraphQLShape.transform({ obj: { lever: 'a', name: 'name' } }, transforms)).toEqual({ obj: { lever: 'a', name: 'name' } });
      expect(GraphQLShape.transform({ obj: { lever: 'b', name: 'name' } }, transforms)).toEqual({ obj: { lever: 'b', name: 'name' } });
      expect(GraphQLShape.transform({ obj: { lever: 'c', name: 'name' } }, transforms)).toEqual({ obj: { lever: 'c', name: 'name' } });
      expect(GraphQLShape.transform({ obj: { lever: 'd', name: 'name' } }, transforms)).toEqual({ obj: { lever: 'd', name: 'd' } });
    });
  });

  describe('parse (and transform)', () => {
    test('sibling', () => {
      const { transform } = GraphQLShape.parse(`
        query {
          attr1
          attr2 @shape(parent: "attr1")
        }
      `);
      expect(transform({ attr1: 'a', attr2: 'b' })).toEqual({ attr1: 'a', attr2: 'a' });
    });

    test('transformation rollup', () => {
      const { transform } = GraphQLShape.parse(`
        query @shape(self: "id") {
          id @shape(parent: "books", map: [{ unshift: "$0" }, { join: ":" }])
          books @shape(map: { Object: values }) {
            price
            author
          }
        }
      `);

      expect(transform({
        id: 1,
        books: [
          { price: 10, author: 'author1' },
          { price: 20, author: 'author2' },
          { price: 30, author: 'author3' },
        ],
      })).toEqual(['1:10:author1', '1:20:author2', '1:30:author3']);
    });

    test('cond logic', () => {
      const { transform } = GraphQLShape.parse(`
        query {
          inherit @shape(parent: "designation", eq: ["site", "", "$0"], eq: ["", "", true, "Inherit", "Override"])
          designation
        }
      `);

      expect(transform({ inherit: true, designation: 'poi' })).toEqual({ inherit: 'Inherit', designation: 'poi' });
      expect(transform({ inherit: false, designation: 'poi' })).toEqual({ inherit: 'Override', designation: 'poi' });
      expect(transform({ inherit: false, designation: 'site' })).toEqual({ inherit: '', designation: 'site' });
    });

    test('fixture', () => {
      const { query, transforms, fragments } = GraphQLShape.parse(request);

      expect(query.replace(/\s+/g, '')).toEqual($request.replace(/\s+/g, ''));

      expect(transforms).toEqual([
        { key: 'result1.cats', ops: [{ self: '$[*].name' }, { map: { ucFirst: '' } }, { join: ', ' }] },
        { key: 'result1.str', ops: [{ split: ',' }, { map: [{ toUpperCase: '' }] }, { slice: [0, -1] }] },
        { key: 'result1.edges', ops: [{ self: '$[*].node' }] },
        { key: 'result1.edges.node.location', ops: [{ self: 'address' }] },
        { key: 'result1.edges.node.location.address.state', ops: [{ map: { toUpperCase: '' } }] },
        { key: 'result2', ops: [{ self: 'edges[*].node.location' }] },
        { key: 'result2.arrObj', ops: [{ self: '$[*].name' }, { join: ', ' }] },
        { key: 'result2.edges.node.location.address.state', ops: [{ map: { toUpperCase: '' } }] },
      ].reverse());

      // Not normalized
      expect(fragments).toEqual({
        frag: [
          { key: 'address.state', ops: [{ map: { toUpperCase: '' } }] },
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
