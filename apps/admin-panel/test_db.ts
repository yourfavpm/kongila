import { readDbAsync } from '@kongila/database';

async function test() {
  try {
    const db = await readDbAsync();
    console.log("DB TALENTS:", db.talents.length);
  } catch(e) {
    console.error("CRASH:", e);
  }
}
test();
