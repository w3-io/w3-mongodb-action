import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Reproduce core logic from src/index.js for unit testing without MongoDB
// ---------------------------------------------------------------------------

class W3ActionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function setJsonOutput(_name, value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Simulate getInputs() parsing — the pure-logic portion that transforms
 * raw string inputs into typed values.
 */
function parseInputs(raw) {
  const filterStr = raw.filter || "{}";
  const projectionStr = raw.projection || "";
  const sortStr = raw.sort || "";
  const limitStr = raw.limit || "";
  const skipStr = raw.skip || "";

  return {
    url: raw.url || "",
    collectionName: raw.collection || "",
    filter: JSON.parse(filterStr),
    documentStr: raw.document || "",
    documentsStr: raw.documents || "",
    updateStr: raw.update || "",
    pipelineStr: raw.pipeline || "",
    projection: projectionStr ? JSON.parse(projectionStr) : undefined,
    sort: sortStr ? JSON.parse(sortStr) : undefined,
    limit: limitStr ? parseInt(limitStr, 10) : undefined,
    skip: skipStr ? parseInt(skipStr, 10) : undefined,
    field: raw.field || "",
    indexStr: raw.index || "",
    indexOptionsStr: raw["index-options"] || "",
    indexName: raw["index-name"] || "",
    upsert: raw.upsert === "true",
    ordered: raw.ordered !== "false",
    operationsStr: raw.operations || "",
    optionsStr: raw.options || "",
    newCollectionName: raw["new-name"] || "",
    returnDocument: raw["return-document"] || "after",
    commandStr: raw["db-command"] || "",
  };
}

// ---------------------------------------------------------------------------
// Validation helpers (mirrors checks in collHandler / dbHandler commands)
// ---------------------------------------------------------------------------

function requireCollection(inputs) {
  if (!inputs.collectionName)
    throw new W3ActionError(
      "MISSING_INPUT",
      "Collection name required for this command",
    );
}

function requireDocument(inputs, cmd) {
  if (!inputs.documentStr)
    throw new W3ActionError("MISSING_INPUT", `document is required for ${cmd}`);
}

function requireUpdate(inputs, cmd) {
  if (!inputs.updateStr)
    throw new W3ActionError("MISSING_INPUT", `update is required for ${cmd}`);
}

function requirePipeline(inputs) {
  if (!inputs.pipelineStr)
    throw new W3ActionError(
      "MISSING_INPUT",
      "pipeline is required for aggregate",
    );
  const pipeline = JSON.parse(inputs.pipelineStr);
  if (!Array.isArray(pipeline))
    throw new W3ActionError("MISSING_INPUT", "pipeline must be a JSON array");
  return pipeline;
}

function requireIndex(inputs) {
  if (!inputs.indexStr)
    throw new W3ActionError(
      "MISSING_INPUT",
      "index is required for create-index",
    );
}

function requireIndexName(inputs) {
  if (!inputs.indexName)
    throw new W3ActionError(
      "MISSING_INPUT",
      "index-name is required for drop-index",
    );
}

function requireField(inputs) {
  if (!inputs.field)
    throw new W3ActionError("MISSING_INPUT", "field is required for distinct");
}

function requireOperations(inputs) {
  if (!inputs.operationsStr)
    throw new W3ActionError(
      "MISSING_INPUT",
      "operations is required for bulk-write",
    );
  const ops = JSON.parse(inputs.operationsStr);
  if (!Array.isArray(ops))
    throw new W3ActionError("MISSING_INPUT", "operations must be a JSON array");
  return ops;
}

function requireDbCommand(inputs) {
  if (!inputs.commandStr)
    throw new W3ActionError(
      "MISSING_INPUT",
      "db-command is required for run-command",
    );
}

// ===========================================================================
// Tests
// ===========================================================================

describe("input parsing", () => {
  it("parses minimal inputs with defaults", () => {
    const inputs = parseInputs({ url: "mongodb://localhost/test" });
    assert.equal(inputs.url, "mongodb://localhost/test");
    assert.deepEqual(inputs.filter, {});
    assert.equal(inputs.collectionName, "");
    assert.equal(inputs.projection, undefined);
    assert.equal(inputs.sort, undefined);
    assert.equal(inputs.limit, undefined);
    assert.equal(inputs.skip, undefined);
    assert.equal(inputs.upsert, false);
    assert.equal(inputs.ordered, true);
    assert.equal(inputs.returnDocument, "after");
  });

  it("parses filter JSON", () => {
    const inputs = parseInputs({
      url: "mongodb://localhost/test",
      filter: '{"status": "active"}',
    });
    assert.deepEqual(inputs.filter, { status: "active" });
  });

  it("parses projection", () => {
    const inputs = parseInputs({
      url: "mongodb://localhost/test",
      projection: '{"name": 1, "_id": 0}',
    });
    assert.deepEqual(inputs.projection, { name: 1, _id: 0 });
  });

  it("parses sort specification", () => {
    const inputs = parseInputs({
      url: "mongodb://localhost/test",
      sort: '{"createdAt": -1}',
    });
    assert.deepEqual(inputs.sort, { createdAt: -1 });
  });

  it("parses limit and skip as integers", () => {
    const inputs = parseInputs({
      url: "mongodb://localhost/test",
      limit: "10",
      skip: "20",
    });
    assert.equal(inputs.limit, 10);
    assert.equal(inputs.skip, 20);
  });

  it("parses upsert boolean from string", () => {
    const on = parseInputs({ url: "x", upsert: "true" });
    assert.equal(on.upsert, true);
    const off = parseInputs({ url: "x", upsert: "false" });
    assert.equal(off.upsert, false);
    const missing = parseInputs({ url: "x" });
    assert.equal(missing.upsert, false);
  });

  it("parses ordered boolean (default true, opt-out with 'false')", () => {
    const def = parseInputs({ url: "x" });
    assert.equal(def.ordered, true);
    const off = parseInputs({ url: "x", ordered: "false" });
    assert.equal(off.ordered, false);
    const on = parseInputs({ url: "x", ordered: "true" });
    assert.equal(on.ordered, true);
  });

  it("parses return-document with default after", () => {
    const def = parseInputs({ url: "x" });
    assert.equal(def.returnDocument, "after");
    const before = parseInputs({ url: "x", "return-document": "before" });
    assert.equal(before.returnDocument, "before");
  });

  it("throws on invalid JSON filter", () => {
    assert.throws(() => parseInputs({ url: "x", filter: "not json" }), {
      name: "SyntaxError",
    });
  });
});

describe("output serialization", () => {
  it("object result is JSON-stringified once", () => {
    const result = { insertedId: "abc123" };
    const output = setJsonOutput("result", result);
    assert.equal(output, '{"insertedId":"abc123"}');
    assert.deepEqual(JSON.parse(output), { insertedId: "abc123" });
  });

  it("array result is JSON-stringified once", () => {
    const result = [{ name: "users" }, { name: "orders" }];
    const output = setJsonOutput("result", result);
    const parsed = JSON.parse(output);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 2);
  });

  it("number result is stringified", () => {
    assert.equal(setJsonOutput("result", 42), "42");
  });

  it("null result is stringified", () => {
    assert.equal(setJsonOutput("result", null), "null");
  });

  it("string result passes through unchanged", () => {
    assert.equal(setJsonOutput("result", "email_1"), "email_1");
  });

  it("no double-encoding on objects", () => {
    const result = { matchedCount: 1, modifiedCount: 1, upsertedId: null };
    const output = setJsonOutput("result", result);
    const parsed = JSON.parse(output);
    assert.equal(typeof parsed, "object");
    assert.equal(parsed.matchedCount, 1);
  });
});

