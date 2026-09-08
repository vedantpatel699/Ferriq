import {
  defaultResources,
  validateResource,
  type Resource,
} from "../src/shared/workspace";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const data = defaultResources();
let overrides: Resource[] = [];
try {
  overrides = JSON.parse(
    await readFile("reference/workspace-overrides.json", "utf8"),
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
for (const r of overrides) {
  const validated = validateResource(r.key, r.data);
  if (r.key === "furnace-model")
    await writeFile(
      "public/data/furnace-skin-temp-model.json",
      JSON.stringify(validated),
    );
  else data[r.key] = validated;
}
const revision = createHash("sha256")
  .update(JSON.stringify(data))
  .update(await readFile("public/data/furnace-skin-temp-model.json"))
  .digest("hex")
  .slice(0, 12);
const resources = Object.entries(data).map(([key, data]) => ({
  key,
  data,
  version: 1,
  updatedAt: "Published reference " + revision,
}));
await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/workspace.json",
  JSON.stringify({ revision, resources }),
);
console.log("Published workspace", revision);
