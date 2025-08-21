const Get = require('lodash.get');
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
    const schema = {};
    const thunks = [];
    const paths = [];
    const fpaths = [];
    const transforms = [];
    const fragments = {};
    const deleteNodes = new WeakMap();
    let target = transforms, isFragment = false, field;
    transforms.$counter = 0;
    fragments.$counter = 0;

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
            const $paths = [...isFragment ? fpaths : paths];
            const start = target.length;
            const $target = target;

            thunks.push(() => {
              const fragment = fragments[name];
              const additions = fragment.map((obj) => {
                const key = $paths.concat(obj.key.split('.')).join('.');
                return { ...obj, key };
              });
              $target.splice(start + $target.$counter, 0, ...additions);
              $target.$counter += additions.length;
            });
            break;
          }
          case Kind.DIRECTIVE: {
            if ([options.name, `_${options.name}`].includes(name)) {
              if (name === `_${options.name}`) deleteNodes.set(field.name, false);

              const ops = node.arguments.map((arg) => {
                const k = arg.name.value;
                const value = GraphQLShape.#resolveNodeValue(arg.value);
                return { [k]: value };
              }).filter(Boolean);

              const $paths = isFragment ? fpaths : paths;
              const key = $paths.join('.');
              schema[key] = ops.reduce((prev, curr) => Object.assign(prev, curr), {});
              target.push({ key, ops });
            }

            break;
          }
          case Kind.FIELD: {
            const key = alias ?? name;
            if (isFragment) fpaths.push(key);
            else paths.push(key);
            const $paths = isFragment ? fpaths : paths;
            schema[$paths.join('.')] = {};
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

    // Cleanup
    delete transforms.$counter;
    delete fragments.$counter;

    // Depth-first but preserves the parent/root order
    transforms.sort((a, b) => {
      if (a.key === '') return 1;
      if (b.key === '') return -1;
      if (a.key.startsWith(b.key) && a.key.length > b.key.length) return -1;
      if (b.key.startsWith(a.key) && b.key.length > a.key.length) return 1;
      return 0;
    });

    return {
      query,
      schema,
      fragments,
      transforms,
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
                const path = GraphQLShape.#resolveVariableArgs(vars, mixed);
                value = Util.isPlainObjectOrArray(json) ? JSONPath({ path, json, wrap: false }) : json;
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
                const args = GraphQLShape.#resolveVariableArgs(vars, mixed);

                if (typeof args === 'string') { // Rename the parent element itself
                  info.parent[args] = value;
                  delete info.parent[info.key];
                } else { // Rename parent keys (like "pick" but keep everything else)
                  const pairs = Array.isArray(args) ? args : Object.entries(args);
                  Util.map(value, (v) => {
                    pairs.forEach(([k, $k]) => {
                      Util.set(v, $k, Get(v, k));
                      delete v[k];
                    });
                  });
                }
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

      // Deferred processing (because we set the "value" back to the object line: 213)
      thunks.forEach(thunk => thunk());
    });

    return data;
  }

  static #resolveVariableArgs(vars, args) {
    return Util.map(args, (arg) => {
      const match = `${arg}`.match(/\$(\d+)/);
      if (!match) return arg;
      const key = match[1];
      const value = vars[key];
      return Array.isArray(arg) ? [value] : value;
    });
  }

  static #resolveValueFunction(value, vars, fn, ...args) {
    // Argument replacement variables
    args = GraphQLShape.#resolveVariableArgs(vars, args.flat());

    // Core functions have a special syntax
    if (core[fn]) {
      const firstUserArg = args.shift();
      if (firstUserArg === 'new') return new core[fn](value, ...args);
      if (!firstUserArg) return core[fn](value, ...args);
      return core[fn][firstUserArg](value, ...args);
    }

    if (functions[fn]) {
      return functions[fn](value, ...args);
    }

    if (typeof value?.[fn] === 'function') {
      return value[fn](...args);
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
      default: return node.value === 'undefined' ? undefined : (node.value ?? node);
    }
  }
};
