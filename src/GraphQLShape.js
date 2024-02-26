const Util = require('@coderich/util');
const { JSONPath } = require('jsonpath-plus');
const { Kind, visit, parse, print } = require('graphql');

class GraphQLShape {
  static define(key, fn) {
    GraphQLShape.functions[key] = fn;
  }

  static parse(ast, options = {}) {
    if (typeof ast === 'string') ast = parse(ast);
    options.name ??= 'shape';
    const thunks = [];
    const paths = [];
    const fpaths = [];
    const transforms = [];
    const fragments = {};
    let target = transforms, isFragment = false, counter = 0;

    // Parse out directives while building transforms
    const query = print(visit(ast, {
      enter: (node) => {
        const name = node.name?.value;
        const alias = node.alias?.value;

        switch (node.kind) {
          case Kind.FRAGMENT_DEFINITION: {
            target = fragments[name] = [];
            isFragment = true;
            break;
          }
          case Kind.FRAGMENT_SPREAD: {
            const $paths = [...paths];
            const start = transforms.length;

            thunks.push(() => {
              const fragment = fragments[name];
              const additions = fragment.map((obj) => {
                const key = $paths.concat(obj.key.split('.')).join('.');
                return { ...obj, key };
              });
              transforms.splice(start + counter, 0, ...additions);
              counter += additions.length;
            });
            break;
          }
          case Kind.DIRECTIVE: {
            if (name === options.name) {
              const ops = node.arguments.map((arg) => {
                const key = arg.name.value;
                const value = GraphQLShape.#resolveNodeValue(arg.value);
                return { [key]: value };
              });

              const $paths = isFragment ? fpaths : paths;
              target.push({ key: $paths.join('.'), ops });
            }
            break;
          }
          case Kind.FIELD: {
            const key = alias ?? name;
            if (isFragment) fpaths.push(key);
            else paths.push(key);
            break;
          }
          default: {
            break;
          }
        }
      },
      leave: (node) => {
        const name = node.name?.value;

        switch (node.kind) {
          case Kind.FRAGMENT_DEFINITION: {
            isFragment = false;
            target = transforms;
            break;
          }
          case Kind.DIRECTIVE: {
            if (name === options.name) return null;
            break;
          }
          case Kind.FIELD: {
            if (isFragment) fpaths.pop();
            else paths.pop();
            break;
          }
          default: {
            break;
          }
        }

        return undefined;
      },
    }));

    // Finalizations due to unpredictable order for AST
    thunks.forEach(thunk => thunk());

    return {
      query,
      fragments,
      transforms: transforms.reverse(), // We must reverse the order since we do depth-first traversal
      transform: data => GraphQLShape.transform(data, transforms),
    };
  }

  static transform(data, transforms = []) {
    const hoisted = [];

    // Apply transformations (in place)
    transforms.forEach(({ key, ops = [] }) => {
      // We assign data here because it's possible to modify the root/data itself (key: '')
      data = Util.pathmap(key, data, (value, info) => {
        const originalValue = value;

        ops.forEach((op) => {
          const [[fn, mixed]] = Object.entries(op);

          switch (fn) {
            case 'self': case 'parent': case 'root': {
              const json = [value, info.parent, data][['self', 'parent', 'root'].indexOf(fn)];
              value = Util.isPlainObjectOrArray(json) ? JSONPath({ path: mixed, json, wrap: false }) : json;
              break;
            }
            case 'map': {
              Util.map(mixed, (el) => {
                const [[fnName, args]] = Object.entries(el);
                value = Util.map(value, v => GraphQLShape.#resolveValueFunction(v, originalValue, fnName, args));
              });
              break;
            }
            case 'hoist': {
              if (!mixed) hoisted.push(info);
              Object.assign(info.parent, value);
              break;
            }
            default: {
              value = GraphQLShape.#resolveValueFunction(value, originalValue, fn, mixed);
              break;
            }
          }
        });

        // Set the value back
        return value;
      });
    });

    // Delete any hoisted keys
    hoisted.forEach(({ key, parent }) => delete parent[key]);

    return data; // For convenience (and testing)
  }

  static #resolveValueFunction(value, originalValue, fn, ...args) {
    args = Util.ensureArray(args).flat().map(arg => (`${arg}`.match(/\$/) ? originalValue : arg));
    if (GraphQLShape.functions[fn]) return GraphQLShape.functions[fn](value, ...args);
    if (value?.[fn]) return value[fn](...args);
    return value;
  }

  static #resolveNodeValue(node) {
    switch (node.kind) {
      case 'NullValue': return null;
      case 'IntValue': return parseInt(node.value, 10);
      case 'StringValue': return `${node.value}`;
      case 'ListValue': return node.values.map(GraphQLShape.#resolveNodeValue);
      case 'EnumValueDefinition': return node.name.value;
      case 'EnumTypeDefinition': return node.values.map(GraphQLShape.#resolveNodeValue);
      case 'ObjectValue': return node.fields.reduce((prev, field) => Object.assign(prev, { [field.name.value]: GraphQLShape.#resolveNodeValue(field.value) }), {});
      default: return node.value ?? node;
    }
  }
}

GraphQLShape.functions = ['push', 'pop', 'shift', 'unshift'].reduce((prev, fn) => {
  return Object.assign(prev, {
    [fn]: (v, ...rest) => {
      v?.[fn]?.(...rest);
      return v;
    },
  });
}, {
  nvl: Util.nvl,
  uvl: Util.uvl,
  keys: v => (v ? Object.keys(v) : v),
  values: v => (v ? Object.values(v) : v),
  entries: v => (v ? Object.entries(v) : v),
  fromEntries: v => (v ? Object.fromEntries(v) : v),
  eq: (v, ...rest) => {
    return Util.uvl(Util.pairs(rest).reduce((prev, [value, result], i) => {
      if (prev !== undefined) return prev;
      if (prev === undefined && result === undefined && i > 0) return value;
      if (v === value) return result;
      return undefined;
    }, undefined), v);
  },
});

module.exports = GraphQLShape;
