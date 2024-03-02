const get = require('lodash.get');
const Util = require('@coderich/util');

// Array methods
['push', 'pop', 'shift', 'unshift'].forEach((fn) => {
  exports[fn] = (v, ...rest) => {
    v?.[fn]?.(...rest);
    return v;
  };
});

// Comparison methods
exports.in = (a, ...rest) => Util.ensureArray(a).some(el => rest.flat().includes(el));
exports.nin = (...args) => !exports.in(...args);
Object.entries({
  eq: (v, value) => v === value,
  ne: (v, value) => v !== value,
  gt: (v, value) => v > value,
  gte: (v, value) => v >= value,
  lt: (v, value) => v < value,
  lte: (v, value) => v <= value,
}).forEach(([key, fn]) => {
  exports[key] = (v, ...rest) => {
    return Util.uvl(Util.pairs(rest).reduce((prev, [value, result], i) => {
      if (prev !== undefined) return prev;
      if (result === undefined) return i > 0 ? value : fn(v, value);
      if (fn(v, value)) return result;
      return undefined;
    }, undefined), v);
  };
});

// Logical operators
exports.not = el => !el;
exports.and = (...args) => args.flat().every(el => el);
exports.or = (...args) => args.flat().some(el => el);

// Math
exports.add = (v, ...rest) => rest.flat().reduce((prev, curr) => prev + curr, v);
exports.sub = (v, ...rest) => rest.flat().reduce((prev, curr) => prev - curr, v);
exports.div = (v, ...rest) => rest.flat().reduce((prev, curr) => prev / curr, v);
exports.mul = (v, ...rest) => rest.flat().reduce((prev, curr) => prev * curr, v);
exports.mod = (v, ...rest) => rest.flat().reduce((prev, curr) => prev % curr, v);

// Utility methods
exports.get = get;
exports.set = Util.set;
exports.nvl = Util.nvl;
exports.uvl = Util.uvl;
exports.pairs = Util.pairs;
exports.pushIt = Util.push;
exports.flatten = Util.flatten;
exports.unflatten = Util.unflatten;
exports.pick = (v, ...rest) => rest.reduce((prev, mixed) => {
  let key, $key;
  if (Array.isArray(mixed)) [key, $key] = mixed;
  else if (typeof mixed === 'object') [[key, $key]] = Object.entries(mixed);
  else key = $key = mixed;
  return Object.assign(prev, { [$key]: v[key] });
}, {});
