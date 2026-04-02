# W3 MongoDB Action

Complete MongoDB API for W3 workflows: documents, queries, aggregations, atomic operations, ACID transactions, bulk writes, indexes, and collection management.

## Quick Start

```yaml
- uses: w3/mongodb@v1
  with:
    command: insert-one
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    document: '{"type": "payment", "amount": 100}'

- uses: w3/mongodb@v1
  id: results
  with:
    command: find
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    filter: '{"type": "payment"}'
    sort: '{"amount": -1}'
    limit: '10'
```

## Commands

### Read

| Command | Description |
|---------|-------------|
| `find-one` | Find a single document matching a filter |
| `find` | Find multiple documents with filter, sort, skip, limit, projection |
| `count` | Count documents matching a filter |
| `estimated-count` | Fast approximate count using collection metadata |
| `distinct` | Get distinct values for a field |

### Write

| Command | Description |
|---------|-------------|
| `insert-one` | Insert a single document |
| `insert-many` | Insert multiple documents (ordered or unordered) |
| `update-one` | Update the first document matching a filter |
| `update-many` | Update all documents matching a filter |
| `replace-one` | Replace a document entirely |
| `delete-one` | Delete the first document matching a filter |
| `delete-many` | Delete all documents matching a filter |

### Atomic Find-and-Modify

| Command | Description |
|---------|-------------|
| `find-one-and-update` | Atomically find and update, return the document |
| `find-one-and-replace` | Atomically find and replace, return the document |
| `find-one-and-delete` | Atomically find and delete, return the document |

### Bulk and Transactions

| Command | Description |
|---------|-------------|
| `bulk-write` | Execute mixed operations on a single collection |
| `transaction` | ACID transaction across multiple collections (requires replica set) |

### Aggregation

| Command | Description |
|---------|-------------|
| `aggregate` | Run an aggregation pipeline |

### Indexes

| Command | Description |
|---------|-------------|
| `create-index` | Create a single index |
| `create-indexes` | Create multiple indexes at once |
| `drop-index` | Drop a named index |
| `drop-indexes` | Drop all non-_id indexes |
| `list-indexes` | List all indexes on a collection |

### Collection and Database Management

| Command | Description |
|---------|-------------|
| `list-collections` | List all collections in the database |
| `create-collection` | Create a collection (with optional schema validation, capped, timeseries) |
| `drop-collection` | Drop a collection |
| `rename-collection` | Rename a collection |
| `collection-stats` | Get collection statistics (count, size, index info) |
| `db-stats` | Get database statistics |
| `drop-database` | Drop the entire database |
| `run-command` | Execute an arbitrary database command |

## Inputs

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `command` | Yes | | Operation to perform (31 commands) |
| `url` | Yes | | MongoDB connection string |
| `collection` | No | | Collection name |
| `filter` | No | `{}` | Query filter as JSON |
| `document` | No | | Document as JSON |
| `documents` | No | | Array of documents as JSON |
| `update` | No | | Update operations as JSON |
| `pipeline` | No | | Aggregation pipeline as JSON array |
| `projection` | No | | Fields to include/exclude as JSON |
| `sort` | No | | Sort specification as JSON |
| `limit` | No | | Max documents to return |
| `skip` | No | | Documents to skip |
| `field` | No | | Field name (for distinct) |
| `index` | No | | Index specification as JSON |
| `index-options` | No | | Index options as JSON (e.g. `{"unique": true}`) |
| `index-name` | No | | Index name (for drop-index) |
| `upsert` | No | `false` | Insert if no match found |
| `ordered` | No | `true` | Execute operations in order |
| `operations` | No | | Array of operations as JSON (for bulk-write, create-indexes) |
| `options` | No | | Collection options as JSON (for create-collection) |
| `new-name` | No | | New collection name (for rename-collection) |
| `return-document` | No | `after` | Return document `before` or `after` modification |
| `db-command` | No | | Arbitrary database command as JSON |

## Outputs

| Name | Description |
|------|-------------|
| `result` | Command result as JSON string |

## Authentication

Pass a MongoDB connection string via the `url` input. Supports Atlas, self-hosted, and replica sets:

```
# Atlas
mongodb+srv://user:pass@cluster.mongodb.net/mydb

# Self-hosted
mongodb://user:pass@host:27017/mydb

# Replica set
mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0
```

The database name is extracted from the connection string. Transactions require a replica set or Atlas (standalone instances do not support transactions).
