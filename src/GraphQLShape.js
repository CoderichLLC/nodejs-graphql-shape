const Util = require('@coderich/util');
const { JSONPath } = require('jsonpath-plus');
const { Kind, visit, parse, print } = require('graphql');

class GraphQLShape {
  constructor(query, options = {}) {
    options.name ??= 'shape';
    return GraphQLShape.parse(parse(query), options);
  }

  static define(key, fn) {
    GraphQLShape.functions[key] = fn;
  }

  static parse(ast, options) {
    const thunks = [];
    const paths = [];
    const fpaths = [];
    const transforms = [];
    const fragments = {};
    let target = transforms, isFragment = false, counter = 0;

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
              const args = node.arguments.reduce((prev, arg) => {
                const key = arg.name.value;
                const value = GraphQLShape.#resolveNodeValue(arg.value);
                return Object.assign(prev, { [key]: value });
              }, {});

              const $paths = isFragment ? fpaths : paths;
              target.push({ ...args, key: $paths.join('.') });
            }
            break;
          }
          case Kind.FIELD: {
            const key = alias ?? name;
            if (isFragment) fpaths.push(key);
            else paths.push(key);
            // if (key === 'state') console.log(isFragment, node);
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
          case Kind.OPERATION_DEFINITION: {
            break;
          }
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

    thunks.forEach(thunk => thunk());
    return { query, transforms: transforms.reverse(), fragments };
  }

  static transform(data, transforms = []) {
    // Apply transformations (in place)
    transforms.forEach(({ key, path = '$', ...rest }) => {
      Util.pathmap(key, data, (json) => {
        let value = JSONPath({ path, json, wrap: false });

        // Apply the rest (in the order they are defined)
        if (value !== null) {
          Object.entries(rest).forEach(([fn, mixed]) => {
            switch (fn) {
              case 'map': {
                Util.map(mixed, (mix) => {
                  const [, name = mix, args = ''] = mix.match(/(\w+)\s*\((.*?)\)|(.*)/);
                  const $args = args.split(',').map(el => el.trim());
                  value = Util.map(value, v => GraphQLShape.#resolveValueFunction(v, name, ...$args));
                });
                break;
              }
              default: {
                value = GraphQLShape.#resolveValueFunction(value, fn, ...mixed);
                break;
              }
            }
          });
        }

        // Set the value back
        return value;
      });
    });

    return data; // For convenience (and testing)
  }

  static #resolveValueFunction(v, fn, ...args) {
    return Object.prototype.hasOwnProperty.call(GraphQLShape.functions, fn) ? GraphQLShape.functions[fn](v, ...args) : v[fn](...args);
  }

  static #resolveNodeValue(node) {
    switch (node.kind) {
      case 'NullValue': return null;
      case 'ListValue': return node.values.map(GraphQLShape.#resolveNodeValue);
      case 'EnumValueDefinition': return node.name.value;
      case 'EnumTypeDefinition': return node.values.map(GraphQLShape.#resolveNodeValue);
      case 'ObjectValue': return node.fields.reduce((prev, field) => Object.assign(prev, { [field.name.value]: GraphQLShape.#resolveNodeValue(field.value) }), {});
      default: return node.value ?? node;
    }
  }
}

GraphQLShape.functions = {
  keys: v => Object.keys(v),
  values: v => Object.values(v),
  entries: v => Object.entries(v),
  fromEntries: v => Object.fromEntries(v),
};

module.exports = GraphQLShape;
