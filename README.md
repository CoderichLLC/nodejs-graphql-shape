# GraphQLShape

[![Build Status](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml/badge.svg)](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml)

Shape the response of your GraphQL queries, **declaratively!**

This project explores the concept of *Query & Transformation Collocation* in **GraphQL**.

It supports [JSONPath+](https://www.npmjs.com/package/jsonpath-plus) syntax to help select and transform data into any shape you need!

---

### Usage
1. Annotate a query with transformation rules
2. Parse the AST/QueryString pre-request
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
Transformations are specified as a series of directive parameters and adhere to the following rules:
* Transformations are applied depth-first (inside-out) and from left-to-right
* Each transformation receives the value from the previous; creating a data pipeline

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
    "...",
  ]
}
```

##### API (framework)
The transformation API is designed to be **extensible** to fit the unique needs of each use-case. You may `define` (or redefine) any transformation function via:
```javascript
GraphQLShape.define(tfName, tfFunction); // or
GraphQLShape.define(objectMap); // { tfName: tfFunction, tfName: tfFunction }
```
