import { readDbAsync } from '@kongila/database';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

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
