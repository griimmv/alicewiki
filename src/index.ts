#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath });

import { startCLI, handleInput } from "./cli.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const query = args.join(" ");
    await handleInput(query);
    process.exit(0);
  } else {
    startCLI();
  }
}

main();
