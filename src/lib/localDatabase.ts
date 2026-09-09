import type { Resource, WorkspaceEvent } from "../shared/workspace";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ferriq-workspace", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("resources", { keyPath: "key" });
      db.createObjectStore("history", { keyPath: "id" });
      db.createObjectStore("events", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new Error(
          "Browser database is unavailable. Enable site storage to save local changes.",
        ),
      );
  });
}
const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function readLocal() {
  const db = await open();
  try {
    const tx = db.transaction(["resources", "events"], "readonly");
    const [resources, events] = await Promise.all([
      result(tx.objectStore("resources").getAll()),
      result(tx.objectStore("events").getAll()),
    ]);
    return {
      resources: resources as Resource[],
      events: (events as WorkspaceEvent[]).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    };
  } finally {
    db.close();
  }
}
export async function saveLocal(
  resource: Resource,
  expected: number,
  action: string,
) {
  return saveLocalBatch([{ resource, expected }], action);
}
/** One transaction prevents a backup conflict or quota failure from leaving a partial restore. */
export async function saveLocalBatch(
  entries: { resource: Resource; expected: number }[],
  action: string,
) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["resources", "history", "events"],
        "readwrite",
      );
      let error = "Could not save to browser storage. Check available space.";
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error(error));
      tx.onerror = () => {};
      const store = tx.objectStore("resources"),
        seen = new Set<string>();
      for (const { resource, expected } of entries) {
        if (seen.has(resource.key)) {
          error = "Duplicate resource: " + resource.key;
          tx.abort();
          return;
        }
        seen.add(resource.key);
        const req = store.get(resource.key);
        req.onsuccess = () => {
          const prior = req.result as Resource | undefined;
          if ((prior?.version ?? 1) !== expected) {
            error =
              "This resource changed in another tab. Reload its latest version before saving.";
            tx.abort();
            return;
          }
          const date = new Date().toISOString(),
            version = expected + 1,
            next = { ...resource, version, updatedAt: date };
          store.put(next);
          tx.objectStore("history").put({ ...next, id: crypto.randomUUID() });
          tx.objectStore("events").put({
            id: crypto.randomUUID(),
            resourceKey: resource.key,
            version,
            action,
            actor: "This browser",
            createdAt: date,
          });
        };
      }
    });
  } finally {
    db.close();
  }
}
export async function resetLocal(key: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["resources", "events"], "readwrite");
      tx.objectStore("resources").delete(key);
      tx.objectStore("events").put({
        id: crypto.randomUUID(),
        resourceKey: key,
        version: 0,
        action: "Restored published version",
        actor: "This browser",
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function localHistory(
  key: string,
): Promise<(Resource & { id: string })[]> {
  const db = await open();
  try {
    const all = await result(
      db.transaction("history", "readonly").objectStore("history").getAll(),
    );
    return all
      .filter((r) => r.key === key)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    db.close();
  }
}
