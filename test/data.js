module.exports = {
  result1: {
    id: 1,
    arr: ['one', 'two', 'three'],
    cats: [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
    str: 'five,six,seven,eight',
    edges: [
      {
        node: {
          id: 1,
          address: {
            city: 'city1',
            state: 'state1',
            zipcode: 'zipcode1',
          },
        },
      },
      {
        node: {
          id: 2,
          address: {
            city: 'city2',
            state: 'state2',
            zipcode: 'zipcode2',
          },
        },
      },
    ],
  },
  result2: {
    id: 2,
  },
};
