# W3 MongoDB Action

MongoDB document store, queries, aggregations, and indexes for W3 workflows.

## Commands

| Command | Description |
|---------|-------------|
| `find-one` | Find a single document |
| `find` | Find multiple documents |
| `insert-one` | Insert a document |
| `insert-many` | Insert multiple documents |
| `update-one` | Update a single document |
| `update-many` | Update multiple documents |
| `replace-one` | Replace a single document |
| `delete-one` | Delete a single document |
| `delete-many` | Delete multiple documents |
| `count` | Count matching documents |
| `distinct` | Get distinct values for a field |
| `aggregate` | Run an aggregation pipeline |
| `create-index` | Create an index |
| `drop-index` | Drop an index |
| `list-indexes` | List indexes on a collection |
| `list-collections` | List all collections in the database |

## Usage

```yaml
- uses: w3/mongodb@v1
  with:
    command: insert-one
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    document: '{"type": "payment", "amount": 100, "ts": "${{ steps.now.outputs.result }}"}'

- uses: w3/mongodb@v1
  with:
    command: find
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    filter: '{"type": "payment"}'
    sort: '{"ts": -1}'
    limit: '10'

- uses: w3/mongodb@v1
  with:
    command: aggregate
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    pipeline: '[{"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}]'

- uses: w3/mongodb@v1
  with:
    command: update-one
    url: ${{ secrets.MONGODB_URL }}
    collection: users
    filter: '{"email": "alice@example.com"}'
    update: '{"$set": {"lastLogin": "${{ steps.now.outputs.result }}"}}'
    upsert: 'true'

- uses: w3/mongodb@v1
  with:
    command: create-index
    url: ${{ secrets.MONGODB_URL }}
    collection: events
    index: '{"type": 1, "ts": -1}'
    index-options: '{"name": "type_ts_idx"}'
```

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Operation to perform |
| `url` | Yes | MongoDB connection string |
| `collection` | No | Collection name (required for all except `list-collections`) |
| `filter` | No | Query filter as JSON (default: `{}`) |
| `document` | No | Document as JSON (for insert-one, replace-one) |
| `documents` | No | Array of documents as JSON (for insert-many) |
| `update` | No | Update operations as JSON (for update-one, update-many) |
| `pipeline` | No | Aggregation pipeline as JSON array |
| `projection` | No | Fields to include/exclude as JSON |
| `sort` | No | Sort specification as JSON |
| `limit` | No | Max documents to return |
| `skip` | No | Documents to skip |
| `field` | No | Field name (for distinct, create-index) |
| `index` | No | Index specification as JSON |
| `index-options` | No | Index options as JSON |
| `index-name` | No | Index name (for drop-index) |
| `upsert` | No | Insert if no match (default: `false`) |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | Command result as JSON string |

## Connection

Supports both Atlas and self-hosted:

```
# Atlas
mongodb+srv://user:pass@cluster.mongodb.net/mydb

# Self-hosted
mongodb://user:pass@host:27017/mydb
```

The database name is extracted from the connection string.
