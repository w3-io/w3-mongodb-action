const core = require("@actions/core");
const { MongoClient } = require("mongodb");

async function run() {
  let client;
  try {
    const command = core.getInput("command", { required: true }).toLowerCase();
    const url = core.getInput("url", { required: true });
    const collectionName = core.getInput("collection") || "";
    const filterStr = core.getInput("filter") || "{}";
    const documentStr = core.getInput("document") || "";
    const documentsStr = core.getInput("documents") || "";
    const updateStr = core.getInput("update") || "";
    const pipelineStr = core.getInput("pipeline") || "";
    const projectionStr = core.getInput("projection") || "";
    const sortStr = core.getInput("sort") || "";
    const limitStr = core.getInput("limit") || "";
    const skipStr = core.getInput("skip") || "";
    const field = core.getInput("field") || "";
    const indexStr = core.getInput("index") || "";
    const indexOptionsStr = core.getInput("index-options") || "";
    const indexName = core.getInput("index-name") || "";
    const upsert = core.getInput("upsert") === "true";
    const ordered = core.getInput("ordered") !== "false"; // default true
    const operationsStr = core.getInput("operations") || "";
    const optionsStr = core.getInput("options") || "";
    const newCollectionName = core.getInput("new-name") || "";
    const returnDocument = core.getInput("return-document") || "after";
    const commandStr = core.getInput("db-command") || "";

    // Parse JSON inputs
    const filter = JSON.parse(filterStr);
    const projection = projectionStr ? JSON.parse(projectionStr) : undefined;
    const sort = sortStr ? JSON.parse(sortStr) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const skip = skipStr ? parseInt(skipStr, 10) : undefined;

    // Connect
    client = new MongoClient(url, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    await client.connect();

    const db = client.db();

    // --- Database-level commands (no collection needed) ---

    if (command === "list-collections") {
      const collections = await db.listCollections().toArray();
      const result = collections.map((c) => ({
        name: c.name,
        type: c.type,
        options: c.options,
      }));
      core.setOutput("result", JSON.stringify(result));
      return;
    }

    if (command === "create-collection") {
      if (!collectionName)
        throw new Error("collection is required for create-collection");
      const options = optionsStr ? JSON.parse(optionsStr) : {};
      await db.createCollection(collectionName, options);
      core.setOutput("result", JSON.stringify({ created: collectionName }));
      return;
    }

    if (command === "drop-collection") {
      if (!collectionName)
        throw new Error("collection is required for drop-collection");
      const dropped = await db.collection(collectionName).drop().catch((e) => {
        if (e.codeName === "NamespaceNotFound") return false;
        throw e;
      });
      core.setOutput("result", JSON.stringify({ dropped }));
      return;
    }

    if (command === "rename-collection") {
      if (!collectionName)
        throw new Error("collection is required for rename-collection");
      if (!newCollectionName)
        throw new Error("new-name is required for rename-collection");
      await db.collection(collectionName).rename(newCollectionName);
      core.setOutput(
        "result",
        JSON.stringify({ from: collectionName, to: newCollectionName }),
      );
      return;
    }

    if (command === "db-stats") {
      const stats = await db.stats();
      core.setOutput("result", JSON.stringify(stats));
      return;
    }

    if (command === "run-command") {
      if (!commandStr) throw new Error("db-command is required for run-command");
      const dbCommand = JSON.parse(commandStr);
      const commandResult = await db.command(dbCommand);
      core.setOutput("result", JSON.stringify(commandResult));
      return;
    }

    if (command === "drop-database") {
      const dropResult = await db.dropDatabase();
      core.setOutput("result", JSON.stringify({ dropped: dropResult }));
      return;
    }

    if (command === "transaction") {
      if (!operationsStr)
        throw new Error("operations is required for transaction");
      const txOps = JSON.parse(operationsStr);
      if (!Array.isArray(txOps))
        throw new Error("operations must be a JSON array");

      const session = client.startSession();
      const txResults = [];
      try {
        await session.withTransaction(async () => {
          for (const op of txOps) {
            if (!op.collection)
              throw new Error(
                "Each transaction operation must specify a collection",
              );
            if (!op.op) throw new Error("Each transaction operation must specify an op");
            const coll = db.collection(op.collection);

            switch (op.op) {
              case "insertOne": {
                if (!op.document)
                  throw new Error("insertOne requires document");
                const r = await coll.insertOne(op.document, { session });
                txResults.push({
                  op: "insertOne",
                  collection: op.collection,
                  insertedId: r.insertedId.toString(),
                });
                break;
              }

              case "insertMany": {
                if (!op.documents || !Array.isArray(op.documents))
                  throw new Error("insertMany requires documents array");
                const r = await coll.insertMany(op.documents, {
                  session,
                  ordered: op.ordered !== false,
                });
                txResults.push({
                  op: "insertMany",
                  collection: op.collection,
                  insertedCount: r.insertedCount,
                });
                break;
              }

              case "updateOne": {
                if (!op.filter || !op.update)
                  throw new Error("updateOne requires filter and update");
                const r = await coll.updateOne(op.filter, op.update, {
                  session,
                  upsert: op.upsert === true,
                });
                txResults.push({
                  op: "updateOne",
                  collection: op.collection,
                  matchedCount: r.matchedCount,
                  modifiedCount: r.modifiedCount,
                  upsertedId: r.upsertedId?.toString() || null,
                });
                break;
              }

              case "updateMany": {
                if (!op.filter || !op.update)
                  throw new Error("updateMany requires filter and update");
                const r = await coll.updateMany(op.filter, op.update, {
                  session,
                  upsert: op.upsert === true,
                });
                txResults.push({
                  op: "updateMany",
                  collection: op.collection,
                  matchedCount: r.matchedCount,
                  modifiedCount: r.modifiedCount,
                  upsertedId: r.upsertedId?.toString() || null,
                });
                break;
              }

              case "replaceOne": {
                if (!op.filter || !op.document)
                  throw new Error("replaceOne requires filter and document");
                const r = await coll.replaceOne(op.filter, op.document, {
                  session,
                  upsert: op.upsert === true,
                });
                txResults.push({
                  op: "replaceOne",
                  collection: op.collection,
                  matchedCount: r.matchedCount,
                  modifiedCount: r.modifiedCount,
                  upsertedId: r.upsertedId?.toString() || null,
                });
                break;
              }

              case "deleteOne": {
                if (!op.filter)
                  throw new Error("deleteOne requires filter");
                const r = await coll.deleteOne(op.filter, { session });
                txResults.push({
                  op: "deleteOne",
                  collection: op.collection,
                  deletedCount: r.deletedCount,
                });
                break;
              }

              case "deleteMany": {
                if (!op.filter)
                  throw new Error("deleteMany requires filter");
                const r = await coll.deleteMany(op.filter, { session });
                txResults.push({
                  op: "deleteMany",
                  collection: op.collection,
                  deletedCount: r.deletedCount,
                });
                break;
              }

              case "findOne": {
                const opts = { session };
                if (op.projection) opts.projection = op.projection;
                const doc = await coll.findOne(op.filter || {}, opts);
                txResults.push({
                  op: "findOne",
                  collection: op.collection,
                  document: doc,
                });
                break;
              }

              case "findOneAndUpdate": {
                if (!op.filter || !op.update)
                  throw new Error(
                    "findOneAndUpdate requires filter and update",
                  );
                const opts = {
                  session,
                  upsert: op.upsert === true,
                  returnDocument:
                    op.returnDocument === "before" ? "before" : "after",
                };
                if (op.projection) opts.projection = op.projection;
                if (op.sort) opts.sort = op.sort;
                const doc = await coll.findOneAndUpdate(
                  op.filter,
                  op.update,
                  opts,
                );
                txResults.push({
                  op: "findOneAndUpdate",
                  collection: op.collection,
                  document: doc,
                });
                break;
              }

              case "findOneAndDelete": {
                const opts = { session };
                if (op.projection) opts.projection = op.projection;
                if (op.sort) opts.sort = op.sort;
                const doc = await coll.findOneAndDelete(
                  op.filter || {},
                  opts,
                );
                txResults.push({
                  op: "findOneAndDelete",
                  collection: op.collection,
                  document: doc,
                });
                break;
              }

              default:
                throw new Error(
                  `Unknown transaction op: ${op.op}. Available: insertOne, insertMany, updateOne, updateMany, replaceOne, deleteOne, deleteMany, findOne, findOneAndUpdate, findOneAndDelete`,
                );
            }
          }
        });

        core.setOutput(
          "result",
          JSON.stringify({ committed: true, operations: txResults }),
        );
      } catch (txError) {
        core.setOutput(
          "result",
          JSON.stringify({ committed: false, error: txError.message }),
        );
        throw txError;
      } finally {
        await session.endSession();
      }
      return;
    }

    // --- Collection-level commands ---

    if (!collectionName) {
      throw new Error(`Collection name required for command: ${command}`);
    }
    const collection = db.collection(collectionName);

    let result;

    switch (command) {
      // -----------------------------------------------------------------
      // Read operations
      // -----------------------------------------------------------------

      case "find-one": {
        const options = {};
        if (projection) options.projection = projection;
        result = await collection.findOne(filter, options);
        break;
      }

      case "find": {
        let cursor = collection.find(filter);
        if (projection) cursor = cursor.project(projection);
        if (sort) cursor = cursor.sort(sort);
        if (skip) cursor = cursor.skip(skip);
        if (limit) cursor = cursor.limit(limit);
        result = await cursor.toArray();
        break;
      }

      case "count": {
        result = await collection.countDocuments(filter);
        break;
      }

      case "estimated-count": {
        result = await collection.estimatedDocumentCount();
        break;
      }

      case "distinct": {
        if (!field) throw new Error("field is required for distinct");
        result = await collection.distinct(field, filter);
        break;
      }

      // -----------------------------------------------------------------
      // Write operations
      // -----------------------------------------------------------------

      case "insert-one": {
        if (!documentStr)
          throw new Error("document is required for insert-one");
        const doc = JSON.parse(documentStr);
        const insertResult = await collection.insertOne(doc);
        result = { insertedId: insertResult.insertedId.toString() };
        break;
      }

      case "insert-many": {
        if (!documentsStr)
          throw new Error("documents is required for insert-many");
        const docs = JSON.parse(documentsStr);
        if (!Array.isArray(docs))
          throw new Error("documents must be a JSON array");
        const insertResult = await collection.insertMany(docs, { ordered });
        result = {
          insertedCount: insertResult.insertedCount,
          insertedIds: Object.fromEntries(
            Object.entries(insertResult.insertedIds).map(([k, v]) => [
              k,
              v.toString(),
            ]),
          ),
        };
        break;
      }

      case "update-one": {
        if (!updateStr) throw new Error("update is required for update-one");
        const updateDoc = JSON.parse(updateStr);
        const updateResult = await collection.updateOne(filter, updateDoc, {
          upsert,
        });
        result = {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          upsertedId: updateResult.upsertedId?.toString() || null,
        };
        break;
      }

      case "update-many": {
        if (!updateStr) throw new Error("update is required for update-many");
        const updateDoc = JSON.parse(updateStr);
        const updateResult = await collection.updateMany(filter, updateDoc, {
          upsert,
        });
        result = {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          upsertedId: updateResult.upsertedId?.toString() || null,
        };
        break;
      }

      case "replace-one": {
        if (!documentStr)
          throw new Error("document is required for replace-one");
        const replacement = JSON.parse(documentStr);
        const replaceResult = await collection.replaceOne(
          filter,
          replacement,
          { upsert },
        );
        result = {
          matchedCount: replaceResult.matchedCount,
          modifiedCount: replaceResult.modifiedCount,
          upsertedId: replaceResult.upsertedId?.toString() || null,
        };
        break;
      }

      case "delete-one": {
        const deleteResult = await collection.deleteOne(filter);
        result = { deletedCount: deleteResult.deletedCount };
        break;
      }

      case "delete-many": {
        const deleteResult = await collection.deleteMany(filter);
        result = { deletedCount: deleteResult.deletedCount };
        break;
      }

      // -----------------------------------------------------------------
      // Atomic find-and-modify operations
      // -----------------------------------------------------------------

      case "find-one-and-update": {
        if (!updateStr)
          throw new Error("update is required for find-one-and-update");
        const updateDoc = JSON.parse(updateStr);
        const options = {
          upsert,
          returnDocument: returnDocument === "before" ? "before" : "after",
        };
        if (projection) options.projection = projection;
        if (sort) options.sort = sort;
        const findResult = await collection.findOneAndUpdate(
          filter,
          updateDoc,
          options,
        );
        result = findResult;
        break;
      }

      case "find-one-and-replace": {
        if (!documentStr)
          throw new Error("document is required for find-one-and-replace");
        const replacement = JSON.parse(documentStr);
        const options = {
          upsert,
          returnDocument: returnDocument === "before" ? "before" : "after",
        };
        if (projection) options.projection = projection;
        if (sort) options.sort = sort;
        const findResult = await collection.findOneAndReplace(
          filter,
          replacement,
          options,
        );
        result = findResult;
        break;
      }

      case "find-one-and-delete": {
        const options = {};
        if (projection) options.projection = projection;
        if (sort) options.sort = sort;
        const findResult = await collection.findOneAndDelete(filter, options);
        result = findResult;
        break;
      }

      // -----------------------------------------------------------------
      // Bulk operations
      // -----------------------------------------------------------------

      case "bulk-write": {
        if (!operationsStr)
          throw new Error("operations is required for bulk-write");
        const ops = JSON.parse(operationsStr);
        if (!Array.isArray(ops))
          throw new Error("operations must be a JSON array");
        const bulkResult = await collection.bulkWrite(ops, { ordered });
        result = {
          insertedCount: bulkResult.insertedCount,
          matchedCount: bulkResult.matchedCount,
          modifiedCount: bulkResult.modifiedCount,
          deletedCount: bulkResult.deletedCount,
          upsertedCount: bulkResult.upsertedCount,
          upsertedIds: bulkResult.upsertedIds
            ? Object.fromEntries(
                Object.entries(bulkResult.upsertedIds).map(([k, v]) => [
                  k,
                  v.toString(),
                ]),
              )
            : {},
        };
        break;
      }

      // -----------------------------------------------------------------
      // Aggregation
      // -----------------------------------------------------------------

      case "aggregate": {
        if (!pipelineStr)
          throw new Error("pipeline is required for aggregate");
        const pipeline = JSON.parse(pipelineStr);
        if (!Array.isArray(pipeline))
          throw new Error("pipeline must be a JSON array");
        result = await collection.aggregate(pipeline).toArray();
        break;
      }

      // -----------------------------------------------------------------
      // Index operations
      // -----------------------------------------------------------------

      case "create-index": {
        if (!indexStr) throw new Error("index is required for create-index");
        const indexSpec = JSON.parse(indexStr);
        const options = indexOptionsStr ? JSON.parse(indexOptionsStr) : {};
        result = await collection.createIndex(indexSpec, options);
        break;
      }

      case "create-indexes": {
        if (!operationsStr)
          throw new Error("operations is required for create-indexes");
        const indexSpecs = JSON.parse(operationsStr);
        if (!Array.isArray(indexSpecs))
          throw new Error("operations must be a JSON array of index specs");
        result = await collection.createIndexes(indexSpecs);
        break;
      }

      case "drop-index": {
        if (!indexName)
          throw new Error("index-name is required for drop-index");
        await collection.dropIndex(indexName);
        result = { dropped: indexName };
        break;
      }

      case "drop-indexes": {
        await collection.dropIndexes();
        result = { dropped: "all non-_id indexes" };
        break;
      }

      case "list-indexes": {
        result = await collection.listIndexes().toArray();
        break;
      }

      // -----------------------------------------------------------------
      // Collection info
      // -----------------------------------------------------------------

      case "collection-stats": {
        const stats = await db.command({ collStats: collectionName });
        result = {
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          totalIndexSize: stats.totalIndexSize,
          indexSizes: stats.indexSizes,
        };
        break;
      }

      default:
        throw new Error(
          `Unknown command: ${command}. Available: find-one, find, count, estimated-count, distinct, insert-one, insert-many, update-one, update-many, replace-one, delete-one, delete-many, find-one-and-update, find-one-and-replace, find-one-and-delete, bulk-write, transaction, aggregate, create-index, create-indexes, drop-index, drop-indexes, list-indexes, list-collections, create-collection, drop-collection, rename-collection, collection-stats, db-stats, drop-database, run-command`,
        );
    }

    const output = typeof result === "string" ? result : JSON.stringify(result);
    core.setOutput("result", output);
  } catch (error) {
    core.setFailed(error.message);
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

run();
