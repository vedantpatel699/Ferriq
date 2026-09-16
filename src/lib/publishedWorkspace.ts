import { z } from "zod";
import { validateResource, type Resource } from "../shared/workspace";

const resourceSchema = z.object({
  key: z.string(),
  version: z.number().int().positive(),
  updatedAt: z.string(),
  data: z.unknown(),
});
export function validateResources(input: unknown): Resource[] {
  const resources = z.array(resourceSchema).parse(input);
  if (new Set(resources.map((r) => r.key)).size !== resources.length)
    throw Error("Duplicate workspace resources.");
  return resources.map((r) => ({
    ...r,
    data: validateResource(r.key, r.data),
  }));
}
let baseRequest:
  Promise<{ revision: string; resources: Resource[] }> | undefined;
let modelRequest: Promise<unknown> | undefined;
async function fetchJson(path: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("Published workspace could not be loaded.");
  return response.json();
}
export function readPublished() {
  return (baseRequest ??= fetchJson("workspace.json")
    .then((input) => {
      const base = z
        .object({ revision: z.string().min(1), resources: z.unknown() })
        .parse(input);
      const resources = validateResources(base.resources);
      for (const key of [
        "settings",
        "economics",
        "air-blower",
        "fired-heater",
        "shell-tube-exchanger",
        "membrane-analyzer",
      ])
        if (!resources.some((r) => r.key === key))
          throw Error(`Published workspace is missing ${key}.`);
      return { revision: base.revision, resources };
    })
    .catch((error) => {
      baseRequest = undefined;
      throw error;
    }));
}
export function readPublishedModel() {
  return (modelRequest ??= fetchJson("furnace-skin-temp-model.json")
    .then((data) => validateResource("furnace-model", data))
    .catch((error) => {
      modelRequest = undefined;
      throw error;
    }));
}
