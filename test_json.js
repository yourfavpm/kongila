import { readDbAsync } from './packages/database/index.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'apps/kongila-web/.env.local' });

async function test() {
  try {
    const db = await readDbAsync();
    const str = JSON.stringify(db);
    console.log("JSON Length:", str.length);
  } catch (err) {
    console.error("FAILED stringify:", err);
  }
}
test();
