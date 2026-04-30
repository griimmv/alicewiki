import "dotenv/config";
import { startCLI, handleInput } from "./cli.ts";
async function main() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const query = args.join(" ");
        await handleInput(query);
        process.exit(0);
    }
    else {
        startCLI();
    }
}
main();
//# sourceMappingURL=index.js.map