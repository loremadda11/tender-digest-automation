"use strict";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMoney, parseTenderDigest, selectHighlights } = require("../src/parser");

test("parseMoney normalizes formatted values", () => {
  assert.equal(parseMoney("EUR 1,250,000"), 1250000);
});

test("synthetic digest is parsed without external data", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "..", "sample-data", "sample-digest.txt"), "utf8");
  const parsed = parseTenderDigest(fixture);
  assert.equal(parsed.reportDate, "2026-09-01");
  assert.equal(parsed.records.length, 4);
  assert.equal(parsed.records[0].id, "DEMO-001");
});

test("highlights respect status, region and value rules", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "..", "sample-data", "sample-digest.txt"), "utf8");
  const { records } = parseTenderDigest(fixture);
  const selected = selectHighlights(records, {
    targetRegions: ["North", "Central"],
    minimumOpportunityValue: 1000000,
    maximumRows: 20
  });
  assert.deepEqual(selected.map(item => item.id), ["DEMO-001", "DEMO-002"]);
});
