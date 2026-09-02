#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} = require("docx");
const { parseTenderDigest, selectHighlights } = require("./parser");

async function extractText(inputPath) {
  if (path.extname(inputPath).toLowerCase() !== ".pdf") {
    return fs.readFileSync(inputPath, "utf8");
  }
  const parser = new PDFParse({ data: fs.readFileSync(inputPath) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function buildDocument(reportDate, records, config) {
  const highlights = selectHighlights(records, config);
  const rows = highlights.map(record => new TableRow({
    children: [record.region, record.authority, record.title, money(record.value), record.deadline?.toISOString().slice(0, 10) || "—"]
      .map(value => new TableCell({ children: [new Paragraph(String(value))] }))
  }));
  const header = new TableRow({
    tableHeader: true,
    children: ["Region", "Authority", "Opportunity", "Value", "Deadline"]
      .map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold: true })] })] }))
  });
  const totalValue = highlights.reduce((sum, record) => sum + record.value, 0);
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: "Tender Digest Summary", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Reporting date: ${reportDate}`, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `${highlights.length} highlighted opportunities · ${money(totalValue)} combined value` }),
        new Paragraph({ text: "Selected opportunities", heading: HeadingLevel.HEADING_1 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }),
        new Paragraph({ text: "Portfolio demo using synthetic data. Always verify the original source before making decisions." })
      ]
    }]
  });
}

async function generateReport(inputPath, outputPath, config = {}) {
  const text = await extractText(inputPath);
  const parsed = parseTenderDigest(text);
  const document = buildDocument(parsed.reportDate, parsed.records, config);
  const buffer = await Packer.toBuffer(document);
  fs.writeFileSync(outputPath, buffer);
  return { ...parsed, outputPath };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: node src/generate-report.js <digest.pdf|digest.txt> [output.docx]");
  const resolvedInput = path.resolve(inputPath);
  const outputPath = path.resolve(process.argv[3] || `Tender_Summary_${new Date().toISOString().slice(0, 10)}.docx`);
  const configPath = process.env.TENDER_DIGEST_CONFIG;
  const config = configPath ? JSON.parse(fs.readFileSync(configPath, "utf8")).report || {} : {};
  const result = await generateReport(resolvedInput, outputPath, config);
  console.log(`Created ${result.outputPath} from ${result.records.length} records.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { buildDocument, extractText, generateReport };
