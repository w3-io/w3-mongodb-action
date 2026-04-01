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

    // Extract database name from connection string
    const db = client.db();

    // Commands that don't need a collection
    if (command === "list-collections") {
      const collections = await db.listCollections().toArray();
      const result = collections.map((c) => ({
        name: c.name,
        type: c.type,
      }));
      core.setOutput("result", JSON.stringify(result));
      return;
    }

    if (!collectionName) {
      throw new Error(`Collection name required for command: ${command}`);
    }
    const collection = db.collection(collectionName);

    let result;

    switch (command) {
      // --- Read operations ---

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

      case "distinct": {
        if (!field) throw new Error("field is required for distinct");
        result = await collection.distinct(field, filter);
        break;
      }

      // --- Write operations ---

      case "insert-one": {
        if (!documentStr) throw new Error("document is required for insert-one");
        const doc = JSON.parse(documentStr);
        const insertResult = await collection.insertOne(doc);
        result = { insertedId: insertResult.insertedId.toString() };
        break;
      }

      case "insert-many": {
        if (!documentsStr)
          throw new Error("documents is required for insert-many");
        const docs = JSON.parse(documentsStr);
        if (!Array.isArray(docs)) throw new Error("documents must be a JSON array");
        const insertResult = await collection.insertMany(docs);
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
        const replaceResult = await collection.replaceOne(filter, replacement, {
          upsert,
        });
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

      // --- Aggregation ---

      case "aggregate": {
        if (!pipelineStr)
          throw new Error("pipeline is required for aggregate");
        const pipeline = JSON.parse(pipelineStr);
        if (!Array.isArray(pipeline))
          throw new Error("pipeline must be a JSON array");
        result = await collection.aggregate(pipeline).toArray();
        break;
      }

      // --- Index operations ---

      case "create-index": {
        if (!indexStr) throw new Error("index is required for create-index");
        const indexSpec = JSON.parse(indexStr);
        const options = indexOptionsStr ? JSON.parse(indexOptionsStr) : {};
        result = await collection.createIndex(indexSpec, options);
        break;
      }

      case "drop-index": {
        if (!indexName) throw new Error("index-name is required for drop-index");
        await collection.dropIndex(indexName);
        result = { dropped: indexName };
        break;
      }

      case "list-indexes": {
        result = await collection.listIndexes().toArray();
        break;
      }

      default:
        throw new Error(
          `Unknown command: ${command}. Available: find-one, find, insert-one, insert-many, update-one, update-many, replace-one, delete-one, delete-many, count, distinct, aggregate, create-index, drop-index, list-indexes, list-collections`,
        );
    }

    core.setOutput("result", JSON.stringify(result));
  } catch (error) {
    core.setFailed(error.message);
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

run();
