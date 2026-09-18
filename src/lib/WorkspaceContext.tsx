import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  validateResource,
  type Resource,
  type WorkspaceSnapshot,
} from "../shared/workspace";
import { readLocal, saveLocal, resetLocal } from "./localDatabase";
import {
  readPublished,
  readPublishedModel,
  validateResources,
} from "./publishedWorkspace";
function openChannel() {
  try {
    return typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel("ferriq-workspace");
  } catch {
    return undefined;
  }
}
function notifyTabs() {
  const channel = openChannel();
  try {
    channel?.postMessage("changed");
  } catch {
    /* Local persistence still succeeds if cross-tab messaging is blocked. */
  } finally {
    channel?.close();
  }
}
const Context = createContext<WorkspaceContextValue | null>(null);
type WorkspaceContextValue = {
  snapshot: WorkspaceSnapshot;
  published: Resource[];
  readOnly: boolean;
  error: string;
  modelStatus: "loading" | "ready" | "error";
  retryModel: () => Promise<void>;
  save: (
    key: string,
    data: unknown,
    action?: string,
    expectedVersion?: number,
  ) => Promise<void>;
  refresh: () => Promise<void>;
  reset: (key: string) => Promise<void>;
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
    [error, setError] = useState(""),
    [readOnly, setReadOnly] = useState(false),
    [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">(
      "loading",
    );
  const model = useRef<unknown>(undefined);
  const lastSnapshot = useRef<WorkspaceSnapshot | null>(null);
  const refreshId = useRef(0);
  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    try {
      const base = await readPublished();
      const publishedResources: Resource[] = model.current
        ? [
            ...base.resources,
            {
              key: "furnace-model",
              version: 1,
              data: model.current,
              updatedAt: base.revision,
            },
          ]
        : base.resources;
      let local: Awaited<ReturnType<typeof readLocal>>;
      let storageError = false;
      try {
        local = await readLocal();
        local.resources = validateResources(local.resources);
      } catch {
        storageError = true;
        // Preserve already-loaded local edits if storage fails during this session.
        local = {
          resources: lastSnapshot.current?.resources ?? [],
          events: lastSnapshot.current?.events ?? [],
        };
      }
      if (requestId !== refreshId.current) return;
      const resources = publishedResources.map(
        (r) => local.resources.find((d) => d.key === r.key) ?? r,
      );
      const localModel = local.resources.find((r) => r.key === "furnace-model");
      if (localModel && !resources.some((r) => r.key === "furnace-model"))
        resources.push(localModel);
      setPublished(publishedResources);
      const next: WorkspaceSnapshot = {
        workspace: { id: base.revision, name: "Published reference workspace" },
        user: {
          email: "This browser",
          role: storageError ? "viewer" : "editor",
        },
        resources,
        events: local.events,
      };
      lastSnapshot.current = next;
      setSnapshot(next);
      setReadOnly(storageError);
      setError("");
    } catch (e) {
      if (requestId === refreshId.current)
        setError(
          "Published workspace could not be loaded. " + (e as Error).message,
        );
    }
  }, []);
  const retryModel = useCallback(async () => {
    setModelStatus("loading");
    try {
      model.current = await readPublishedModel();
      await refresh();
      setModelStatus("ready");
    } catch {
      setModelStatus("error");
    }
  }, [refresh]);
  useEffect(() => {
    void refresh();
    void retryModel();
    const channel = openChannel();
    if (!channel) return;
    channel.onmessage = () => void refresh();
    return () => channel.close();
  }, [refresh, retryModel]);
  function requireStorage() {
    if (readOnly)
      throw Error(
        "Read-only mode: restore browser storage before saving changes.",
      );
  }
  async function save(
    key: string,
    data: unknown,
    action = "configuration",
    expectedVersion?: number,
  ) {
    requireStorage();
    const validated = validateResource(key, data);
    const resource = snapshot?.resources.find((r) => r.key === key);
    if (!resource) throw Error("Resource unavailable");
    await saveLocal(
      { ...resource, data: validated },
      expectedVersion ?? resource.version,
      action,
    );
    notifyTabs();
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
        readOnly,
        error,
        modelStatus,
        retryModel,
        save,
        refresh,
        reset: async (key) => {
          requireStorage();
          await resetLocal(key);
          await refresh();
          notifyTabs();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function WorkspaceNotices() {
  const { readOnly, error, refresh, modelStatus, retryModel, snapshot } =
    useWorkspace();
  return (
    <>
      {readOnly && (
        <div className="advanced-panel" role="status">
          <p>
            Read-only mode: browser storage is unavailable or its saved data
            could not be read. Showing published data or the last loaded local
            version. Existing saved data have not been deleted. Saving and
            restoring are disabled.
          </p>
          <button onClick={() => void refresh()}>Retry browser storage</button>
        </div>
      )}
      {error && (
        <div className="advanced-panel" role="alert">
          {error} Showing the last loaded version.{" "}
          <button onClick={() => void refresh()}>Retry workspace</button>
        </div>
      )}
      {modelStatus !== "ready" && (
        <div className="advanced-panel" role="status">
          <p>
            {snapshot.resources.some((r) => r.key === "furnace-model")
              ? "Using the saved local predictor model. "
              : ""}
            {modelStatus === "loading"
              ? "Loading the published predictor model. Other dashboards are available."
              : "The published predictor model is unavailable. Other dashboards remain available."}
          </p>
          {modelStatus === "error" && (
            <button onClick={() => void retryModel()}>
              Retry predictor model
            </button>
          )}
        </div>
      )}
    </>
  );
}
