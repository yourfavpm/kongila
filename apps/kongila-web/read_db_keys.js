const fs = require('fs');

const dbPath = '/Users/oluwadammilola/benita/kongila/db.json';
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log('Top level keys:', Object.keys(db));
  for (const key of Object.keys(db)) {
    if (Array.isArray(db[key])) {
      console.log(`- ${key}: length = ${db[key].length}`);
      if (db[key].length > 0) {
        console.log(`  Sample ${key}[0]:`, JSON.stringify(db[key][0], null, 2));
      }
    } else {
      console.log(`- ${key}:`, typeof db[key]);
    }
  }
} else {
  console.log('db.json not found!');
}
