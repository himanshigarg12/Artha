// A cell starting with = + - @ can run as a formula when the CSV is opened
// in Excel, so text cells get a leading ' to keep them as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value) => {
  let s = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  // Wrap in quotes when the cell has a comma, quote or line break
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const csvRow = (cells) => cells.map(csvCell).join(",");

// Excel's "CSV UTF-8" saves a 3-byte marker (EF BB BF) at the start.
// Skip it, then decode the rest of the buffer as UTF-8 text.
export const bufferToText = (buffer) => {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  return buffer.toString("utf8", hasBom ? 3 : 0);
};

// Turns CSV text into an array of rows (each row an array of cells).
// Handles quoted cells, commas inside quotes, "" for a quote, and \n or \r\n.
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (inQuotes) throw new Error("The CSV has a quote that is never closed");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};