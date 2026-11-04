#!/usr/bin/env node
/**
 * Kongila — schema audit
 *
 * Compares what the application code writes against the LIVE database schema,
 * rather than against supabase_migration.sql, because the migration file is
 * the thing in doubt.
 *
 * Usage:
 *   1. Run docs/schema-introspection.sql in the Supabase SQL editor.
 *   2. Save the single JSON result cell to docs/live-schema.json
 *   3. node scripts/schema-audit.js
 *
 * Without the dump it still runs, and reports what the code writes so the
 * extraction can be eyeballed:
 *   node scripts/schema-audit.js --code-only
 *
 * It reports four things per table:
 *   - columns written by the code that do not exist
 *   - NOT NULL columns with no default that an insert never provides
 *   - literal values that violate a CHECK constraint
 *   - columns that exist and are never written (informational, off by default)
 *
 * Read-only. It parses files and prints a report.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DUMP_PATH = path.join(ROOT, 'docs', 'live-schema.json');
const SCAN_DIRS = ['apps', 'packages'];
const SKIP = /node_modules|\.next|\.turbo|dist|build/;

const codeOnly = process.argv.includes('--code-only');
const showUnused = process.argv.includes('--show-unused');

// ─── Source scanning ─────────────────────────────────────────────────────────

function sourceFiles() {
  const out = [];
  for (const dir of SCAN_DIRS) {
    const start = path.join(ROOT, dir);
    if (!fs.existsSync(start)) continue;
    (function walk(d) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (SKIP.test(p)) continue;
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
      }
    })(start);
  }
  return out;
}

/** Reads a balanced {...} starting at the given index. */
function readObjectLiteral(src, openIndex) {
  let depth = 0;
  let inString = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(openIndex, i + 1);
    }
  }
  return null;
}

/** Top-level keys of an object literal, plus any string value for key-ish fields. */
function parseLiteral(objectSrc) {
  const keys = [];
  const values = {};
  let depth = 0;
  let inString = null;
  let token = '';
  let capturingKey = true;
  let currentKey = null;

  for (let i = 1; i < objectSrc.length - 1; i++) {
    const ch = objectSrc[i];
    const prev = objectSrc[i - 1];

    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      else token += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; continue; }

    if (depth === 0 && ch === ':' && capturingKey) {
      currentKey = token.trim().replace(/^\.\.\./, '');
      if (currentKey && /^[A-Za-z_][\w]*$/.test(currentKey)) keys.push(currentKey);
      token = '';
      capturingKey = false;
      continue;
    }
    if (depth === 0 && ch === ',') {
      if (currentKey && token.trim()) {
        values[currentKey] = token.trim();
      } else if (capturingKey) {
        // Shorthand: `{ email, role }`. Only `key: value` was recognised
        // before, so every shorthand property looked like a missing
        // NOT NULL column. That is the rest of the last report.
        const shorthand = token.trim();
        if (shorthand && /^[A-Za-z_][\w]*$/.test(shorthand)) keys.push(shorthand);
      }
      token = '';
      capturingKey = true;
      currentKey = null;
      continue;
    }
    token += ch;
  }
  if (currentKey && token.trim()) {
    values[currentKey] = token.trim();
  } else if (capturingKey) {
    // The last property in the literal, with no comma after it.
    const shorthand = token.trim();
    if (shorthand && /^[A-Za-z_][\w]*$/.test(shorthand)) keys.push(shorthand);
  }
  // A spread brings in keys this parser cannot see, so a NOT NULL column
  // missing from a literal that has one is not evidence of anything.
  const spread = /\.\.\./.test(objectSrc);
  return { keys, values, spread };
}