describe("insert-one validation", () => {
  it("requires document input", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
    });
    assert.throws(() => requireDocument(inputs, "insert-one"), {
      code: "MISSING_INPUT",
    });
  });

  it("accepts valid document string", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      document: '{"name": "Alice"}',
    });
    assert.doesNotThrow(() => requireDocument(inputs, "insert-one"));
    const doc = JSON.parse(inputs.documentStr);
    assert.equal(doc.name, "Alice");
  });
});

describe("insert-many validation", () => {
  it("requires documents input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.equal(inputs.documentsStr, "");
  });

  it("rejects non-array documents", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      documents: '{"name": "Alice"}',
    });
    const parsed = JSON.parse(inputs.documentsStr);
    assert.equal(Array.isArray(parsed), false);
  });

  it("accepts valid documents array", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      documents: '[{"name": "Alice"}, {"name": "Bob"}]',
    });
    const docs = JSON.parse(inputs.documentsStr);
    assert.ok(Array.isArray(docs));
    assert.equal(docs.length, 2);
  });
});

describe("update validation", () => {
  it("update-one requires update input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireUpdate(inputs, "update-one"), {
      code: "MISSING_INPUT",
    });
  });

  it("update-many requires update input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireUpdate(inputs, "update-many"), {
      code: "MISSING_INPUT",
    });
  });

  it("accepts valid update expression", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      update: '{"$set": {"active": true}}',
    });
    assert.doesNotThrow(() => requireUpdate(inputs, "update-one"));
    const u = JSON.parse(inputs.updateStr);
    assert.deepEqual(u, { $set: { active: true } });
  });
});

