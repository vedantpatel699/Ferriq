import { writeFileSync } from "node:fs";
import { engineeringManuals } from "../src/reference/engineeringManuals";
const lines = [
  "# Ferriq engineering manual",
  "",
  "Inputs, calculations and trends for the six models.",
  "",
];
for (const manual of Object.values(engineeringManuals)) {
  lines.push(
    `## ${manual.title}`,
    "",
    manual.purpose,
    "",
    "### Inputs and units",
    "",
    "| Input | Unit | Use |",
    "|---|---|---|",
  );
  for (const input of manual.inputs) lines.push(`| ${input.join(" | ")} |`);
  lines.push("", "### Calculations", "");
  for (const [name, formula, note] of manual.calculations)
    lines.push(`**${name}:** ${formula}`, "", note, "");
  for (const [heading, values] of [
    ["Useful trends", manual.trends],
    ["Assumptions and limits", manual.limits],
  ] as const)
    lines.push(
      `### ${heading}`,
      "",
      ...values.map((value) => `- ${value}`),
      "",
    );
  lines.push(
    "### Sources",
    "",
    ...manual.sources.map(
      ([label, url]) => `- ${url ? `[${label}](${url})` : label}`,
    ),
    "",
  );
}
writeFileSync("ENGINEERING-MANUAL.md", lines.join("\n"));