function scanWrites() {
  const writes = [];
  for (const file of sourceFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /\.from\(\s*['"`]([a-zA-Z_][\w]*)['"`]\s*\)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const table = m[1];
      // supabase.storage.from('bucket') is not a table write.
      if (/\.storage\s*$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
      const after = src.slice(m.index, m.index + 900);
      const opMatch = after.match(/\.\s*(insert|update|upsert)\s*\(/);
      if (!opMatch) continue;

      // The op has to belong to THIS chain. Without this check the scan
      // ran up to 900 characters past the .from() and happily matched an
      // insert from the next statement, so a select on one table was
      // reported as a write to it with another table's columns. That is
      // where most of the mismatches in the last report came from.
      const between = after.slice(m[0].length, opMatch.index);
      if (/[;}]/.test(between) || /\.from\s*\(/.test(between)) continue;

      const opAt = m.index + opMatch.index + opMatch[0].length;
      // Skip past an opening array bracket: .insert([{...}])
      let cursor = opAt;
      while (cursor < src.length && /[\s[]/.test(src[cursor])) cursor++;

      // A payload passed as a variable, e.g. .insert(newRow), cannot be read
      // statically. Those are counted so the total is honest, but their
      // columns are not checked.
      if (src[cursor] !== '{') {
        writes.push({
          file: path.relative(ROOT, file).replace(/\\/g, '/'),
          line: src.slice(0, m.index).split('\n').length,
          table,
          op: opMatch[1],
          keys: [],
          values: {},
          unparsed: true
        });
        continue;
      }

      const literal = readObjectLiteral(src, cursor);
      if (!literal) continue;

      const { keys, values, spread } = parseLiteral(literal);
      const line = src.slice(0, m.index).split('\n').length;
      writes.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line,
        table,
        op: opMatch[1],
        keys,
        values,
        spread
      });
    }
  }
  return writes;
}

// ─── Schema handling ─────────────────────────────────────────────────────────

function loadSchema() {
  if (!fs.existsSync(DUMP_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
  // Accept either the bare object or Supabase's [{ schema_dump: {...} }] export.
  const dump = Array.isArray(raw) ? raw[0].schema_dump || raw[0] : raw.schema_dump || raw;

  const tables = {};
  for (const col of dump.columns || []) {
    const t = (tables[col.table_name] = tables[col.table_name] || { columns: {}, checks: [] });
    t.columns[col.column_name] = {
      nullable: col.is_nullable === 'YES',
      hasDefault: col.column_default !== null && col.column_default !== undefined,
      type: col.data_type
    };
  }
  for (const chk of dump.checks || []) {
    if (!tables[chk.table_name]) continue;
    tables[chk.table_name].checks.push(chk);
  }
  return { tables, dump };
}

/** Pulls the allowed literals out of a CHECK definition like: CHECK ((status = ANY (ARRAY['a'::text, 'b'::text]))) */
function allowedValues(definition) {
  const list = definition.match(/ARRAY\[(.*?)\]/s);
  if (!list) return null;
  const values = [...list[1].matchAll(/'((?:[^']|'')*)'/g)].map(x => x[1]);
  return values.length ? values : null;
}

function checkColumn(definition) {
  const m = definition.match(/\(?\s*\(?([a-zA-Z_][\w]*)\s*(?:=|IS)/);
  return m ? m[1] : null;
}

function literalString(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^['"`]([^'"`]*)['"`]$/);
  return m ? m[1] : null;
}

// ─── Report ──────────────────────────────────────────────────────────────────

const writes = scanWrites();
const byTable = {};
for (const w of writes) (byTable[w.table] = byTable[w.table] || []).push(w);

if (codeOnly) {
  console.log(`Scanned ${writes.length} write call sites across ${Object.keys(byTable).length} tables.\n`);
  for (const [table, list] of Object.entries(byTable).sort()) {
    const cols = new Set();
    list.forEach(w => w.keys.forEach(k => cols.add(k)));
    console.log(`${table}  (${list.length} sites)`);
    console.log(`  columns written: ${[...cols].sort().join(', ') || '(none parsed)'}`);
  }
  process.exit(0);
}

const schema = loadSchema();
if (!schema) {
  console.error(`No live schema dump at ${path.relative(ROOT, DUMP_PATH)}.`);
  console.error('Run docs/schema-introspection.sql in Supabase and save the JSON result there.');
  console.error('To inspect only what the code writes:  node scripts/schema-audit.js --code-only');
  process.exit(1);
}

let problems = 0;
console.log(`Live schema: ${schema.dump.database || 'unknown'} @ ${schema.dump.generated_at || 'unknown'}`);
console.log(`Code: ${writes.length} write call sites\n`);

for (const [table, list] of Object.entries(byTable).sort()) {
  const def = schema.tables[table];
  const lines = [];

  if (!def) {
    lines.push(`  TABLE MISSING from the live schema`);
    list.forEach(w => lines.push(`    ${w.file}:${w.line}`));
    problems++;
    console.log(`${table}\n${lines.join('\n')}\n`);
    continue;
  }

  // Columns written that do not exist
  const unknown = {};
  for (const w of list) {
    for (const k of w.keys) {
      if (!def.columns[k]) (unknown[k] = unknown[k] || []).push(`${w.file}:${w.line}`);
    }
  }
  for (const [col, sites] of Object.entries(unknown)) {
    lines.push(`  no such column: ${col}`);
    [...new Set(sites)].forEach(s => lines.push(`    ${s}`));
    problems++;
  }

  // NOT NULL columns with no default that inserts never supply
  const required = Object.entries(def.columns)
    .filter(([, c]) => !c.nullable && !c.hasDefault)
    .map(([name]) => name);
  for (const w of list.filter(x => x.op === 'insert' || x.op === 'upsert')) {
    // A payload passed as a variable, or a literal carrying a spread,
    // cannot be read statically. Reporting those as missing columns is
    // how a clean codebase ends up with dozens of phantom mismatches.
    if (w.unparsed || w.spread) continue;
    const missing = required.filter(r => !w.keys.includes(r));
    if (missing.length) {
      lines.push(`  ${w.op} missing NOT NULL: ${missing.join(', ')}`);
      lines.push(`    ${w.file}:${w.line}`);
      problems++;
    }
  }

  // Literal values that violate a CHECK
  for (const chk of def.checks) {
    const allowed = allowedValues(chk.definition);
    const col = checkColumn(chk.definition);
    if (!allowed || !col) continue;
    for (const w of list) {
      const raw = w.values[col];
      const value = literalString(raw);
      if (value === null) continue;
      if (!allowed.includes(value)) {
        lines.push(`  ${col} = '${value}' violates ${chk.constraint_name} (allowed: ${allowed.join(', ')})`);
        lines.push(`    ${w.file}:${w.line}`);
        problems++;
      }
    }
  }

  if (showUnused) {
    const written = new Set();
    list.forEach(w => w.keys.forEach(k => written.add(k)));
    const unused = Object.keys(def.columns).filter(c => !written.has(c));
    if (unused.length) lines.push(`  never written: ${unused.join(', ')}`);
  }

  if (lines.length) console.log(`${table}\n${lines.join('\n')}\n`);
}

// Storage buckets, since two apps spell one of them differently.
const buckets = schema.dump.buckets || [];
if (buckets.length) {
  console.log('storage buckets');
  buckets.forEach(b => console.log(`  ${b.id}  public=${b.public}`));
  console.log('');
}

// RLS posture at a glance.
const rls = schema.dump.rls || [];
const unprotected = rls.filter(r => !r.rls_enabled);
const noPolicies = rls.filter(r => r.rls_enabled && Number(r.policy_count) === 0);
if (rls.length) {
  console.log('row level security');
  console.log(`  RLS off: ${unprotected.length ? unprotected.map(r => r.tablename).join(', ') : 'none'}`);
  console.log(`  RLS on with no policies (deny all): ${noPolicies.length ? noPolicies.map(r => r.tablename).join(', ') : 'none'}`);
  console.log('');
}

console.log(problems === 0 ? 'No mismatches found.' : `${problems} mismatch(es) found.`);
process.exit(problems === 0 ? 0 : 1);