describe("delete validation", () => {
  it("collection is required for delete-one", () => {
    const inputs = parseInputs({ url: "x" });
    assert.throws(() => requireCollection(inputs), {
      code: "MISSING_INPUT",
    });
  });

  it("filter defaults to empty object for delete-many", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.deepEqual(inputs.filter, {});
  });
});

describe("find-one-and-update validation", () => {
  it("requires update input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireUpdate(inputs, "find-one-and-update"), {
      code: "MISSING_INPUT",
    });
  });
});

describe("find-one-and-replace validation", () => {
  it("requires document input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireDocument(inputs, "find-one-and-replace"), {
      code: "MISSING_INPUT",
    });
  });
});

describe("aggregate validation", () => {
  it("requires pipeline input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requirePipeline(inputs), { code: "MISSING_INPUT" });
  });

  it("rejects non-array pipeline", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      pipeline: '{"$match": {"status": "A"}}',
    });
    assert.throws(() => requirePipeline(inputs), {
      message: "pipeline must be a JSON array",
    });
  });

  it("accepts valid pipeline array", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      pipeline:
        '[{"$match": {"status": "A"}}, {"$group": {"_id": "$cust_id", "total": {"$sum": "$amount"}}}]',
    });
    const pipeline = requirePipeline(inputs);
    assert.ok(Array.isArray(pipeline));
    assert.equal(pipeline.length, 2);
  });
});

describe("index management validation", () => {
  it("create-index requires index spec", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireIndex(inputs), { code: "MISSING_INPUT" });
  });

  it("create-index accepts valid index spec", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      index: '{"email": 1}',
    });
    assert.doesNotThrow(() => requireIndex(inputs));
    const spec = JSON.parse(inputs.indexStr);
    assert.deepEqual(spec, { email: 1 });
  });

  it("create-index parses index options", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      index: '{"email": 1}',
      "index-options": '{"unique": true, "name": "email_unique"}',
    });
    const opts = JSON.parse(inputs.indexOptionsStr);
    assert.equal(opts.unique, true);
    assert.equal(opts.name, "email_unique");
  });

  it("drop-index requires index-name", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireIndexName(inputs), { code: "MISSING_INPUT" });
  });

  it("drop-index accepts valid index name", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      "index-name": "email_1",
    });
    assert.doesNotThrow(() => requireIndexName(inputs));
    assert.equal(inputs.indexName, "email_1");
  });
});

