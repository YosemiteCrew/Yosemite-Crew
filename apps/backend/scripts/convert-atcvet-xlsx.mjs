/**
 * Converts the WHO CC "ATCvet index" workbook into the JSON the importer reads.
 *
 * The workbook is copyright the WHO Collaborating Centre for Drug Statistics
 * Methodology (see the third-party data notice in License.txt). Run this once per
 * yearly release against your own copy of the workbook:
 *
 *   node apps/backend/scripts/convert-atcvet-xlsx.mjs "<path to xlsx>" apps/backend/data/atcvet_index.json
 *
 * Reads the sheet with the zip/XML that .xlsx already is, so no dependency is
 * added for a conversion that runs once per yearly release.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const [, , source, destination] = process.argv;
if (!source || !destination) {
  console.error(
    'usage: node convert-atcvet-xlsx.mjs "<index.xlsx>" <out.json>',
  );
  process.exit(1);
}

// The XML plumbing is short enough to inline, but python3's zipfile+ElementTree
// is already present on every machine that runs this and avoids a node XML dep.
const python = `
import json, sys, zipfile, xml.etree.ElementTree as ET
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
z = zipfile.ZipFile(sys.argv[1])
shared = ["".join(t.text or "" for t in si.iter(f"{NS}t"))
          for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(f"{NS}si")]
sheet_part = next(n for n in z.namelist() if n.startswith("xl/worksheets/sheet"))
rows = []
for row in ET.fromstring(z.read(sheet_part)).iter(f"{NS}row"):
    cells = {}
    for c in row.iter(f"{NS}c"):
        col = "".join(ch for ch in c.get("r") if ch.isalpha())
        v = c.find(f"{NS}v")
        cells[col] = shared[int(v.text)] if (c.get("t") == "s" and v is not None) else (v.text if v is not None else "")
    rows.append((cells.get("A", "").strip(), cells.get("B", "").strip()))
# Drop the header row and any trailing blanks.
entries = [{"code": c, "name": n} for c, n in rows[1:] if c and n]
json.dump(entries, sys.stdout)
`;

const raw = execFileSync("python3", ["-c", python, source], {
  maxBuffer: 64 * 1024 * 1024,
});
const entries = JSON.parse(raw.toString());

fs.writeFileSync(
  destination,
  JSON.stringify(
    {
      source: "WHO Collaborating Centre for Drug Statistics Methodology",
      dataset: "ATCvet index",
      // Stamped from the filename rather than invented, so provenance on every
      // imported row names the release it actually came from.
      release: /(\d{4})/.exec(source)?.[1] ?? "unknown",
      convertedFrom: source.split("/").pop(),
      entries,
    },
    null,
    2,
  ),
);
console.log(`wrote ${entries.length} entries to ${destination}`);
