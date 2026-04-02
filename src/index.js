import { createCommandRouter, setJsonOutput, handleError } from '@w3-io/action-core'
import * as core from '@actions/core'
import { MongoClient } from 'mongodb'

// -- Shared helpers -----------------------------------------------------------

function getInputs() {
  const url = core.getInput('url', { required: true })
  const collectionName = core.getInput('collection') || ''
  const filterStr = core.getInput('filter') || '{}'
  const documentStr = core.getInput('document') || ''
  const documentsStr = core.getInput('documents') || ''
  const updateStr = core.getInput('update') || ''
  const pipelineStr = core.getInput('pipeline') || ''
  const projectionStr = core.getInput('projection') || ''
  const sortStr = core.getInput('sort') || ''
  const limitStr = core.getInput('limit') || ''
  const skipStr = core.getInput('skip') || ''
  const field = core.getInput('field') || ''
  const indexStr = core.getInput('index') || ''
  const indexOptionsStr = core.getInput('index-options') || ''
  const indexName = core.getInput('index-name') || ''
  const upsert = core.getInput('upsert') === 'true'
  const ordered = core.getInput('ordered') !== 'false'
  const operationsStr = core.getInput('operations') || ''
  const optionsStr = core.getInput('options') || ''
  const newCollectionName = core.getInput('new-name') || ''
  const returnDocument = core.getInput('return-document') || 'after'
  const commandStr = core.getInput('db-command') || ''

  const filter = JSON.parse(filterStr)
  const projection = projectionStr ? JSON.parse(projectionStr) : undefined
  const sort = sortStr ? JSON.parse(sortStr) : undefined
  const limit = limitStr ? parseInt(limitStr, 10) : undefined
  const skip = skipStr ? parseInt(skipStr, 10) : undefined

  return {
    url, collectionName, filter, documentStr, documentsStr, updateStr,
    pipelineStr, projection, sort, limit, skip, field, indexStr,
    indexOptionsStr, indexName, upsert, ordered, operationsStr, optionsStr,
    newCollectionName, returnDocument, commandStr,
  }
}

async function withClient(url, fn) {
  const client = new MongoClient(url, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  })
  try {
    await client.connect()
    return await fn(client)
  } finally {
    await client.close().catch(() => {})
  }
}

// -- Database-level command handler factory -----------------------------------

function dbHandler(fn) {
  return async () => {
    const inputs = getInputs()
    const result = await withClient(inputs.url, async (client) => {
      const db = client.db()
      return fn(db, client, inputs)
    })
    setJsonOutput('result', result)
  }
}

// -- Collection-level command handler factory ---------------------------------

function collHandler(fn) {
  return async () => {
    const inputs = getInputs()
    const result = await withClient(inputs.url, async (client) => {
      const db = client.db()
      if (!inputs.collectionName) {
        throw new Error('Collection name required for this command')
      }
      const collection = db.collection(inputs.collectionName)
      return fn(collection, db, inputs)
    })
    setJsonOutput('result', result)
  }
}

// -- Router -------------------------------------------------------------------

