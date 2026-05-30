#!/usr/bin/env node
import { startCLI, handleInput } from "./cli.js";
import { runOneLiner } from "./one-liner.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const query = args.join(" ");
    await runOneLiner(query);
    process.exit(0);
  } else {
    startCLI();
  }
}

main();
