import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(dirname, "../data/receipts.sqlite");
const require = createRequire(import.meta.url);

let sqlPromise = null;
let storeState = null;
let writeQueue = Promise.resolve();

function resolveDbPath(options = {}) {
  return options.dbPath ?? process.env.RECEIPT_DB_PATH ?? defaultDbPath;
}

async function loadSqlRuntime() {
  if (!sqlPromise) {
    const wasmFile = require.resolve("sql.js/dist/sql-wasm.wasm");
    const wasmDir = path.dirname(wasmFile);
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(wasmDir, file)
    });
  }
  return sqlPromise;
}

async function flushToDisk(state) {
  const bytes = state.db.export();
  await writeFile(state.dbPath, Buffer.from(bytes));
}

async function initializeStore(options = {}) {
  const SQL = await loadSqlRuntime();
  const dbPath = resolveDbPath(options);
  await mkdir(path.dirname(dbPath), { recursive: true });

  let db;
  try {
    const file = await readFile(dbPath);
    db = new SQL.Database(file);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      receipt_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const state = { db, dbPath };
  await flushToDisk(state);
  return state;
}

export async function openReceiptStore(options = {}) {
  if (options.newConnection) {
    return initializeStore(options);
  }

  if (!storeState) {
    storeState = await initializeStore(options);
  }

  return storeState;
}

export async function appendReceipt(receipt, options = {}) {
  const state = options.state ?? (await openReceiptStore(options));
  const createdAt = options.createdAt ?? new Date().toISOString();
  const serialized = JSON.stringify(receipt);

  state.db.run(
    "INSERT INTO receipts (id, receipt_json, content_hash, signature, created_at) VALUES (?, ?, ?, ?, ?)",
    [
      receipt.receipt_id,
      serialized,
      receipt.integrity.content_hash,
      receipt.integrity.signature,
      createdAt
    ]
  );

  // Serialize writes to keep the on-disk sqlite file consistent.
  writeQueue = writeQueue.then(() => flushToDisk(state));
  await writeQueue;

  return {
    id: receipt.receipt_id,
    created_at: createdAt
  };
}

export async function getReceiptById(receiptId, options = {}) {
  const state = options.state ?? (await openReceiptStore(options));
  const statement = state.db.prepare(
    "SELECT id, receipt_json, content_hash, signature, created_at FROM receipts WHERE id = ?"
  );
  statement.bind([receiptId]);

  let row = null;
  if (statement.step()) {
    row = statement.getAsObject();
  }
  statement.free();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    receipt: JSON.parse(row.receipt_json),
    content_hash: row.content_hash,
    signature: row.signature,
    created_at: row.created_at
  };
}

export async function closeReceiptStore() {
  if (!storeState) {
    return;
  }

  await flushToDisk(storeState);
  storeState.db.close();
  storeState = null;
}
