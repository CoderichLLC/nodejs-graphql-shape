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

    test('pick', () => {
      // Via string
      expect(GraphQLShape.transform({ base: { attr1: 'one', attr2: 'two', attr3: 'three' } }, [
        { key: 'base', ops: [{ pick: ['attr2', 'attr3'] }] },
      ])).toEqual({ base: { attr2: 'two', attr3: 'three' } });

      // Via array
      expect(GraphQLShape.transform({ base: { attr1: 'one', attr2: 'two', attr3: 'three' } }, [
        { key: 'base', ops: [{ pick: [['attr2', 'attr'], 'attr3'] }] },
      ])).toEqual({ base: { attr: 'two', attr3: 'three' } });

      // Via object
      expect(GraphQLShape.transform({ base: { attr1: 'one', attr2: 'two', attr3: 'three' } }, [
        { key: 'base', ops: [{ pick: [{ attr1: 'attr' }, 'attr3'] }] },
      ])).toEqual({ base: { attr: 'one', attr3: 'three' } });

      expect(GraphQLShape.transform({ obj: [1, 2, 3, 4] }, [
        { key: 'obj', ops: [{ pick: [2] }] },
      ])).toEqual({ obj: { 2: 3 } });
    });

    test('array manipulation', () => {
      expect(GraphQLShape.transform({
        arrObj: [
          { type: 'phone', data: { phone: '973', url: 'tel:973' } },
          { type: 'ignore', data: { url: { en: 'ignore' } } },
          { type: 'website', data: { url: { en: 'google' } } },
        ],
      }, [
        { key: 'phone', ops: [{ parent: 'arrObj[?(@.type=="phone")].data.phone' }, { self: '$[0]' }] },
        { key: 'website', ops: [{ parent: 'arrObj[?(@.type=="website")].data.url.en' }, { self: '$[0]' }] },
        { key: '', ops: [{ pick: ['phone', 'website'] }] },

      ])).toEqual({ phone: '973', website: 'google' });
    });

    test('adhoc attributes', () => {
      expect(GraphQLShape.transform({ base: { attr1: 'one', attr2: 'two', attr3: 'three' } }, [
        { key: 'base', ops: [{ pick: ['attr2', 'attr3'] }] },
        { key: 'base.attr4', ops: [{ parent: 'attr2' }] },
        { key: 'adhoc', ops: [{ parent: 'base' }] },
      ])).toEqual({
        base: { attr2: 'two', attr3: 'three', attr4: 'two' },
        adhoc: { attr2: 'two', attr3: 'three', attr4: 'two' },
      });
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

    test('new Set()', () => {
      const transforms = [{
        key: 'arr',
        ops: [{ Set: 'new' }, { Array: 'from' }, { sort: null }],
      }];
      expect(GraphQLShape.transform({ arr: [1, 2, 1, 5, 4, 3, 2, 1, 1, 5] }, transforms)).toEqual({ arr: [1, 2, 3, 4, 5] });
    });

    test('push|concat', () => {
      const push = [{ key: 'arr', ops: [{ push: 1 }] }];
      const pushs = [{ key: 'arr', ops: [{ push: [1, 2, 3] }] }];
      const concat = [{ key: 'arr', ops: [{ concat: [1, 2, 3] }] }];
      expect(GraphQLShape.transform({ arr: [] }, push)).toEqual({ arr: [1] });
      expect(GraphQLShape.transform({ arr: [] }, pushs)).toEqual({ arr: [1, 2, 3] });
      expect(GraphQLShape.transform({ arr: [] }, concat)).toEqual({ arr: [1, 2, 3] });
    });

    test('default', () => {
      const def = [{ key: 'obj', ops: [{ self: 'name' }, { default: 'unknown' }] }];
      expect(GraphQLShape.transform({ obj: { name: 'rich' } }, def)).toEqual({ obj: 'rich' });
      expect(GraphQLShape.transform({ obj: { name: '' } }, def)).toEqual({ obj: '' });
      expect(GraphQLShape.transform({ obj: { name: null } }, def)).toEqual({ obj: 'unknown' });
      expect(GraphQLShape.transform({ obj: {} }, def)).toEqual({ obj: 'unknown' });
      expect(GraphQLShape.transform({ obj: null }, def)).toEqual({ obj: 'unknown' });
    });

    test('assign', () => {
      const transforms1 = [{ key: 'obj', ops: [{ self: 'a' }] }];
      const transforms2 = [{ key: 'obj', ops: [{ self: 'a' }, { assign: 'b' }] }];
      const transforms3 = [{ key: 'obj', ops: [{ self: 'a' }, { assign: '$0' }] }];
      const transforms4 = [{ key: 'obj', ops: [{ self: 'a' }, { assign: '$1' }] }];
      const transforms5 = [{ key: 'obj', ops: [{ self: 'a' }, { assign: '$2' }] }];
      const transforms6 = [{ key: 'obj', ops: [{ self: 'a' }, { assign: ['$0', '$1', 'a', { b: 'c' }] }] }];
      const transforms7 = [{ key: 'obj.idk', ops: [{ assign: '7' }] }];
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms1)).toEqual({ obj: 'a' }); // Sanity test
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms2)).toEqual({ obj: 'b' });
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms3)).toEqual({ obj: { a: 'a' } });
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms4)).toEqual({ obj: 'a' });
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms5)).toEqual({ obj: undefined });
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms6)).toEqual({ obj: [{ a: 'a' }, 'a', 'a', { b: 'c' }] });
      expect(GraphQLShape.transform({ obj: {} }, transforms7)).toEqual({ obj: { idk: '7' } });
    });

    test('rename', () => {
      const transforms1 = [{ key: 'obj', ops: [{ rename: 'data' }] }];
      const transforms2 = [{ key: 'obj', ops: [{ rename: 'data' }, { self: 'a' }] }];
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms1)).toEqual({ data: { a: 'a' } });
      expect(GraphQLShape.transform({ obj: { a: 'a' } }, transforms2)).toEqual({ data: 'a' });
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

    test('nested fragments', () => {
      const { transform } = GraphQLShape.parse(`
        fragment one on ONE {
          one @shape(toUpperCase: null)
          once @shape(toLowerCase: null)
        }
        fragment two on TWO {
          two @shape(ucFirst: null)
          twice
        }
        fragment duo on DUO {
          ...one
          ...two
        }
        query {
          data {
            ...one
            three
            combo {
              ...duo
              thrice
            }
          }
        }
      `);

      expect(transform({
        data: {
          one: 'one',
          once: 'ONCE',
          three: 'three',
          combo: {
            one: 'one',
            once: 'onCe',
            two: 'two',
            twice: 'twice',
            thrice: 'thrice',
          },
        },
      })).toEqual({
        data: {
          one: 'ONE',
          once: 'once',
          three: 'three',
          combo: {
            one: 'ONE',
            once: 'once',
            two: 'Two',
            twice: 'twice',
            thrice: 'thrice',
          },
        },
      });
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
