# GraphQLShape

[![Build Status](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml/badge.svg)](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml)

Shape the response of your GraphQL queries, **declaratively!**

This project explores the concept of *Query & Transformation Collocation* in **GraphQL**.

It includes [JSONPath+](https://www.npmjs.com/package/jsonpath-plus) to help select and transform data to it's required shape!

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

### Learn By Example
```graphql
query {
  books @shape(self: "edges[*].node") {
    edges {
      node {
        isbn
        title
        author @shape(self: "name") { name }
        published: publishDate @shape(Date: "new", toISOString: null)

        # Must specify "parent" because self/field/compound is made up (removed from query)
        compound @_shape(parent: "$[isbn,title]", map: [{ toLowerCase: null }, { replace: [" ", "-"] }, { join: ":" }])

        # Hoist all attributes and remove "detail"
        detail @shape(hoist: false) {
          summary
          rating
        }
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
      "published": "1851-10-18T04:56:02.000Z",
      "compound": "0-061-96436-0:moby-dick",
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
name | arg | description
--- | --- | ---
`self` | JSONPath | JSONPath from the current field
`parent` | JSONPath | JSONPath from the field's parent
`root` | JSONPath | JSONPath from the root object
`map` | Transform(s) | Iterate field value(s) and apply transform(s) to each
`assign` | Value | Assign any value to the field
`rename` | Key | Rename the field key
`hoist` | Keep? | Hoist all field attributes to the parent and optionally keep field

#### Core
name | arg | description | eg. to produce
--- | --- | --- | ---
`*` | null |Invoke a core object (no method) | `String(value)`
`*` | "new" | Instantiate a core object | `new Array(value)`
`*` | Method | Invoke a core object method | `Date.now(value)`
> Where `*` is one of `[Object, Array, Number, String, Boolean, Symbol, Date, RegExp, Set, Map, WeakMap, WeakSet, Buffer, Math, JSON, Intl]`

#### User
name | arg | description
--- | --- | ---
`push` | Value(s) | Push value(s); return array
`unshift` | Value(s) | Unshift value(s); return array
`in` | Values | Boolean: if value in values
`nin` | Values | Boolean: if value **not** in values
`eq` | {array} [if, then, else] | Hoist all field attributes to the parent and optionally delete field
`ne` | {array} [if, then, else] | Hoist all field attributes to the parent and optionally delete field
`gt` | {array} [if, then, else] | Hoist all field attributes to the parent and optionally delete field
`gte` | {array} [if, then, else] | Hoist all field attributes to the parent and optionally delete field
`lt` | {array} [if, then, else] | Hoist all field attributes to the parent and optionally delete field
`lte` |{array} [if, then, else] | Hoist all field attributes to the parent and optionally delete field
`not` | null | Negate value
`or` | Value(s) | Boolean: if **any** value.concat(values) is truthy
`and` | Value(s) | Boolean: if **all** value.concat(values) are truthy
`add` | Number(s) | Add (sum)
`sub` | Number(s) | Subtract
`div` | Number(s) | Divide
`mul` | Number(s) | Multiply
`mod` | Number(s) | Modulus
`get` | Path(s) | Lodash.get like
`set` | [Key, Value] | Lodash.set like
`nvl` | Value(s) | Return *first* **! === null** value from [value, ...values]
`uvl` | Value(s) | Return *first* **! === undefined** value from [value, ...values]
`default` | Value(s) | Return *first* **! == null** value from [value, ...values]
`pick` | Keep? | Boolean | Hoist all field attributes to the parent and optionally delete field
`pairs` | null | Transform flat array to 2D elements of 2 (pair) length
`flatten` | * | Flatten object
`unflatten` | * | Unflatten object

#### Value
Lastly, invoke `value.key(...args)` if function; otherwise return value (noop).

### Extension
You may `define` (or redefine) a *user* transformation via:
```javascript
GraphQLShape.define(name, function); // or
GraphQLShape.define(Map); // { name: function, name: function, ... }
```
> Function signature: `(value, ...args) => newValue`
