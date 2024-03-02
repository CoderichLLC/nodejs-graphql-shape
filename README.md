# GraphQLShape

[![Build Status](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml/badge.svg)](https://github.com/CoderichLLC/nodejs-graphql-shape/actions/workflows/publish.yml)

Shape the response of your GraphQL queries, **declaratively!**
This project explores the concept of Query and Transformation Collocation in **GraphQL**.
It utilizes [JSONPath+](https://www.npmjs.com/package/jsonpath-plus) syntax to help extract and transform data to any shape!


---

### Usage
1. Annotate a query with transformation rules
2. Parse the AST/QueryString pre-request
3. Transform the result post-response

```javascript
const { parse } = require('@coderich/graphql-shape');

const { query, transform } = parse(annotatedQuery, [options]);
const data = await graphqlClient.request(query, args);
const shaped = transform(data);
```

### Annotations (Directives)
By default, the directive name is `shape` and may be configured via `options.name` when calling `parse()`
directive | usage | .parse()
--- | --- | ---
`@shape` | Define transformations on an **existing** field in the GraphQL Schema | The *annotation* is removed from the *field*
`@_shape` | Define transformations on a **non-existing** fields in the GraphQL Schema | The *field* is removed from the *query*

### Transformations (Pipeline)
Transformations are specified as a series of directive parameters on each field and adhere to the following rules:
* Transformations are applied depth-first (inside-out) and from left-to-right
* Each transformation receives the value from the previous creating a pipeline

### Example (Kitchen Sink)
```graphql
query {
    hello @shape()
}
```
