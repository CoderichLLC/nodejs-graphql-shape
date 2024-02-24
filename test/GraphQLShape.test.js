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
      result1: expect.arrayContaining([
        expect.objectContaining({
          cats: ['one', 'two', 'three'],
        }),
      ]),
    });

    // Select array.name
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

  test('constructor', () => {
    const { query, transforms, fragments } = new GraphQLShape(`
      fragment frag on Location {
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
              location {
                ...frag
              }
            }
          }
        }
        result2: findIt @shape(path: "$[arrObj]") {
          id
          arr
          arrObj @shape(path: "$[*].name") {
            name
          }
          edges {
            node {
              id
              location {
                ...frag
              }
            }
          }
        }
      }
    `);

    expect(query.replace(/\s+/g, '')).toEqual(`
      fragment frag on Location {
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
              location {
                ...frag
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
              location {
                ...frag
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
      { key: 'result1.edges.node.location.address.state', toUpperCase: null },
      { key: 'result2', path: '$[arrObj]' },
      { key: 'result2.arrObj', path: '$[*].name' },
      { key: 'result2.edges.node.location.address.state', toUpperCase: null },
    ].reverse());

    expect(fragments).toEqual({
      frag: [
        { key: 'address.state', toUpperCase: null },
      ],
    });

    expect(GraphQLShape.transform(cloneDeep(data), transforms)).toEqual({
      result1: expect.arrayContaining([{
        id: 1,
        arr: ['one', 'two', 'three'],
        cats: 'ONE,TWO,THREE',
        str: ['FIVE', 'SIX', 'SEVEN'], // last one sliced off
        edges: [
          {
            id: 1,
            location: {
              address: {
                city: 'city1',
                state: 'STATE1',
                zipcode: 'zipcode1',
              },
            },
          },
          {
            id: 2,
            location: {
              address: {
                city: 'city2',
                state: 'STATE2',
                zipcode: 'zipcode2',
              },
            },
          },
        ],
      }]),
      result2: ['one', 'two', 'three'],
    });
  });
});
