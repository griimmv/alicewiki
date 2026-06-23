#!/usr/bin/env bun
import { config } from "dotenv";
import { resolve } from "path";
import { runOneLiner } from "./one-liner.ts";
import { startTUI } from "./tui.tsx";

async function main() {
  config({ path: resolve(import.meta.dir, "../.env") });

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
