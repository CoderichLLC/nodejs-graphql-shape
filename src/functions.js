const get = require('lodash.get');
const Util = require('@coderich/util');

// Array methods
['push', 'pop', 'shift', 'unshift'].forEach((fn) => {
  exports[fn] = (v, ...args) => {
    v?.[fn]?.(...args);
    return v;
  };
});

// Comparison methods
exports.in = (a, ...args) => Util.ensureArray(a).some(el => args.flat().includes(el));
exports.nin = (...args) => !exports.in(...args);
Object.entries({
  eq: (v, value) => v === value,
  ne: (v, value) => v !== value,
  gt: (v, value) => v > value,
  gte: (v, value) => v >= value,
  lt: (v, value) => v < value,
  lte: (v, value) => v <= value,
}).forEach(([key, fn]) => {
  exports[key] = (v, ...args) => {
    return Util.uvl(Util.pairs(args).reduce((prev, [value, result], i) => {
      if (prev !== undefined) return prev;
      if (result === undefined) return i > 0 ? value : fn(v, value);
      if (fn(v, value)) return result;
      return undefined;
    }, undefined), v);
  };
});

// Logical operators
exports.not = el => !el;
exports.or = (...args) => args.flat().some(el => el);
exports.and = (...args) => args.flat().every(el => el);

// Math
exports.add = (v, ...args) => args.flat().reduce((prev, curr) => prev + Number(curr), Number(v));
exports.sub = (v, ...args) => args.flat().reduce((prev, curr) => prev - Number(curr), Number(v));
exports.div = (v, ...args) => args.flat().reduce((prev, curr) => prev / Number(curr), Number(v));
exports.mul = (v, ...args) => args.flat().reduce((prev, curr) => prev * Number(curr), Number(v));
exports.mod = (v, ...args) => args.flat().reduce((prev, curr) => prev % Number(curr), Number(v));

// Utility methods
exports.get = (...args) => get(...args);
exports.set = (...args) => Util.set(...args);
exports.nvl = (...args) => Util.nvl(...args);
exports.uvl = (...args) => Util.uvl(...args);
exports.pairs = (...args) => Util.pairs(...args);
exports.flatten = (...args) => Util.flatten(...args);
exports.unflatten = (...args) => Util.unflatten(...args);
exports.filter = (v, re) => v.filter(el => el.match(Util.parseRegExp(re)));
exports.default = (v, ...args) => Util.ensureArray(v).concat(args.flat()).find(el => el != null);

// Pick keys (with optional rename)
exports.pick = (v, ...args) => args.reduce((prev, mixed) => {
  let key, $key;
  if (Array.isArray(mixed)) [key, $key] = mixed;
  else if (typeof mixed === 'object') [[key, $key]] = Object.entries(mixed);
  else key = $key = mixed;
  return Object.assign(prev, { [$key]: v[key] });
}, {});
