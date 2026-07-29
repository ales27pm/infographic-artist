import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const validate = fileURLToPath(new URL("validate-site.mjs", import.meta.url));
const result = spawnSync(process.execPath, [validate, "--require-production"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log("Production site build gate passed");
