"use strict";

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTenderDigest(text) {
  const source = String(text || "").replace(/\r/g, "");
  const dateMatch = source.match(/DAILY PROCUREMENT DIGEST\s+(\d{4}-\d{2}-\d{2})/i);
  const reportDate = dateMatch?.[1] || new Date().toISOString().slice(0, 10);
  const records = source
    .split(/^---+$/m)
    .map(block => block.trim())
    .filter(block => /^ID\s*:/im.test(block))
    .map(block => {
      const values = {};
      for (const line of block.split("\n")) {
        const match = line.match(/^([A-Z_]+)\s*:\s*(.+)$/i);
        if (match) values[match[1].toUpperCase()] = match[2].trim();
      }
      return {
        id: values.ID || "UNSPECIFIED",
        region: values.REGION || "Unspecified",
        authority: values.AUTHORITY || "Unspecified authority",
        title: values.TITLE || "Untitled opportunity",
        value: parseMoney(values.VALUE),
        deadline: parseDate(values.DEADLINE),
        status: (values.STATUS || "OPEN").toUpperCase(),
        category: values.CATEGORY || "Uncategorized"
      };
    });
  return { reportDate, records };
}

function selectHighlights(records, config = {}) {
  const targets = new Set(config.targetRegions || []);
  const minimum = Number(config.minimumOpportunityValue || 0);
  const maximumRows = Number(config.maximumRows || 20);
  return records
    .filter(record => record.status === "OPEN")
    .filter(record => !targets.size || targets.has(record.region) || record.value >= minimum)
    .sort((a, b) => b.value - a.value)
    .slice(0, maximumRows);
}

module.exports = { parseMoney, parseDate, parseTenderDigest, selectHighlights };
