---
title: MongoDB
category: integrations
actions:
  [
    find-one,
    find,
    count,
    estimated-count,
    distinct,
    insert-one,
    insert-many,
    update-one,
    update-many,
    replace-one,
    delete-one,
    delete-many,
    find-one-and-update,
    find-one-and-replace,
    find-one-and-delete,
    bulk-write,
    transaction,
    aggregate,
    create-index,
    create-indexes,
    drop-index,
    drop-indexes,
    list-indexes,
    list-collections,
    create-collection,
    drop-collection,
    rename-collection,
    collection-stats,
    db-stats,
    drop-database,
    run-command,
  ]
complexity: intermediate
---

# MongoDB

[MongoDB](https://www.mongodb.com) is a document database that stores
data as flexible JSON-like documents with dynamic schemas. It supports
rich queries, aggregation pipelines, ACID transactions on replica sets,
and horizontal scaling through sharding. Use this action to read, write,
aggregate, and manage documents, indexes, and collections directly from
W3 workflows -- no application server required.

## Quick start

```yaml
- name: Insert event
  uses: w3/mongodb@v1
  with:
    command: insert-one
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    document: '{"type": "payment", "amount": 100, "ts": "2024-01-15"}'

- name: Query events
  id: results
  uses: w3/mongodb@v1
  with:
    command: find
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    filter: '{"type": "payment"}'
    sort: '{"amount": -1}'
    limit: '10'
```

## Read commands

### find-one

Find a single document matching a filter.

| Input | Required | Description |
| ------------ | -------- | -------------------------------- |
| `collection` | yes | Collection name |
| `filter` | no | Query filter as JSON (default: `{}`) |
| `projection` | no | Fields to include/exclude |
| `sort` | no | Sort specification |

**Output (`result`):**

```json
{
  "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
  "type": "payment",
  "amount": 100
}
```

Returns `null` if no document matches.

### find

Find multiple documents with filter, sort, skip, limit, and projection.

| Input | Required | Description |
| ------------ | -------- | -------------------------------- |
| `collection` | yes | Collection name |
| `filter` | no | Query filter as JSON |
| `projection` | no | Fields to include/exclude |
| `sort` | no | Sort specification |
| `limit` | no | Max documents to return |
| `skip` | no | Documents to skip |

**Output (`result`):**

```json
[
  {"_id": "...", "type": "payment", "amount": 500},
  {"_id": "...", "type": "payment", "amount": 100}
]
```

### count

Count documents matching a filter.

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |
| `filter` | no | Query filter |

**Output (`result`):** `{"count": 42}`

### estimated-count

Fast approximate count using collection metadata. No filter supported.

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |

**Output (`result`):** `{"count": 1000000}`

### distinct

Get distinct values for a field across the collection.

| Input | Required | Description |
| ------------ | -------- | -------------------- |
| `collection` | yes | Collection |
| `field` | yes | Field name |
| `filter` | no | Optional query filter |

**Output (`result`):** `["payment", "refund", "transfer"]`

## Write commands

### insert-one

| Input | Required | Description |
| ------------ | -------- | ---------------------- |
| `collection` | yes | Collection |
| `document` | yes | Document as JSON |

**Output (`result`):**

```json
{
  "acknowledged": true,
  "insertedId": "65a1b2c3d4e5f6a7b8c9d0e1"
}
```

### insert-many

| Input | Required | Description |
| ------------ | -------- | ---------------------------------------- |
| `collection` | yes | Collection |
| `documents` | yes | JSON array of documents |
| `ordered` | no | Execute in order (default: `true`) |

**Output (`result`):**

```json
{
  "acknowledged": true,
  "insertedCount": 3,
  "insertedIds": ["...", "...", "..."]
}
```

### update-one

Update the first document matching a filter.

| Input | Required | Description |
| ------------ | -------- | ---------------------------------------------------- |
| `collection` | yes | Collection |
| `filter` | yes | Query filter |
| `update` | yes | Update operations (e.g. `{"$set": {"status": "done"}}`) |
| `upsert` | no | Insert if no match (default: `false`) |

**Output (`result`):**

```json
{
  "acknowledged": true,
  "matchedCount": 1,
  "modifiedCount": 1,
  "upsertedId": null
}
```

### update-many

Update all documents matching a filter. Same inputs as `update-one`.

### replace-one

Replace a document entirely (not a partial update).

| Input | Required | Description |
| ------------ | -------- | ----------------------------------- |
| `collection` | yes | Collection |
| `filter` | yes | Query filter |
| `document` | yes | Replacement document (full document) |
| `upsert` | no | Insert if no match |

### delete-one

Delete the first document matching a filter.

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |
| `filter` | yes | Query filter |

**Output (`result`):** `{"acknowledged": true, "deletedCount": 1}`

### delete-many

Delete all documents matching a filter.

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |
| `filter` | yes | Query filter |

**Output (`result`):** `{"acknowledged": true, "deletedCount": 15}`

## Atomic find-and-modify commands

### find-one-and-update

Atomically find and update a document, returning the document before or
after modification.

| Input | Required | Description |
| ----------------- | -------- | -------------------------------------------- |
| `collection` | yes | Collection |
| `filter` | yes | Query filter |
| `update` | yes | Update operations |
| `projection` | no | Fields to return |
| `sort` | no | Sort (determines which doc if multiple match) |
| `upsert` | no | Insert if no match |
| `return-document` | no | `before` or `after` (default: `after`) |

### find-one-and-replace

Same inputs as `find-one-and-update` but uses `document` instead of
`update`.

### find-one-and-delete

Atomically find and delete, returning the deleted document.

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |
| `filter` | yes | Query filter |
| `projection` | no | Fields to return |
| `sort` | no | Sort |

## Bulk and transaction commands

### bulk-write

Execute mixed insert/update/delete operations on a single collection.

| Input | Required | Description |
| ------------ | -------- | ---------------------------------- |
| `collection` | yes | Collection |
| `operations` | yes | JSON array of operations |
| `ordered` | no | Execute in order (default: `true`) |

Operations format:

```json
[
  {"insertOne": {"document": {"name": "Alice"}}},
  {"updateOne": {"filter": {"name": "Bob"}, "update": {"$set": {"active": true}}}},
  {"deleteOne": {"filter": {"name": "Charlie"}}}
]
```

**Output (`result`):**

```json
{
  "acknowledged": true,
  "insertedCount": 1,
  "matchedCount": 1,
  "modifiedCount": 1,
  "deletedCount": 1
}
```

### transaction

Execute an ACID transaction across multiple collections. Requires a
replica set or Atlas deployment.

| Input | Required | Description |
| ------------ | -------- | -------------------------------- |
| `operations` | yes | JSON array of operations with collection specified |

## Aggregation commands

### aggregate

Run an aggregation pipeline.

| Input | Required | Description |
| ------------ | -------- | -------------------------------- |
| `collection` | yes | Collection |
| `pipeline` | yes | JSON array of pipeline stages |

**Output (`result`):**

```json
[
  {"_id": "payment", "total": 50000, "count": 42},
  {"_id": "refund", "total": 2000, "count": 5}
]
```

## Index commands

### create-index

| Input | Required | Description |
| --------------- | -------- | ------------------------------------------ |
| `collection` | yes | Collection |
| `index` | yes | Index spec (e.g. `{"email": 1}`) |
| `index-options` | no | Options (e.g. `{"unique": true}`) |

### create-indexes

| Input | Required | Description |
| ------------ | -------- | --------------------------------- |
| `collection` | yes | Collection |
| `operations` | yes | JSON array of index specifications |

### drop-index

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |
| `index-name` | yes | Index name |

### drop-indexes

Drop all non-`_id` indexes.

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |

### list-indexes

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |

## Collection and database management commands

### list-collections

List all collections in the database. No additional inputs.

### create-collection

| Input | Required | Description |
| ------------ | -------- | ---------------------------------------------------------------- |
| `collection` | yes | Collection name |
| `options` | no | JSON options (capped, timeseries, validator, etc.) |

### drop-collection

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |

### rename-collection

| Input | Required | Description |
| ------------ | -------- | ------------------- |
| `collection` | yes | Current name |
| `new-name` | yes | New collection name |

### collection-stats

| Input | Required | Description |
| ------------ | -------- | ----------- |
| `collection` | yes | Collection |

### db-stats

Get database statistics. No additional inputs.

### drop-database

Drop the entire database. No additional inputs. Use with caution.

### run-command

Execute an arbitrary database command.

| Input | Required | Description |
| ------------ | -------- | ---------------------------------- |
| `db-command` | yes | Command as JSON |

## Authentication

Pass a MongoDB connection string via the `url` input. The database name
is extracted from the path component.

```
# Atlas
mongodb+srv://user:pass@cluster.mongodb.net/mydb

# Self-hosted
mongodb://user:pass@host:27017/mydb

# Replica set
mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0
```

Transactions require a replica set or Atlas (standalone instances do not
support transactions).

```yaml
with:
  url: ${{ secrets.MONGODB_URL }}
```

## Aggregation workflow example

Insert events, run an aggregation pipeline to compute daily totals,
and create an index for performance.

```yaml
- name: Insert batch of events
  uses: w3/mongodb@v1
  with:
    command: insert-many
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    documents: |
      [
        {"type": "payment", "amount": 500, "date": "2024-01-15"},
        {"type": "payment", "amount": 300, "date": "2024-01-15"},
        {"type": "refund", "amount": 100, "date": "2024-01-15"}
      ]

- name: Create index on type + date
  uses: w3/mongodb@v1
  with:
    command: create-index
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    index: '{"type": 1, "date": 1}'

- name: Aggregate daily totals by type
  id: totals
  uses: w3/mongodb@v1
  with:
    command: aggregate
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    pipeline: |
      [
        {"$match": {"date": "2024-01-15"}},
        {"$group": {
          "_id": "$type",
          "total": {"$sum": "$amount"},
          "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
      ]

- name: Log results
  run: echo '${{ steps.totals.outputs.result }}'
```

## Atomic counter workflow example

Use `find-one-and-update` to implement an atomic counter.

```yaml
- name: Increment and get counter
  id: counter
  uses: w3/mongodb@v1
  with:
    command: find-one-and-update
    url: ${{ secrets.MONGODB_URL }}
    collection: counters
    filter: '{"_id": "invoice_number"}'
    update: '{"$inc": {"seq": 1}}'
    upsert: 'true'
    return-document: after

- name: Use counter value
  run: |
    echo "Next invoice: INV-${{ fromJSON(steps.counter.outputs.result).seq }}"
```

## Error handling

The action fails with a descriptive message on:

- Invalid or unreachable connection string
- Missing required inputs for the command
- MongoDB errors (duplicate key, validation failure, etc.)
- Transaction errors on non-replica-set deployments
- Invalid JSON in filter, document, update, pipeline, or operations