const router = createCommandRouter({
  // -----------------------------------------------------------------
  // Database-level commands
  // -----------------------------------------------------------------

  'list-collections': dbHandler(async (db) => {
    const collections = await db.listCollections().toArray()
    return collections.map((c) => ({
      name: c.name,
      type: c.type,
      options: c.options,
    }))
  }),

  'create-collection': dbHandler(async (db, _client, inputs) => {
    if (!inputs.collectionName)
      throw new Error('collection is required for create-collection')
    const options = inputs.optionsStr ? JSON.parse(inputs.optionsStr) : {}
    await db.createCollection(inputs.collectionName, options)
    return { created: inputs.collectionName }
  }),

  'drop-collection': dbHandler(async (db, _client, inputs) => {
    if (!inputs.collectionName)
      throw new Error('collection is required for drop-collection')
    const dropped = await db.collection(inputs.collectionName).drop().catch((e) => {
      if (e.codeName === 'NamespaceNotFound') return false
      throw e
    })
    return { dropped }
  }),

  'rename-collection': dbHandler(async (db, _client, inputs) => {
    if (!inputs.collectionName)
      throw new Error('collection is required for rename-collection')
    if (!inputs.newCollectionName)
      throw new Error('new-name is required for rename-collection')
    await db.collection(inputs.collectionName).rename(inputs.newCollectionName)
    return { from: inputs.collectionName, to: inputs.newCollectionName }
  }),

  'db-stats': dbHandler(async (db) => {
    return db.stats()
  }),

  'run-command': dbHandler(async (db, _client, inputs) => {
    if (!inputs.commandStr) throw new Error('db-command is required for run-command')
    const dbCommand = JSON.parse(inputs.commandStr)
    return db.command(dbCommand)
  }),

  'drop-database': dbHandler(async (db) => {
    const dropResult = await db.dropDatabase()
    return { dropped: dropResult }
  }),

  transaction: dbHandler(async (db, client, inputs) => {
    if (!inputs.operationsStr)
      throw new Error('operations is required for transaction')
    const txOps = JSON.parse(inputs.operationsStr)
    if (!Array.isArray(txOps))
      throw new Error('operations must be a JSON array')

    const session = client.startSession()
    const txResults = []
    try {
      await session.withTransaction(async () => {
        for (const op of txOps) {
          if (!op.collection)
            throw new Error('Each transaction operation must specify a collection')
          if (!op.op) throw new Error('Each transaction operation must specify an op')
          const coll = db.collection(op.collection)

          switch (op.op) {
            case 'insertOne': {
              if (!op.document) throw new Error('insertOne requires document')
              const r = await coll.insertOne(op.document, { session })
              txResults.push({
                op: 'insertOne',
                collection: op.collection,
                insertedId: r.insertedId.toString(),
              })
              break
            }

            case 'insertMany': {
              if (!op.documents || !Array.isArray(op.documents))
                throw new Error('insertMany requires documents array')
              const r = await coll.insertMany(op.documents, {
                session,
                ordered: op.ordered !== false,
              })
              txResults.push({
                op: 'insertMany',
                collection: op.collection,
                insertedCount: r.insertedCount,
              })
              break
            }

            case 'updateOne': {
              if (!op.filter || !op.update)
                throw new Error('updateOne requires filter and update')
              const r = await coll.updateOne(op.filter, op.update, {
                session,
                upsert: op.upsert === true,
              })
              txResults.push({
                op: 'updateOne',
                collection: op.collection,
                matchedCount: r.matchedCount,
                modifiedCount: r.modifiedCount,
                upsertedId: r.upsertedId?.toString() || null,
              })
              break
            }

            case 'updateMany': {
              if (!op.filter || !op.update)
                throw new Error('updateMany requires filter and update')
              const r = await coll.updateMany(op.filter, op.update, {
                session,
                upsert: op.upsert === true,
              })
              txResults.push({
                op: 'updateMany',
                collection: op.collection,
                matchedCount: r.matchedCount,
                modifiedCount: r.modifiedCount,
                upsertedId: r.upsertedId?.toString() || null,
              })
              break
            }

            case 'replaceOne': {
              if (!op.filter || !op.document)
                throw new Error('replaceOne requires filter and document')
              const r = await coll.replaceOne(op.filter, op.document, {
                session,
                upsert: op.upsert === true,
              })
              txResults.push({
                op: 'replaceOne',
                collection: op.collection,
                matchedCount: r.matchedCount,
                modifiedCount: r.modifiedCount,
                upsertedId: r.upsertedId?.toString() || null,
              })
              break
            }

            case 'deleteOne': {
              if (!op.filter) throw new Error('deleteOne requires filter')
              const r = await coll.deleteOne(op.filter, { session })
              txResults.push({
                op: 'deleteOne',
                collection: op.collection,
                deletedCount: r.deletedCount,
              })
              break
            }

            case 'deleteMany': {
              if (!op.filter) throw new Error('deleteMany requires filter')
              const r = await coll.deleteMany(op.filter, { session })
              txResults.push({
                op: 'deleteMany',
                collection: op.collection,
                deletedCount: r.deletedCount,
              })
              break
            }

            case 'findOne': {
              const opts = { session }
              if (op.projection) opts.projection = op.projection
              const doc = await coll.findOne(op.filter || {}, opts)
              txResults.push({
                op: 'findOne',
                collection: op.collection,
                document: doc,
              })
              break
            }

            case 'findOneAndUpdate': {
              if (!op.filter || !op.update)
                throw new Error('findOneAndUpdate requires filter and update')
              const opts = {
                session,
                upsert: op.upsert === true,
                returnDocument: op.returnDocument === 'before' ? 'before' : 'after',
              }
              if (op.projection) opts.projection = op.projection
              if (op.sort) opts.sort = op.sort
              const doc = await coll.findOneAndUpdate(op.filter, op.update, opts)
              txResults.push({
                op: 'findOneAndUpdate',
                collection: op.collection,
                document: doc,
              })
              break
            }

            case 'findOneAndDelete': {
              const opts = { session }
              if (op.projection) opts.projection = op.projection
              if (op.sort) opts.sort = op.sort
              const doc = await coll.findOneAndDelete(op.filter || {}, opts)
              txResults.push({
                op: 'findOneAndDelete',
                collection: op.collection,
                document: doc,
              })
              break
            }

            default:
              throw new Error(
                `Unknown transaction op: ${op.op}. Available: insertOne, insertMany, updateOne, updateMany, replaceOne, deleteOne, deleteMany, findOne, findOneAndUpdate, findOneAndDelete`,
              )
          }
        }
      })

      return { committed: true, operations: txResults }
    } catch (txError) {
      setJsonOutput('result', { committed: false, error: txError.message })
      throw txError
    } finally {
      await session.endSession()
    }
  }),

  // -----------------------------------------------------------------
  // Read operations
  // -----------------------------------------------------------------

  'find-one': collHandler(async (collection, _db, inputs) => {
    const options = {}
    if (inputs.projection) options.projection = inputs.projection
    return collection.findOne(inputs.filter, options)
  }),

  find: collHandler(async (collection, _db, inputs) => {
    let cursor = collection.find(inputs.filter)
    if (inputs.projection) cursor = cursor.project(inputs.projection)
    if (inputs.sort) cursor = cursor.sort(inputs.sort)
    if (inputs.skip) cursor = cursor.skip(inputs.skip)
    if (inputs.limit) cursor = cursor.limit(inputs.limit)
    return cursor.toArray()
  }),

  count: collHandler(async (collection, _db, inputs) => {
    return collection.countDocuments(inputs.filter)
  }),

  'estimated-count': collHandler(async (collection) => {
    return collection.estimatedDocumentCount()
  }),

  distinct: collHandler(async (collection, _db, inputs) => {
    if (!inputs.field) throw new Error('field is required for distinct')
    return collection.distinct(inputs.field, inputs.filter)
  }),

  // -----------------------------------------------------------------
  // Write operations
  // -----------------------------------------------------------------

  'insert-one': collHandler(async (collection, _db, inputs) => {
    if (!inputs.documentStr)
      throw new Error('document is required for insert-one')
    const doc = JSON.parse(inputs.documentStr)
    const insertResult = await collection.insertOne(doc)
    return { insertedId: insertResult.insertedId.toString() }
  }),

  'insert-many': collHandler(async (collection, _db, inputs) => {
    if (!inputs.documentsStr)
      throw new Error('documents is required for insert-many')
    const docs = JSON.parse(inputs.documentsStr)
    if (!Array.isArray(docs))
      throw new Error('documents must be a JSON array')
    const insertResult = await collection.insertMany(docs, { ordered: inputs.ordered })
    return {
      insertedCount: insertResult.insertedCount,
      insertedIds: Object.fromEntries(
        Object.entries(insertResult.insertedIds).map(([k, v]) => [k, v.toString()]),
      ),
    }
  }),

  'update-one': collHandler(async (collection, _db, inputs) => {
    if (!inputs.updateStr) throw new Error('update is required for update-one')
    const updateDoc = JSON.parse(inputs.updateStr)
    const updateResult = await collection.updateOne(inputs.filter, updateDoc, {
      upsert: inputs.upsert,
    })
    return {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      upsertedId: updateResult.upsertedId?.toString() || null,
    }
  }),

  'update-many': collHandler(async (collection, _db, inputs) => {
    if (!inputs.updateStr) throw new Error('update is required for update-many')
    const updateDoc = JSON.parse(inputs.updateStr)
    const updateResult = await collection.updateMany(inputs.filter, updateDoc, {
      upsert: inputs.upsert,
    })
    return {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      upsertedId: updateResult.upsertedId?.toString() || null,
    }
  }),

  'replace-one': collHandler(async (collection, _db, inputs) => {
    if (!inputs.documentStr)
      throw new Error('document is required for replace-one')
    const replacement = JSON.parse(inputs.documentStr)
    const replaceResult = await collection.replaceOne(inputs.filter, replacement, {
      upsert: inputs.upsert,
    })
    return {
      matchedCount: replaceResult.matchedCount,
      modifiedCount: replaceResult.modifiedCount,
      upsertedId: replaceResult.upsertedId?.toString() || null,
    }
  }),

  'delete-one': collHandler(async (collection, _db, inputs) => {
    const deleteResult = await collection.deleteOne(inputs.filter)
    return { deletedCount: deleteResult.deletedCount }
  }),

  'delete-many': collHandler(async (collection, _db, inputs) => {
    const deleteResult = await collection.deleteMany(inputs.filter)
    return { deletedCount: deleteResult.deletedCount }
  }),

  // -----------------------------------------------------------------
  // Atomic find-and-modify operations
  // -----------------------------------------------------------------

  'find-one-and-update': collHandler(async (collection, _db, inputs) => {
    if (!inputs.updateStr)
      throw new Error('update is required for find-one-and-update')
    const updateDoc = JSON.parse(inputs.updateStr)
    const options = {
      upsert: inputs.upsert,
      returnDocument: inputs.returnDocument === 'before' ? 'before' : 'after',
    }
    if (inputs.projection) options.projection = inputs.projection
    if (inputs.sort) options.sort = inputs.sort
    return collection.findOneAndUpdate(inputs.filter, updateDoc, options)
  }),

  'find-one-and-replace': collHandler(async (collection, _db, inputs) => {
    if (!inputs.documentStr)
      throw new Error('document is required for find-one-and-replace')
    const replacement = JSON.parse(inputs.documentStr)
    const options = {
      upsert: inputs.upsert,
      returnDocument: inputs.returnDocument === 'before' ? 'before' : 'after',
    }
    if (inputs.projection) options.projection = inputs.projection
    if (inputs.sort) options.sort = inputs.sort
    return collection.findOneAndReplace(inputs.filter, replacement, options)
  }),

  'find-one-and-delete': collHandler(async (collection, _db, inputs) => {
    const options = {}
    if (inputs.projection) options.projection = inputs.projection
    if (inputs.sort) options.sort = inputs.sort
    return collection.findOneAndDelete(inputs.filter, options)
  }),

  // -----------------------------------------------------------------
  // Bulk operations
  // -----------------------------------------------------------------

  'bulk-write': collHandler(async (collection, _db, inputs) => {
    if (!inputs.operationsStr)
      throw new Error('operations is required for bulk-write')
    const ops = JSON.parse(inputs.operationsStr)
    if (!Array.isArray(ops))
      throw new Error('operations must be a JSON array')
    const bulkResult = await collection.bulkWrite(ops, { ordered: inputs.ordered })
    return {
      insertedCount: bulkResult.insertedCount,
      matchedCount: bulkResult.matchedCount,
      modifiedCount: bulkResult.modifiedCount,
      deletedCount: bulkResult.deletedCount,
      upsertedCount: bulkResult.upsertedCount,
      upsertedIds: bulkResult.upsertedIds
        ? Object.fromEntries(
            Object.entries(bulkResult.upsertedIds).map(([k, v]) => [k, v.toString()]),
          )
        : {},
    }
  }),

  // -----------------------------------------------------------------
  // Aggregation
  // -----------------------------------------------------------------

  aggregate: collHandler(async (collection, _db, inputs) => {
    if (!inputs.pipelineStr)
      throw new Error('pipeline is required for aggregate')
    const pipeline = JSON.parse(inputs.pipelineStr)
    if (!Array.isArray(pipeline))
      throw new Error('pipeline must be a JSON array')
    return collection.aggregate(pipeline).toArray()
  }),

  // -----------------------------------------------------------------
  // Index operations
  // -----------------------------------------------------------------

  'create-index': collHandler(async (collection, _db, inputs) => {
    if (!inputs.indexStr) throw new Error('index is required for create-index')
    const indexSpec = JSON.parse(inputs.indexStr)
    const options = inputs.indexOptionsStr ? JSON.parse(inputs.indexOptionsStr) : {}
    return collection.createIndex(indexSpec, options)
  }),

  'create-indexes': collHandler(async (collection, _db, inputs) => {
    if (!inputs.operationsStr)
      throw new Error('operations is required for create-indexes')
    const indexSpecs = JSON.parse(inputs.operationsStr)
    if (!Array.isArray(indexSpecs))
      throw new Error('operations must be a JSON array of index specs')
    return collection.createIndexes(indexSpecs)
  }),

  'drop-index': collHandler(async (collection, _db, inputs) => {
    if (!inputs.indexName)
      throw new Error('index-name is required for drop-index')
    await collection.dropIndex(inputs.indexName)
    return { dropped: inputs.indexName }
  }),

  'drop-indexes': collHandler(async (collection) => {
    await collection.dropIndexes()
    return { dropped: 'all non-_id indexes' }
  }),

  'list-indexes': collHandler(async (collection) => {
    return collection.listIndexes().toArray()
  }),

  // -----------------------------------------------------------------
  // Collection info
  // -----------------------------------------------------------------

  'collection-stats': collHandler(async (collection, db, inputs) => {
    const stats = await db.command({ collStats: inputs.collectionName })
    return {
      count: stats.count,
      size: stats.size,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize,
      totalIndexSize: stats.totalIndexSize,
      indexSizes: stats.indexSizes,
    }
  }),
})

router()
