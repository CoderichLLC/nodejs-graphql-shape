const cloneDeep = require('lodash.clonedeep');
const GraphQLShape = require('../src/GraphQLShape');
const data = require('./data');

describe('GraphQLShape', () => {
  describe('transform', () => {
    expect(GraphQLShape.transform(cloneDeep(data))).toEqual(data);

    // Select array.name
    expect(GraphQLShape.transform(cloneDeep(data), [
      { key: 'result1.cats', path: '$[*].name' },
    ])).toMatchObject({
      result1: expect.objectContaining({
        cats: ['one', 'two', 'three'],
      }),
    });

    // Select array.name
    expect(GraphQLShape.transform(cloneDeep(data), [
      { key: 'result1.cats', path: '$[*].name', join: ',' },
    ])).toMatchObject({
      result1: expect.objectContaining({
        cats: 'one,two,three',
      }),
    });
  });

  test('constructor', () => {
    const { query, transforms } = new GraphQLShape(`
      fragment address on Location {
        address {
          city
          state @shape(toUpperCase: null)
          zip: zipcode
        }
      }
      query {
        result1: findIt {
          id
          arr
          cats: arrObj @shape(path: "$[*].name", each: "toUpperCase", join: ",") {
            name
          }
          str @shape(split: ",", each: ["toUpperCase"], slice: [0, -1])
          edges @shape(path: "$[*].node") {
            node {
              id
              address {
                ...address
              }
            }
          }
        }
        result2: findIt {
          id
          arr
          arrObj @shape(path: "$[*].name") {
            name
          }
          edges {
            node {
              id
              address {
                ...address
              }
            }
          }
        }
      }
    `);

    expect(query.replace(/\s+/g, '')).toEqual(`
      fragment address on Location {
        address {
          city
          state
          zip: zipcode
        }
      }
      {
        result1: findIt {
          id
          arr
          cats: arrObj { name }
          str
          edges {
            node {
              id
              address {
                ...address
              }
            }
          }
        }
        result2: findIt {
          id
          arr
          arrObj { name }
          edges {
            node {
              id
              address {
                ...address
              }
            }
          }
        }
      }
    `.replace(/\s+/g, ''));

    expect(transforms).toEqual([
      { key: 'result1.cats', path: '$[*].name', each: 'toUpperCase', join: ',' },
      { key: 'result1.str', split: ',', each: ['toUpperCase'], slice: ['0', '-1'] },
      { key: 'result1.edges', path: '$[*].node' },
      // { key: 'one.edges.node.address', path: '$' },
      { key: 'result2.arrObj', path: '$[*].name' },
      // { key: 'two.edges.node.address', path: '$' },
    ]);

    expect(GraphQLShape.transform(cloneDeep(data), transforms)).toMatchObject({
      result1: {
        id: 1,
        arr: ['one', 'two', 'three'],
        cats: 'ONE,TWO,THREE',
        str: ['FIVE', 'SIX', 'SEVEN'], // last one sliced off
        edges: [
          {
            id: 1,
            address: {
              city: 'city1',
              state: 'state1',
              zipcode: 'zipcode1',
            },
          },
          {
            id: 2,
            address: {
              city: 'city2',
              state: 'state2',
              zipcode: 'zipcode2',
            },
          },
        ],
      },
      result2: {
        id: 2,
      },
    });
  });
});
