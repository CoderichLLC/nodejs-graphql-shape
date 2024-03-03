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
Annotations can be defined on any **field** you wish to transform.
By default, the directive name is `shape` and may be configured via `options.name` when calling `parse()`
directive | description | .parse()
--- | --- | ---
`@shape` | For use on an **existing** field in the GraphQL Schema | The *annotation* is removed from the *field*
`@_shape` | For use on a **non-existing** field in the GraphQL Schema | The *field* is removed from the *query*

### Transformations (pipeline)
Transformations are performed via as a series of parameters placed on each directive and adhere to the following rules:
* Transformations are evaluated depth-first (inside-out, bottom-up) and from left-to-right
* Each transformation receives the return value from the previous; creating a data pipeline

You may `define` (or redefine) a customer **user** transformation via:
```javascript
GraphQLShape.define(tfName, tfFunction); // or
GraphQLShape.define(objectMap); // { tfName: tfFunction, tfName: tfFunction, ... }
```
> Function signature: `(value, ...args) => newValue`


### API
By default, the framework provides a set of functions to perform common data transformations. Each function falls into 1 of the following categories (in order of preference):

##### Lib
These functions are the first used when attempting to match a given *key*:
key | value | type | description
--- | --- | --- | ---
`self` | JSONPath | String, Array | Select from the current field
`parent` | JSONPath | String, Array | Select from the field's parent
`root` | JSONPath | String, Array | Select from the root object
`map` | Transform | Object, AoO | Iterate field value(s) and apply transformation(s) to each
`assign` | Value | Any | Assign a value to the field
`rename` | Key | String | Rename the field key
`hoist` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field

##### Core
You may provide a *key* for the following Javascript Core Objects `[Object, Array, Number, String, Boolean, Symbol, Date, RegExp, Set, Map, WeakMap, WeakSet, Buffer, Math, JSON, Intl]`
key | value | type | description | example
--- | --- | --- | --- | ---
`*` | Method | String | Invoke a core object method | `Date.now(value, ...args)`
`*` | null | null |Invoke a core object (no method) | `Boolean(value, ...args)`
`*` | "new" | String | Instantiate a core object | `new Array(value, ...args)`

##### User

##### Value

category | functions
--- | ---
*lib* | `[self, parent, root, map, assign, rename, hoist]`
*core* | `[Object, Array, Number, String, Boolean, Symbol, Date, RegExp, Set, Map, WeakMap, WeakSet, Buffer, Math, JSON, Intl]`
*user* | `[push, pop, shift, unshift, in, nin, eq, ne, gt, gte, lt, lte, not, or, and, add, sub, div, mul, mod, get, set, nvl, uvl, pairs, flatten, unflatten, pick]`
*value* | Any value[method]; eg `[toLowerCase, join, split]`

##### Example
```graphql
query {
  books @shape(self: "edges[*].node") {
    edges {
      node {
        isbn
        title
        author @shape(self: "name") { name }
        details @shape(pick: ["summary", "rating"], hoist: false) # mixed/schemaless JSON
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

```graphql
query {
  books @shape(self: "edges[*].node") {
    edges {
      node {
        title
        author @shape(self: "name") {
          name
        }
        stores {
          name
          price
        }
      }
    }
  }
}
```