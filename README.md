# GraphQLShape

[![Build Status](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml/badge.svg)](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml)

Shape the response of your GraphQL queries, **declaratively!**

This project explores the concept of *Query & Transformation Collocation* in **GraphQL**.

It includes [JSONPath+](https://www.npmjs.com/package/jsonpath-plus) to help select and transform data to the exact shape required!

---

### Usage
1. Annotate a query with transformation rules
2. Parse the query AST/String pre-request
3. Transform the result post-response

```javascript
const { parse } = require('@coderich/graphql-shape');

const { query, transform } = parse(annotatedQuery, [options]);
const data = await graphqlClient.request(query, args); // Your own client
const shaped = transform(data);
```

### Annotations (directives)
Annotations can be defined on any **field** that requires transformation. By default, the directive name is `shape` and may be configured via `options.name` when calling `parse()`
annotation | description | .parse()
--- | --- | ---
`@shape` | Transform an **existing** field in the GraphQL Schema | The *annotation* is removed from the *field*
`@_shape` | Define/Transform a **non-existing** field in the GraphQL Schema | The *field* is removed from the *query*

### Transformations (annotation arguments)
Transformations are performed via annotation arguments where each *key:value* pair maps to a transformation *name:args* function call:
* Transformations are evaluated depth-first (inside-out, bottom-up) and from left-to-right
* Each transformation assigns it's return value to the annotated field (mutating it)
* Each transformation receives the current field value as it's first argument

#### Example
```graphql
query {
  books @shape(self: "edges[*].node") {
    edges {
      node {
        isbn
        title
        author @shape(self: "name") {
          name
        }
        details @shape(pick: ["summary", "rating"], hoist: false) # Schemaless JSON
      }
    }
  }
}
```

```json
{
  "books": [
    {
      "isbn": "0-061-96436-0",
      "title": "Moby Dick",
      "author": "Herman Melville",
      "summary": "A legendary tale...",
      "rating": "4.90"
    },
    "...",
  ]
}
```

### API

Each transformation falls into 1 of the following lookup tables (referenced in order of preference):

#### Lib
Baseline transformations. Cannot be re-defined.
key | value | type | description
--- | --- | --- | ---
`self` | JSONPath | String, Array | Select from the current field
`parent` | JSONPath | String, Array | Select from the field's parent
`root` | JSONPath | String, Array | Select from the root object
`map` | Transform | Object, AoO | Iterate field value(s) and apply transformation(s) to each
`assign` | Value | Any | Assign a value to the field
`rename` | Key | String | Rename the field key
`hoist` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field

#### Core
Javascript core object references. Cannot be re-defined.
key | value | type | description | example
--- | --- | --- | --- | ---
`*` | Method | String | Invoke a core object method | `Date.now(value, ...args)`
`*` | null | null |Invoke a core object (no method) | `Boolean(value, ...args)`
`*` | "new" | String | Instantiate a core object | `new Array(value, ...args)`
> Where `*` is one of `[Object, Array, Number, String, Boolean, Symbol, Date, RegExp, Set, Map, WeakMap, WeakSet, Buffer, Math, JSON, Intl]`

#### User
Useful set of transformations. **Can** be re-defined.
key | value | type | description
--- | --- | --- | ---
`push` | Any | String, Array | `Array.concat` alias
`pop` | null | null | `Array.pop`; return array
`shift` | null | null | `Array.shift`; return array
`unshift` | Any | String, Array | `Array.unshift`; return array
`in` | Values | Array | Return boolean if value in values
`nin` | Values | Array | Return boolean if value not in values
`eq` | Values | Array | Hoist all field attributes to the parent and optionally delete field
`ne` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`gt` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`gte` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`lt` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`lte` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`not` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`or` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`and` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`add` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`sub` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`div` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`mul` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`mod` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`get` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`set` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`nvl` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`uvl` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`default` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`pick` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`pairs` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`flatten` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`unflatten` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field

#### Value
Lastly, invoke value.key(...args) if function; otherwise return value.

### Extension
You may `define` (or redefine) a *user* transformation via:
```javascript
GraphQLShape.define(name, function); // or
GraphQLShape.define(Map); // { name: function, name: function, ... }
```
> Function signature: `(value, ...args) => newValue`
