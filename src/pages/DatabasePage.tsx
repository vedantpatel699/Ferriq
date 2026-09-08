import { useState } from "react";
import { useWorkspace } from "../lib/WorkspaceContext";
import { downloadFile } from "../lib/files";
import { DataTable } from "../components/DataTable";
import { validateResource, type Resource } from "../shared/workspace";
export function DatabasePage() {
  const { snapshot, save } = useWorkspace();
  const [pending, setPending] = useState<Resource[]>([]),
    [note, setNote] = useState("");
  return (
    <>
      <h1>Database & change log</h1>
      <p>
        GitHub Pages serves one versioned published dataset to everyone.
        IndexedDB stores edits in this browser and synchronizes open tabs.
        Cross-device changes require exporting and publishing a reviewed
        repository update; there is no shared write server.
      </p>
      <p>Published revision: {snapshot.workspace.id}</p>
      <div className="action-bar">
        <button
          onClick={() =>
            downloadFile(
              "ferriq-workspace.json",
              JSON.stringify(
                {
                  format: "ferriq-workspace-v1",
                  revision: snapshot.workspace.id,
                  resources: snapshot.resources,
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          Export workspace backup
        </button>
      </div>
      <label>
        Import workspace backup
        <input
          type="file"
          accept=".json"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 32 * 1024 * 1024)
                throw Error("Maximum backup size is 32 MB.");
              const parsed = JSON.parse(await file.text());
              if (
                parsed.format !== "ferriq-workspace-v1" ||
                !Array.isArray(parsed.resources)
              )
                throw Error("Expected a Ferriq workspace backup.");
              const seen = new Set();
              const resources = parsed.resources.map((r: Resource) => {
                if (seen.has(r.key))
                  throw Error("Duplicate resource: " + r.key);
                seen.add(r.key);
                return { ...r, data: validateResource(r.key, r.data) };
              });
              setPending(resources);
              setNote("Validated. Review the resource list before applying.");
            } catch (e) {
              setPending([]);
              setNote((e as Error).message);
            }
          }}
        />
      </label>
      {pending.length > 0 && (
        <>
          <p>{pending.map((r) => r.key).join(", ")}</p>
          <button
            onClick={async () => {
              try {
                for (const r of pending)
                  await save(
                    r.key,
                    r.data,
                    "backup import",
                    snapshot.resources.find((v) => v.key === r.key)?.version,
                  );
                setPending([]);
                setNote("Backup applied locally.");
              } catch (e) {
                setNote((e as Error).message);
              }
            }}
          >
            Apply backup locally
          </button>
          <button onClick={() => setPending([])}>Cancel</button>
        </>
      )}
      {note && <p role="status">{note}</p>}
      <DataTable
        rows={snapshot.resources.map(({ key, version, updatedAt }) => ({
          key,
          version,
          updatedAt,
        }))}
        caption="Resource versions"
      />
      <DataTable
        rows={snapshot.events.map((e) => ({ ...e }))}
        caption="Local change log"
      />
    </>
  );
}
