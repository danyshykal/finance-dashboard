// Quotes a value for CSV. Text starting with = + - @ is prefixed with ' so
// spreadsheet apps don't run it as a formula.
const cell = (value) => {
  if (typeof value === 'number') return String(value);
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

// Builds a CSV file from rows (arrays of values) and makes the browser download it.
export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
