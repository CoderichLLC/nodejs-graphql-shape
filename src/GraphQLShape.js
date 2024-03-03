const Util = require('@coderich/util');
const { JSONPath } = require('jsonpath-plus');
const { Kind, visit, parse, print } = require('graphql');
const functions = require('./functions');
const core = require('./core');

module.exports = class GraphQLShape {
  static define(key, fn) {
    functions[key] = fn;
  }

  static parse(ast, options = {}) {
    if (typeof ast === 'string') ast = parse(ast);
    options.name ??= 'shape';
    const thunks = [];
    const paths = [];
    const fpaths = [];
    const transforms = [];
    const fragments = {};
    const deleteNodes = new WeakMap();
    let target = transforms, isFragment = false, counter = 0, field;

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
            if ([options.name, `_${options.name}`].includes(name)) {
              const ops = node.arguments.map((arg) => {
                const key = arg.name.value;
                const value = GraphQLShape.#resolveNodeValue(arg.value);
                if (name === `_${options.name}`) deleteNodes.set(field.name, false);
                return { [key]: value };
              }).filter(Boolean);

              const $paths = isFragment ? fpaths : paths;
              target.push({ key: $paths.join('.'), ops });
            }
            break;
          }
          case Kind.FIELD: {
            const key = alias ?? name;
            if (isFragment) fpaths.push(key);
            else paths.push(key);
            field = node;
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
            if (deleteNodes.has(node.name)) return null;
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
    // Apply transformations (in place)
    transforms.forEach(({ key, ops = [] }) => {
      const thunks = [];

      // We assign data here because it's possible to modify the root/data itself (via key: '')
      data = Util.pathmap(key, data, (value, info) => {
        const vars = [value];

        ops.forEach((op) => {
          const [[fn, mixed]] = Object.entries(op);

          switch (fn) {
            case 'self': case 'parent': case 'root': {
              const json = [value, info.parent, data][['self', 'parent', 'root'].indexOf(fn)];

              try {
                value = Util.isPlainObjectOrArray(json) ? JSONPath({ path: mixed, json, wrap: false }) : json;
              } catch (e) {
                e.data = { json, mixed };
                throw e;
              }

              break;
            }
            case 'map': {
              Util.map(mixed, (el) => {
                const [[fnName, args]] = Object.entries(el);
                value = Util.map(value, v => GraphQLShape.#resolveValueFunction(v, vars, fnName, args));
              });
              break;
            }
            case 'assign': {
              value = GraphQLShape.#resolveVariableArgs(vars, mixed);
              break;
            }
            case 'rename': {
              thunks.push(() => {
                info.parent[GraphQLShape.#resolveVariableArgs(vars, mixed)] = value;
                delete info.parent[info.key];
              });
              break;
            }
            case 'hoist': {
              thunks.push(() => {
                Object.assign(info.parent, value);
                if (!mixed) delete info.parent[info.key];
              });
              break;
            }
            default: {
              value = GraphQLShape.#resolveValueFunction(value, vars, fn, mixed);
              break;
            }
          }

          vars.push(value);
        });

        // Set the value back
        return value;
      });

      // Deferred processing
      thunks.forEach(thunk => thunk());
    });

    return data;
  }

  static #resolveVariableArgs(vars, args) {
    return Util.map(args, (arg) => {
      const match = `${arg}`.match(/\$(\d)/);
      return match ? vars[match[1]] : arg;
    });
  }

  static #resolveValueFunction(value, vars, fn, ...args) {
    // Argument replacement variables
    args = GraphQLShape.#resolveVariableArgs(vars, args.flat());
    const firstUserArg = args.shift();

    // Core functions have a special syntax
    if (core[fn]) {
      if (firstUserArg === 'new') return new core[fn](value, ...args);
      if (firstUserArg === null) return core[fn](value, ...args);
      return core[fn][firstUserArg](value, ...args);
    }

    if (functions[fn]) {
      if (firstUserArg === null) return functions[fn](value, ...args);
      return functions[fn](value, firstUserArg, ...args);
    }

    if (value?.[fn]) {
      if (firstUserArg === null) return value[fn](...args);
      return value[fn](firstUserArg, ...args);
    }

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
};
