#!/usr/bin/env bun
import { startCLI, handleInput } from "./cli.ts";
import { runOneLiner } from "./one-liner.ts";

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
