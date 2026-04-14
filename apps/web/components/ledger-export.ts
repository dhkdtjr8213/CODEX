import dayjs from "dayjs";
import type { LedgerSnapshot } from "@household/types";

type ExportTransaction = LedgerSnapshot["transactions"][number];
type ExportTransactionRow = [
  string,
  string,
  number,
  string,
  string,
  string,
  string
];

const CSV_HEADERS = [
  "date",
  "type",
  "amount",
  "account",
  "category",
  "transfer_account",
  "description"
];

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function buildTransactionRows(items: ExportTransaction[]): ExportTransactionRow[] {
  return items.map((item) => [
    item.occurredAt.slice(0, 10),
    item.type,
    item.amount,
    item.accountName ?? "",
    item.categoryName ?? "",
    item.transferAccountName ?? "",
    item.description ?? ""
  ]);
}

function formatExportTimestamp() {
  return dayjs().format("YYYYMMDD-HHmm");
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getColumnLetter(index: number) {
  let current = index;
  let letters = "";

  while (current >= 0) {
    letters = String.fromCharCode((current % 26) + 65) + letters;
    current = Math.floor(current / 26) - 1;
  }

  return letters;
}

function getCellReference(rowIndex: number, columnIndex: number) {
  return `${getColumnLetter(columnIndex)}${rowIndex + 1}`;
}

function encodeUtf8(text: string) {
  return new TextEncoder().encode(text);
}

function crc32(bytes: Uint8Array) {
  let checksum = 0xffffffff;

  for (const byte of bytes) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }

  return (checksum ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function createZipArchive(files: Array<{ path: string; content: string }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localHeaderOffset = 0;

  for (const file of files) {
    const fileName = encodeUtf8(file.path);
    const fileData = encodeUtf8(file.content);
    const fileCrc = crc32(fileData);

    const localHeader = new Uint8Array(30 + fileName.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, fileCrc);
    writeUint32(localView, 18, fileData.length);
    writeUint32(localView, 22, fileData.length);
    writeUint16(localView, 26, fileName.length);
    writeUint16(localView, 28, 0);
    localHeader.set(fileName, 30);

    localParts.push(localHeader, fileData);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, fileCrc);
    writeUint32(centralView, 20, fileData.length);
    writeUint32(centralView, 24, fileData.length);
    writeUint16(centralView, 28, fileName.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localHeaderOffset);
    centralHeader.set(fileName, 46);

    centralParts.push(centralHeader);
    localHeaderOffset += localHeader.length + fileData.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endOfCentralDirectory = new Uint8Array(22);
  const endView = new DataView(endOfCentralDirectory.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, localHeaderOffset);
  writeUint16(endView, 20, 0);

  return new Blob(
    [concatBytes([...localParts, centralDirectory, endOfCentralDirectory])],
    { type: XLSX_MIME_TYPE }
  );
}

function createCsvContent(rows: ExportTransactionRow[]) {
  return [CSV_HEADERS, ...rows].map((columns) =>
    columns.map((value) => escapeCsvValue(String(value))).join(",")
  ).join("\n");
}

function createSpreadsheetXml(rows: ExportTransactionRow[]) {
  const allRows = [
    CSV_HEADERS.map((value, index) => ({
      ref: getCellReference(0, index),
      type: "string" as const,
      value
    })),
    ...rows.map((row, rowIndex) =>
      row.map((value, columnIndex) => ({
        ref: getCellReference(rowIndex + 1, columnIndex),
        type: columnIndex === 2 ? ("number" as const) : ("string" as const),
        value
      }))
    )
  ];

  const rowXml = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell) => {
          if (cell.type === "number") {
            return `<c r="${cell.ref}"><v>${cell.value}</v></c>`;
          }

          return `<c r="${cell.ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
            String(cell.value)
          )}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const dimension = `A1:G${rows.length + 1}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}" />
  <sheetViews>
    <sheetView workbookViewId="0" />
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15" />
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createXlsxContent(rows: ExportTransactionRow[]) {
  const sheetXml = createSpreadsheetXml(rows);
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Transactions" sheetId="1" r:id="rId1" />
  </sheets>
</workbook>`;
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
</Relationships>`;
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
</Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
</Types>`;

  return createZipArchive([
    { path: "[Content_Types].xml", content: contentTypesXml },
    { path: "_rels/.rels", content: rootRelsXml },
    { path: "xl/workbook.xml", content: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { path: "xl/worksheets/sheet1.xml", content: sheetXml }
  ]);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportTransactionsAsCsv(items: ExportTransaction[]) {
  const rows = buildTransactionRows(items);
  const content = createCsvContent(rows);
  const blob = new Blob(["﻿", content], {
    type: "text/csv;charset=utf-8;"
  });

  downloadBlob(blob, `transactions-${formatExportTimestamp()}.csv`);
}

export function exportTransactionsAsXlsx(items: ExportTransaction[]) {
  const rows = buildTransactionRows(items);
  const blob = createXlsxContent(rows);

  downloadBlob(blob, `transactions-${formatExportTimestamp()}.xlsx`);
}

