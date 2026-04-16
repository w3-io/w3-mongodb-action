# TODO

## Current state: all commands verified

The action's full surface — find, find-one, insert-one, insert-many,
update-one, update-many, replace-one, delete-one, delete-many,
count-documents, aggregate, distinct, list-collections,
create-collection, drop-collection, create-index, drop-index,
list-indexes, list-databases, database-stats, collection-stats — all
pass against a local MongoDB.

## Potential additions

If workflow demand surfaces, these MongoDB features aren't yet
wrapped:

- [ ] `bulk-write` — execute a mixed batch of insert/update/delete
      operations atomically per-batch. Useful for migration-style
      workflows.
- [ ] Change streams — subscribe to collection changes, stream
      events as they happen. Same "persistent connection" caveat as
      Redis pub/sub; needs thinking about lifecycle in a workflow
      step model.
- [ ] Transactions — multi-document transactions across collections.
      Our action is single-operation today; wrapping transactions
      would require session handling across steps.

## Connection handling

- [ ] The `MONGODB_URL` pattern assumes a single-tenant database.
      For MongoDB Atlas deployments with SRV records
      (`mongodb+srv://...`), verify the driver handles DNS lookups
      correctly in W3's bridge-based container environment.
