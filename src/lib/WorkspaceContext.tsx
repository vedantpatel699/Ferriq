import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  validateResource,
  type Resource,
  type WorkspaceSnapshot,
} from "../shared/workspace";
import {
  readLocal,
  saveLocal,
  saveLocalBatch,
  resetLocal,
  localHistory,
} from "./localDatabase";
let publishedRequest:
  Promise<{ revision: string; resources: Resource[] }> | undefined;
function readPublished() {
  return (publishedRequest ??= Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/workspace.json`),
    fetch(`${import.meta.env.BASE_URL}data/furnace-skin-temp-model.json`),
  ])
    .then(async ([response, model]) => {
      if (!response.ok || !model.ok)
        throw Error("Published workspace could not be loaded.");
      const base = (await response.json()) as {
        revision: string;
        resources: Resource[];
      };
      return {
        ...base,
        resources: [
          ...base.resources,
          {
            key: "furnace-model",
            version: 1,
            data: await model.json(),
            updatedAt: base.revision,
          },
        ],
      };
    })
    .catch((e) => {
      publishedRequest = undefined;
      throw e;
    }));
}
const Context = createContext<WorkspaceContextValue | null>(null);
type WorkspaceContextValue = {
  snapshot: WorkspaceSnapshot;
  published: Resource[];
  save: (
    key: string,
    data: unknown,
    action?: string,
    expectedVersion?: number,
  ) => Promise<void>;
  importResources: (resources: Resource[]) => Promise<void>;
  refresh: () => Promise<void>;
  reset: (key: string) => Promise<void>;
  history: typeof localHistory;
};
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw Error("Workspace unavailable");
  return ctx;
}
export function useResource<T>(key: string): { data: T; version: number } {
  const { snapshot } = useWorkspace();
  const r = snapshot.resources.find((r) => r.key === key);
  if (!r) throw Error(`Resource ${key} unavailable`);
  return r as { data: T; version: number };
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null),
    [published, setPublished] = useState<Resource[]>([]),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const base = await readPublished();
      const local = await readLocal();
      const resources = base.resources.map(
        (r) => local.resources.find((d) => d.key === r.key) ?? r,
      );
      setPublished(base.resources);
      setSnapshot({
        workspace: { id: base.revision, name: "Published reference workspace" },
        user: { email: "This browser", role: "editor" },
        resources,
        events: local.events,
      });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const channel = new BroadcastChannel("ferriq-workspace");
    channel.onmessage = () => void refresh();
    return () => channel.close();
  }, [refresh]);
  async function save(
    key: string,
    data: unknown,
    action = "configuration",
    expectedVersion?: number,
  ) {
    const validated = validateResource(key, data);
    const resource = snapshot?.resources.find((r) => r.key === key);
    if (!resource) throw Error("Resource unavailable");
    await saveLocal(
      { ...resource, data: validated },
      expectedVersion ?? resource.version,
      action,
    );
    const channel = new BroadcastChannel("ferriq-workspace");
    channel.postMessage("changed");
    channel.close();
    await refresh();
  }
  if (!snapshot)
    return (
      <main className="standalone">
        <h1>Ferriq</h1>
        <p role="status">{error || "Loading published workspace…"}</p>
        {error && <button onClick={() => void refresh()}>Retry</button>}
      </main>
    );
  return (
    <Context.Provider
      value={{
        snapshot,
        published,
        save,
        refresh,
        reset: async (key) => {
          await resetLocal(key);
          await refresh();
          const channel = new BroadcastChannel("ferriq-workspace");
          channel.postMessage("changed");
          channel.close();
        },
        importResources: async (resources) => {
          const entries = resources.map((r) => {
            const current = snapshot.resources.find((v) => v.key === r.key);
            if (!current) throw Error("Unknown resource: " + r.key);
            return {
              resource: { ...current, data: validateResource(r.key, r.data) },
              expected: current.version,
            };
          });
          await saveLocalBatch(entries, "backup import");
          const channel = new BroadcastChannel("ferriq-workspace");
          channel.postMessage("changed");
          channel.close();
          await refresh();
        },
        history: localHistory,
      }}
    >
      {error && (
        <div role="alert" className="service-error">
          {error} Showing the last loaded version.
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
