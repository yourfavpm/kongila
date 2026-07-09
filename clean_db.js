const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const dbRaw = fs.readFileSync(dbPath, 'utf8');
const db = JSON.parse(dbRaw);

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const originalCount = db.talents.length;
db.talents = db.talents.filter(t => uuidRegex.test(t.id));
const removedCount = originalCount - db.talents.length;

// Also remove matches, contracts, etc for those deleted talents?
// If we want to be clean, yes. But the admin panel handles missing talent records gracefully in most cases, 
// though we can clean matches and contracts too.
if (db.matches) {
  db.matches = db.matches.filter(m => uuidRegex.test(m.talentId));
}
if (db.contracts) {
  db.contracts = db.contracts.filter(c => uuidRegex.test(c.talentId));
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`Cleaned up ${removedCount} fake talents. Remaining real talents: ${db.talents.length}`);
