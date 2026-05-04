#!/usr/bin/env node
import dotenv from "dotenv";
import os from "os";
import path from "path";

const homeDir = os.homedir();
const nodeVersion = process.version;

const envPath = path.join(homeDir, ".nvm", "versions", "node", nodeVersion, "lib", "node_modules", "alicewiki", ".env");

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
