# E2E Test Results

> Last verified: 2026-04-15

## Prerequisites

| Credential | Env var | Source |
|-----------|---------|--------|
| MongoDB connection string | `MONGODB_URL` | Local Docker or MongoDB Atlas |

## Results

| # | Step | Command | Status | Notes |
|---|------|---------|--------|-------|
| 1 | Create test collection | `create-collection` | PASS | |
| 2 | List collections | `list-collections` | PASS | |
| 3 | Get collection stats | `collection-stats` | PASS | |
| 4 | Get database stats | `db-stats` | PASS | |
| 5 | Run a database command | `run-command` (ping) | PASS | |
| 6 | Create test collection (writes) | `create-collection` | PASS | |
| 7 | Insert one document | `insert-one` | PASS | |
| 8 | Insert many documents | `insert-many` | PASS | |
| 9 | Find one document | `find-one` | PASS | |
| 10 | Find with filter and projection | `find` | PASS | |
| 11 | Count documents | `count` | PASS | |
| 12 | Estimated document count | `estimated-count` | PASS | |
| 13 | Distinct values for role field | `distinct` | PASS | |
| 14 | Update one document | `update-one` | PASS | |
| 15 | Update many documents | `update-many` | PASS | |
| 16 | Find one and update | `find-one-and-update` | PASS | |
| 17 | Replace one document | `replace-one` | PASS | |
| 18 | Find one and replace | `find-one-and-replace` | PASS | |
| 19 | Aggregate by role | `aggregate` | PASS | |
| 20 | Create an index on name | `create-index` | PASS | |
| 21 | List indexes | `list-indexes` | PASS | |
| 22 | Drop the name index | `drop-index` | PASS | |
| 23 | Bulk write operations | `bulk-write` | PASS | |
| 24 | Find one and delete | `find-one-and-delete` | PASS | |
| 25 | Delete one document | `delete-one` | PASS | |
| 26 | Delete many documents | `delete-many` | PASS | |
| 27 | Drop test collection | `drop-collection` | PASS | |

## Skipped Commands

| Command | Reason |
|---------|--------|
| N/A | All commands tested |

## How to run

```bash
# Export credentials
export MONGODB_URL="mongodb://localhost:27017/w3_e2e_test"

# Run
w3 workflow test --execute test/workflows/e2e.yaml
```
