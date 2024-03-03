# GraphQLShape

[![Build Status](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml/badge.svg)](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml)

Shape the response of your GraphQL queries, **declaratively!**

This project explores the concept of *Query & Transformation Collocation* in **GraphQL**.

It supports [JSONPath+](https://www.npmjs.com/package/jsonpath-plus) syntax to help select and transform data into the exact shape you need!

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
By default, the directive name is `shape` and may be configured via `options.name` when calling `parse()`
directive | usage | .parse()
--- | --- | ---
`@shape` | Define transformations on an **existing** field in the GraphQL Schema | The *annotation* is removed from the *field*
`@_shape` | Define transformations on a **non-existing** field in the GraphQL Schema | The *field* is removed from the *query*

### Transformations (pipeline)
Transformations are performed via as a series of directive parameters that adhere to the following rules:
* Transformations are applied depth-first (inside-out, bottom-up) and from left-to-right
* Each transformation receives the return value from the previous; creating a data pipeline

Transformations are designed to be extensible to fit the unique needs of each use-case. You may `define` (or redefine) a **user** transformation function via:
```javascript
GraphQLShape.define(tfName, tfFunction); // or
GraphQLShape.define(objectMap); // { tfName: tfFunction, tfName: tfFunction, ... }
```
> Function signature: `(value, ...args) => newValue`


### API
By default, the framework provides a set of functions to perform common transformations on input data. Each function falls into 1 of the following categories (in priority order):
category | functions
--- | ---
*lib* | `[self, parent, root, map, assign, rename, hoist]`
*core* | `[Object, Array, Number, String, Boolean, Symbol, Date, RegExp, Set, Map, WeakMap, WeakSet, Buffer, Math, JSON, Intl]`
*user* | `[push, pop, shift, unshift, in, nin, eq, ne, gt, gte, lt, lte, not, or, and, add, sub, div, mul, mod, get, set, nvl, uvl, pairs, flatten, unflatten, pick]`
*value* | Any value[method]; eg `[toLowerCase, join, split]`

##### lib
key | value | type | description
--- | --- | --- | ---
`self` | JSONPath | String, Array | Select values from the current object
`parent` | JSONPath | String, Array | Select values from the parent object
`root` | JSONPath | String, Array | Select values from the root object
`map` | Transform | Object, AoO | Iterate value(s) and apply transformation(s) to each
`assign` | Value | Any | Assign any value in the pipeline
`rename` | Key | String | Rename the key of the current object
`hoist` | Keep? | Boolean | Assign all attributes to the parent and optionally delete object
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

##### core
Javascript core objects `[Object, Array, Number, String, Boolean, Symbol, Date, RegExp, Set, Map, WeakMap, WeakSet, Buffer, Math, JSON, Intl]`
key | args | description | example
--- | --- | --- | ---
`*` | Method | Invoke a core object method | `Date.now(value, ...args)`
`*` | null | Invoke a core object (no method) | `Object(value, ...args)`
`*` | "new" | Instantiate a new core object | `new Array(value, ...args)`
```graphql
query {

}
```
##### user
##### value

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