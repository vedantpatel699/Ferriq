import { createElement, type ReactNode } from "react";
import manuals from "../reference/manuals.json";
type Node = string | { tag: string; children: Node[]; href?: string };
function render(node: Node, key: number): ReactNode {
  if (typeof node === "string") return node;
  return createElement(
    node.tag,
    {
      key,
      ...(node.href
        ? { href: node.href, target: "_blank", rel: "noreferrer" }
        : {}),
    },
    ...node.children.map(render),
  );
}
export function ReferenceManual({ id }: { id: string }) {
  const nodes = (manuals as unknown as Record<string, Node[]>)[id] ?? [];
  return (
    <article className="reference-manual">
      <h2>Engineering manual & sources</h2>
      <p className="source-note">
        Preserved from the original HTML reference. Configuration and
        observation dates in the current workspace are shown separately.
        Reference limits are not operating instructions.
      </p>
      {nodes.map(render)}
    </article>
  );
}
