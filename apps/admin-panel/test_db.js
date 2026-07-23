import { readDbAsync } from '@kongila/database';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../kongila-web/.env.local' });

async function test() {
  try {
    const db = await readDbAsync();
    console.log("JSON Length:", JSON.stringify(db).length);
  } catch (err) {
    console.error("FAILED with error:", err);
  }
}
test();
