#!/bin/bash
# Reliable JSX/ESM syntax check using @babel/parser.
# (The old `node --check` version gave FALSE PASSES on ESM+JSX files.)
cd "$(dirname "$0")"

node -e '
const { parse } = require("@babel/parser");
const fs = require("fs");
const path = require("path");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

const roots = ["src"];
const files = [];
for (const r of roots) if (fs.existsSync(r)) files.push(...walk(r));
for (const f of ["App.js", "VideoPlayerModal.js"]) if (fs.existsSync(f)) files.push(f);

const jsFiles = files.filter(f => f.endsWith(".js"));
let ok = 0, fail = 0;
for (const f of jsFiles) {
  try {
    parse(fs.readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] });
    ok++;
  } catch (e) {
    fail++;
    console.log("FAIL " + f + "\n   " + e.message);
  }
}
console.log("\nParsed " + jsFiles.length + " files.  Passed: " + ok + "  Failed: " + fail);
process.exit(fail ? 1 : 0);
'
