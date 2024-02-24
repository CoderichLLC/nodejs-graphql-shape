module.exports = {
  request: `
    query {
      result1: findIt {
        id
        arr
        cats: arrObj @shape(path: "$[*].name", map: "ucFirst", join: ", ") {
          name
        }
        str @shape(split: ",", map: ["toUpperCase"], slice: [0, -1])
        edges @shape(path: "$[*].node") {
          node {
            id
            location @shape(path: "address") {
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
    fragment frag on Location {
      address {
        city
        state @shape(map: "toUpperCase")
        zip: zipcode
      }
    }
  `,
  $request: `
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
    fragment frag on Location {
      address {
        city
        state
        zip: zipcode
      }
    }
  `,
  data: {
    result1: [{
      id: 1,
      arr: ['one', 'two', 'three'],
      cats: [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
      str: 'five,six,seven,eight',
      edges: [
        {
          node: {
            id: 1,
            location: {
              address: {
                city: 'city1',
                state: 'state1',
                zipcode: 'zipcode1',
              },
            },
          },
        },
        {
          node: {
            id: 2,
            location: {
              address: {
                city: 'city2',
                state: 'state2',
                zipcode: 'zipcode2',
              },
            },
          },
        },
      ],
    }],
    result2: {
      id: 2,
      arr: ['one', 'two', 'three'],
      arrObj: [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
      str: 'five,six,seven,eight',
      edges: [
        {
          node: {
            id: 1,
            location: {
              address: {
                city: 'city1',
                state: 'state1',
                zipcode: 'zipcode1',
              },
            },
          },
        },
        {
          node: {
            id: 2,
            location: {
              address: {
                city: 'city2',
                state: 'state2',
                zipcode: 'zipcode2',
              },
            },
          },
        },
      ],
    },
  },
};
