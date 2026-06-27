#!/usr/bin/env bun
import { initDB } from "./db.ts";
import { runOneLiner } from "./one-liner.ts";
import { startTUI } from "./tui.tsx";

async function main() {
  initDB();

  const args = process.argv.slice(2);

  if (args.length > 0) {
    const query = args.join(" ");
    await runOneLiner(query);
    process.exit(0);
  } else {
    await startTUI();
  }
}

main();
