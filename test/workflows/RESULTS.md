# E2E Test Results

Last verified: 2026-04-15

## Environment

- W3 local network (3-node localnet)
- Protocol: master (includes EIP-712, bridge-allow expansion, nonce manager)
- Runner image: w3io/w3-runner (Node 20/24)

## Prerequisites

- W3 local network running (make dev)
- W3_SECRET_MONGODB_URL set to a MongoDB connection string
  (e.g. mongodb://localhost:27017/w3_e2e_test)

## Results

| Step | Command | Status | Notes |
|------|---------|--------|-------|
| 1 | create-collection | PASS | e2e_test (reads job) |
| 2 | list-collections | PASS | |
| 3 | collection-stats | PASS | e2e_test stats |
| 4 | db-stats | PASS | Database-level stats |
| 5 | run-command | PASS | ping:1 |
| 6 | create-collection | PASS | e2e_test (writes job) |
| 7 | insert-one | PASS | Single document |
| 8 | insert-many | PASS | 3 documents |
| 9 | find-one | PASS | By name filter |
| 10 | find | PASS | Filter + projection + sort + limit |
| 11 | count | PASS | Filtered count |
| 12 | estimated-count | PASS | Estimated document count |
| 13 | distinct | PASS | Distinct role values |
| 14 | update-one | PASS | $set on single doc |
| 15 | update-many | PASS | $set on filtered docs |
| 16 | find-one-and-update | PASS | Return after |
| 17 | replace-one | PASS | Full document replace |
| 18 | find-one-and-replace | PASS | Return after |
| 19 | aggregate | PASS | $group + $sort pipeline |
| 20 | create-index | PASS | Unique index on name |
| 21 | list-indexes | PASS | |
| 22 | drop-index | PASS | Drop name_1 index |
| 23 | bulk-write | PASS | insertOne + updateOne |
| 24 | find-one-and-delete | PASS | Delete Eve |
| 25 | delete-one | PASS | Delete Alice |
| 26 | delete-many | PASS | Delete all remaining |
| 27 | drop-collection | PASS | Cleanup |

## Known Limitations

- None. Full CRUD, aggregation, indexes, bulk write, and collection
  management all pass.
