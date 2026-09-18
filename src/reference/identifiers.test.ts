import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Plant equipment/instrument identifiers must not return in shipped data or client files.
const plantIdentifier =
  /\b(?:C|H|E|M)-\d{3}[A-Z]?(?:\/B)?\b|\b\d{4,6}-(?:PI|TI|FIC|PIC|HS|VI|PDI|IT)-[\w./]+|\b(?:BL|BU)301[A-Z]?\b/;
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.(json|ts|tsx|py|md|html|csv)$/.test(path)
        ? [path]
        : [];
  });
}
describe("generic model identities", () => {
  it("contains no plant equipment or historian identifiers in source, data or deliverables", () => {
    const matches = [
      "src",
      "public/data",
      "reference",
      "python",
      "submission/sudhakar",
    ]
      .flatMap(files)
      .filter((path) => plantIdentifier.test(readFileSync(path, "utf8")));
    expect(matches).toEqual([]);
  });
});
