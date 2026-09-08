import { readFile, writeFile, mkdir } from "node:fs/promises";
import { validateResource, type Resource } from "../src/shared/workspace";
const path = process.argv[2];
if (!path)
  throw Error("Usage: npm run data:import -- path/to/ferriq-workspace.json");
const backup = JSON.parse(await readFile(path, "utf8"));
if (backup.format !== "ferriq-workspace-v1" || !Array.isArray(backup.resources))
  throw Error("Expected Ferriq workspace backup.");
const resources: Resource[] = backup.resources;
const seen = new Set<string>();
const validated = resources.map((r) => {
  if (seen.has(r.key)) throw Error("Duplicate resource");
  seen.add(r.key);
  return { ...r, data: validateResource(r.key, r.data) };
});
await mkdir("reference", { recursive: true });
await writeFile(
  "reference/workspace-overrides.json",
  JSON.stringify(validated, null, 2),
);
console.log(
  "Validated repository draft written. Review the diff, run build/tests, then commit to publish.",
);