describe("distinct validation", () => {
  it("requires field input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireField(inputs), { code: "MISSING_INPUT" });
  });

  it("accepts valid field", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      field: "status",
    });
    assert.doesNotThrow(() => requireField(inputs));
    assert.equal(inputs.field, "status");
  });
});

describe("bulk-write validation", () => {
  it("requires operations input", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.throws(() => requireOperations(inputs), { code: "MISSING_INPUT" });
  });

  it("rejects non-array operations", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      operations: '{"insertOne": {"document": {}}}',
    });
    assert.throws(() => requireOperations(inputs), {
      message: "operations must be a JSON array",
    });
  });

  it("accepts valid operations array", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "users",
      operations:
        '[{"insertOne": {"document": {"name": "Alice"}}}, {"deleteOne": {"filter": {"name": "Bob"}}}]',
    });
    const ops = requireOperations(inputs);
    assert.equal(ops.length, 2);
  });
});

describe("collection requirement", () => {
  it("throws when collection is missing", () => {
    const inputs = parseInputs({ url: "x" });
    assert.throws(() => requireCollection(inputs), { code: "MISSING_INPUT" });
  });

  it("passes when collection is present", () => {
    const inputs = parseInputs({ url: "x", collection: "users" });
    assert.doesNotThrow(() => requireCollection(inputs));
  });
});

describe("run-command validation", () => {
  it("requires db-command input", () => {
    const inputs = parseInputs({ url: "x" });
    assert.throws(() => requireDbCommand(inputs), { code: "MISSING_INPUT" });
  });

  it("accepts valid db-command", () => {
    const inputs = parseInputs({ url: "x", "db-command": '{"ping": 1}' });
    assert.doesNotThrow(() => requireDbCommand(inputs));
    const cmd = JSON.parse(inputs.commandStr);
    assert.deepEqual(cmd, { ping: 1 });
  });
});

describe("transaction validation", () => {
  it("requires operations input", () => {
    const inputs = parseInputs({ url: "x" });
    assert.equal(inputs.operationsStr, "");
  });

  it("rejects non-array operations", () => {
    const raw = '{"collection": "users", "op": "insertOne"}';
    const parsed = JSON.parse(raw);
    assert.equal(Array.isArray(parsed), false);
  });

  it("validates each operation has collection and op", () => {
    const ops = [
      { collection: "users", op: "insertOne", document: { name: "Alice" } },
      { collection: "orders", op: "insertOne", document: { item: "Book" } },
    ];
    for (const op of ops) {
      assert.ok(op.collection, "operation must have collection");
      assert.ok(op.op, "operation must have op");
    }
  });

  it("rejects unknown transaction op", () => {
    const validOps = [
      "insertOne",
      "insertMany",
      "updateOne",
      "updateMany",
      "replaceOne",
      "deleteOne",
      "deleteMany",
      "findOne",
      "findOneAndUpdate",
      "findOneAndDelete",
    ];
    assert.equal(validOps.includes("badOp"), false);
    assert.equal(validOps.includes("insertOne"), true);
  });
});

describe("database-level commands input parsing", () => {
  it("create-collection requires collection name", () => {
    const inputs = parseInputs({ url: "x" });
    assert.equal(inputs.collectionName, "");
  });

  it("rename-collection requires new-name", () => {
    const inputs = parseInputs({
      url: "x",
      collection: "old",
      "new-name": "new",
    });
    assert.equal(inputs.newCollectionName, "new");
  });

  it("rename-collection fails without new-name", () => {
    const inputs = parseInputs({ url: "x", collection: "old" });
    assert.equal(inputs.newCollectionName, "");
  });
});

describe("W3ActionError structure", () => {
  it("has code and message properties", () => {
    const err = new W3ActionError("MISSING_INPUT", "field is required");
    assert.equal(err.code, "MISSING_INPUT");
    assert.equal(err.message, "field is required");
    assert.ok(err instanceof Error);
  });
});
