const Util = require('@coderich/util');
const get = require('lodash.get');
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
    const paths = [];
    const transforms = [];
    const fragments = {};
    let target = transforms, isFragment = false;

    const query = print(visit(ast, {
      enter: (node) => {
        const name = node.name?.value;
        const alias = node.alias?.value;

        switch (node.kind) {
          case Kind.FRAGMENT_SPREAD: {
            // console.log(node);
            break;
          }
          case Kind.FRAGMENT_DEFINITION: {
            target = fragments[name] = [];
            isFragment = true;
            break;
          }
          case Kind.DIRECTIVE: {
            if (name === options.name) {
              const args = node.arguments.reduce((prev, arg) => {
                const key = arg.name.value;
                const value = GraphQLShape.#resolveNodeValue(arg.value);
                return Object.assign(prev, { [key]: value });
              }, {});

              target.push({ ...args, key: paths.join('.') });
            }
            break;
          }
          case Kind.FIELD: {
            if (!isFragment) {
              paths.push(alias ?? name);
              // console.log(JSON.stringify(node, null, 2));
            }
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
            paths.pop();
            break;
          }
          default: {
            break;
          }
        }

        return undefined;
      },
    }));

    console.log(transforms);
    return { query, transforms };
  }

  static transform(data, transforms = []) {
    // Apply transformations (in place)
    transforms.forEach(({ key, path = '$', ...rest }) => {
      const json = get(data, key);
      let value = JSONPath({ path, json, wrap: false });

      // Apply the rest (in the order they are defined)
      if (value !== null) {
        Object.entries(rest).forEach(([fn, mixed]) => {
          switch (fn) {
            case 'each': {
              Util.map(mixed, (mix) => {
                value = Util.map(value, v => v[mix]());
              });
              break;
            }
            default: {
              value = value[fn](...mixed);
              break;
            }
          }
        });
      }

      // Set the value back
      Util.set(data, key, value);
    });

    return data; // For convenience
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

GraphQLShape.functions = {};

module.exports = GraphQLShape;
