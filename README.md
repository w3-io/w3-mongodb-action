# W3 MongoDB Action

Complete MongoDB API for W3 workflows. 30 commands covering documents, queries, aggregations, atomic operations, ACID transactions, bulk writes, indexes, and collection management.

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

### Bulk & Transactions

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

### Collection & Database Management

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

## Usage

### Basic CRUD

```yaml
# Insert
- uses: w3/mongodb@v1
  with:
    command: insert-one
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    document: '{"type": "payment", "amount": 100}'

# Find with sort and limit
- uses: w3/mongodb@v1
  with:
    command: find
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    filter: '{"type": "payment"}'
    sort: '{"amount": -1}'
    limit: '10'
    projection: '{"type": 1, "amount": 1, "_id": 0}'

# Update with upsert
- uses: w3/mongodb@v1
  with:
    command: update-one
    url: ${{ secrets.MONGODB_URL }}
    collection: users
    filter: '{"email": "alice@example.com"}'
    update: '{"$set": {"lastLogin": "2026-04-01"}, "$inc": {"loginCount": 1}}'
    upsert: 'true'
```

### Atomic Operations

```yaml
# Atomically dequeue the next pending job
- uses: w3/mongodb@v1
  with:
    command: find-one-and-update
    url: ${{ secrets.MONGODB_URL }}
    collection: jobs
    filter: '{"status": "pending"}'
    update: '{"$set": {"status": "processing", "worker": "node-1"}}'
    sort: '{"priority": -1, "createdAt": 1}'
    return-document: after
```

### Bulk Write

```yaml
- uses: w3/mongodb@v1
  with:
    command: bulk-write
    url: ${{ secrets.MONGODB_URL }}
    collection: inventory
    operations: |
      [
        {"insertOne": {"document": {"sku": "A1", "qty": 100}}},
        {"updateOne": {"filter": {"sku": "B2"}, "update": {"$inc": {"qty": -5}}}},
        {"deleteOne": {"filter": {"sku": "C3", "qty": 0}}}
      ]
    ordered: 'false'
```

### Transactions

```yaml
# Transfer funds between accounts atomically
- uses: w3/mongodb@v1
  with:
    command: transaction
    url: ${{ secrets.MONGODB_URL }}
    operations: |
      [
        {
          "collection": "accounts",
          "op": "updateOne",
          "filter": {"_id": "alice"},
          "update": {"$inc": {"balance": -100}}
        },
        {
          "collection": "accounts",
          "op": "updateOne",
          "filter": {"_id": "bob"},
          "update": {"$inc": {"balance": 100}}
        },
        {
          "collection": "ledger",
          "op": "insertOne",
          "document": {"from": "alice", "to": "bob", "amount": 100, "ts": "2026-04-01"}
        }
      ]

# Transaction with reads and conditional writes
- uses: w3/mongodb@v1
  with:
    command: transaction
    url: ${{ secrets.MONGODB_URL }}
    operations: |
      [
        {
          "collection": "inventory",
          "op": "findOneAndUpdate",
          "filter": {"sku": "ABC", "qty": {"$gte": 5}},
          "update": {"$inc": {"qty": -5}},
          "returnDocument": "after"
        },
        {
          "collection": "orders",
          "op": "insertOne",
          "document": {"sku": "ABC", "qty": 5, "status": "placed"}
        }
      ]
```

Transactions support: `insertOne`, `insertMany`, `updateOne`, `updateMany`, `replaceOne`, `deleteOne`, `deleteMany`, `findOne`, `findOneAndUpdate`, `findOneAndDelete`. Requires a replica set or Atlas (standalone instances don't support transactions).

### Aggregation

```yaml
- uses: w3/mongodb@v1
  with:
    command: aggregate
    url: ${{ secrets.MONGODB_URL }}
    collection: orders
    pipeline: |
      [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$product", "revenue": {"$sum": "$total"}}},
        {"$sort": {"revenue": -1}},
        {"$limit": 10}
      ]
```

### Indexes

```yaml
# Create a compound index
- uses: w3/mongodb@v1
  with:
    command: create-index
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    index: '{"type": 1, "createdAt": -1}'
    index-options: '{"name": "type_date_idx", "background": true}'

# Create multiple indexes at once
- uses: w3/mongodb@v1
  with:
    command: create-indexes
    url: ${{ secrets.MONGODB_URL }}
    collection: users
    operations: |
      [
        {"key": {"email": 1}, "unique": true},
        {"key": {"createdAt": -1}, "expireAfterSeconds": 2592000}
      ]
```

### Collection Management

```yaml
# Create a capped collection
- uses: w3/mongodb@v1
  with:
    command: create-collection
    url: ${{ secrets.MONGODB_URL }}
    collection: logs
    options: '{"capped": true, "size": 104857600, "max": 100000}'

# Create a timeseries collection
- uses: w3/mongodb@v1
  with:
    command: create-collection
    url: ${{ secrets.MONGODB_URL }}
    collection: metrics
    options: '{"timeseries": {"timeField": "ts", "metaField": "source", "granularity": "minutes"}}'

# Run an arbitrary command
- uses: w3/mongodb@v1
  with:
    command: run-command
    url: ${{ secrets.MONGODB_URL }}
    db-command: '{"ping": 1}'
```

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Operation to perform (28 commands) |
| `url` | Yes | MongoDB connection string |
| `collection` | No | Collection name |
| `filter` | No | Query filter as JSON (default: `{}`) |
| `document` | No | Document as JSON |
| `documents` | No | Array of documents as JSON |
| `update` | No | Update operations as JSON |
| `pipeline` | No | Aggregation pipeline as JSON array |
| `projection` | No | Fields to include/exclude as JSON |
| `sort` | No | Sort specification as JSON |
| `limit` | No | Max documents to return |
| `skip` | No | Documents to skip |
| `field` | No | Field name (for distinct) |
| `index` | No | Index specification as JSON |
| `index-options` | No | Index options as JSON |
| `index-name` | No | Index name (for drop-index) |
| `upsert` | No | Insert if no match (default: `false`) |
| `ordered` | No | Execute in order (default: `true`) |
| `operations` | No | Array of operations as JSON (for bulk-write, create-indexes) |
| `options` | No | Collection options as JSON (for create-collection) |
| `new-name` | No | New name (for rename-collection) |
| `return-document` | No | Return `before` or `after` modification (default: `after`) |
| `db-command` | No | Arbitrary database command as JSON |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | Command result as JSON string |

## Connection

Supports Atlas, self-hosted, and replica sets:

```
# Atlas
mongodb+srv://user:pass@cluster.mongodb.net/mydb

# Self-hosted
mongodb://user:pass@host:27017/mydb

# Replica set
mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0
```

The database name is extracted from the connection string.
