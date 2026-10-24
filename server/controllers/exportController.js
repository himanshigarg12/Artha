import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { accounts, transactions } from "../data/store.js";
import { csvRow } from "../utils/csv.js";
import { isValidDate } from "../utils/validators.js";

// import.meta.dirname is the ES Modules replacement for __dirname
const EXPORT_DIR = path.join(import.meta.dirname, "..", "data", "exports");
const FILE_NAME_RE = /^[\w.-]+\.csv$/;
const TYPES = ["income", "expense", "transfer"];
const HEADER = ["date", "type", "amount", "category", "account", "toAccount", "note"];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const nameOf = (id) => accounts.find((a) => a.id === id)?.name ?? id ?? "";

// Same filters as GET /api/transactions, oldest first
const getFiltered = (query) => {
  const { from, to, category, account, type } = query;

  if ([from, to, category, account, type].some((v) => v !== undefined && typeof v !== "string")) {
    throw httpError(400, "Each query parameter must be given only once");
  }
  if (from !== undefined && !isValidDate(from)) {
    throw httpError(400, "from must be a valid date in YYYY-MM-DD format");
  }
  if (to !== undefined && !isValidDate(to)) {
    throw httpError(400, "to must be a valid date in YYYY-MM-DD format");
  }
  if (from && to && from > to) throw httpError(400, "from must not be after to");
  if (type !== undefined && !TYPES.includes(type)) {
    throw httpError(400, `type must be one of: ${TYPES.join(", ")}`);
  }

  return transactions
    .filter(
      (t) =>
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        (!category || t.category.toLowerCase() === category.toLowerCase()) &&
        (!type || t.type === type) &&
        (!account || t.account === account || t.toAccount === account)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
};

// A generator hands out the CSV one line at a time, so the whole file never
// has to sit in memory. Readable.from turns it into a stream.
function* csvLines(list) {
  yield csvRow(HEADER) + "\r\n";
  for (const t of list) {
    yield csvRow([t.date, t.type, t.amount, t.category, nameOf(t.account), nameOf(t.toAccount), t.note]) + "\r\n";
  }
}

// If the failure happens after the download has started, the headers are
// already sent, so the connection is closed instead of sending a JSON error.
const fail = (err, res, next) => (res.headersSent ? res.destroy(err) : next(err));

// GET /api/export/transactions?from=&to=&category=&account=&type=
export const exportTransactions = async (req, res, next) => {
  try {
    const list = getFiltered(req.query);
    const fileName = `artha-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await pipeline(Readable.from(csvLines(list)), res);
  } catch (err) {
    fail(err, res, next);
  }
};

// POST /api/export/transactions/save  (same filters)
export const saveExport = async (req, res, next) => {
  try {
    const list = getFiltered(req.query);
    await fsp.mkdir(EXPORT_DIR, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `transactions-${stamp}.csv`;
    const filePath = path.join(EXPORT_DIR, name);

    await pipeline(Readable.from(csvLines(list)), fs.createWriteStream(filePath));
    const { size } = await fsp.stat(filePath);

    res.status(201).json({
      file: name,
      rows: list.length,
      bytes: size,
      downloadUrl: `/api/export/files/${name}`,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/export/files
export const listFiles = async (req, res, next) => {
  try {
    let names = [];
    try {
      names = await fsp.readdir(EXPORT_DIR);
    } catch (err) {
      if (err.code !== "ENOENT") throw err; // no folder yet means no exports yet
    }

    const files = [];
    for (const name of names.filter((n) => path.extname(n) === ".csv")) {
      const info = await fsp.stat(path.join(EXPORT_DIR, name));
      files.push({ name, bytes: info.size, createdAt: info.mtime.toISOString() });
    }
    files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(files);
  } catch (err) {
    next(err);
  }
};

// Only plain file names are allowed, so "../../.env" can never get through
const resolveFile = (name) => {
  const full = path.join(EXPORT_DIR, name);
  if (!FILE_NAME_RE.test(name) || path.dirname(full) !== EXPORT_DIR) {
    throw httpError(400, "Invalid file name");
  }
  return full;
};

// GET /api/export/files/:name
export const downloadFile = async (req, res, next) => {
  try {
    const full = resolveFile(req.params.name);
    try {
      await fsp.access(full);
    } catch {
      throw httpError(404, "File not found");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.name}"`);
    await pipeline(fs.createReadStream(full), res);
  } catch (err) {
    fail(err, res, next);
  }
};

// DELETE /api/export/files/:name
export const deleteFile = async (req, res, next) => {
  try {
    const full = resolveFile(req.params.name);
    try {
      await fsp.unlink(full);
    } catch (err) {
      if (err.code === "ENOENT") throw httpError(404, "File not found");
      throw err;
    }
    res.json({ message: "File deleted", file: req.params.name });
  } catch (err) {
    next(err);
  }
};