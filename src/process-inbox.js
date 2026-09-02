#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { generateReport } = require("./generate-report");

const configPath = path.resolve(process.argv[2] || "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const dataRoot = path.resolve(path.dirname(configPath), config.dataRoot || "./data");
const folders = {
  input: path.join(dataRoot, "in"),
  output: path.join(dataRoot, "out"),
  archive: path.join(dataRoot, "archive"),
  logs: path.join(dataRoot, "logs"),
  state: path.join(dataRoot, ".state")
};
Object.values(folders).forEach(folder => fs.mkdirSync(folder, { recursive: true }));
const lockPath = path.join(folders.state, "processor.lock");

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  fs.appendFileSync(path.join(folders.logs, "processor.log"), `${line}\n`, "utf8");
  console.log(line);
}

function outputName(fileName) {
  const match = fileName.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  const date = match ? `${match[1]}-${match[2]}-${match[3]}` : new Date().toISOString().slice(0, 10);
  return `Tender_Summary_${date}.docx`;
}

function acquireLock() {
  const staleMs = Number(config.lockStaleMinutes || 15) * 60_000;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`, "utf8");
      fs.closeSync(fd);
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;

      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age < staleMs) {
        log("Another run is active; skipped.");
        return false;
      }

      try {
        fs.unlinkSync(lockPath);
        log("Removed stale processor lock.");
      } catch (removeError) {
        if (removeError.code !== "ENOENT") throw removeError;
      }
    }
  }

  return false;
}

async function run() {
  if (!acquireLock()) return;
  try {
    const stableAge = Number(config.stableAgeSeconds || 30) * 1000;
    const files = fs.readdirSync(folders.input)
      .filter(name => /\.(pdf|txt)$/i.test(name))
      .filter(name => Date.now() - fs.statSync(path.join(folders.input, name)).mtimeMs >= stableAge);
    for (const name of files) {
      const input = path.join(folders.input, name);
      const output = path.join(folders.output, outputName(name));
      const archived = path.join(folders.archive, name);
      if (fs.existsSync(output)) {
        fs.renameSync(input, archived);
        log(`Duplicate report skipped; archived ${name}.`);
        continue;
      }
      const temporary = `${output}.${process.pid}.tmp`;
      await generateReport(input, temporary, config.report || {});
      fs.renameSync(temporary, output);
      fs.renameSync(input, archived);
      log(`Created ${path.basename(output)} and archived ${name}.`);
    }
    if (!files.length) log("No stable input files found.");
  } finally {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  }
}

run().catch(error => {
  log(`ERROR: ${error.message || error}`);
  process.exitCode = 1;
});
