// SentinelOS 06F: versioned, per-project browser persistence (IndexedDB).
// IndexedDB stores structured-clone objects, including Uint8Array XER source bytes.
const DB_NAME = 'sentinel-cost-loading-workspaces';
const STORE = 'projects';
const VERSION = 1;
function database() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable in this browser.')); return; }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'key'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open project database.'));
    request.onblocked = () => reject(new Error('Project database is blocked by another tab.'));
  });
}
async function transact(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = operation(tx.objectStore(STORE));
      let result;
      req.onsuccess = () => {result=req.result;};
      req.onerror = () => reject(req.error || new Error('Storage request failed.'));
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Storage transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
    });
  } finally { db.close(); }
}
export const workspaceKey = project => `sentinel-06f:${String(project||'Unassigned project').trim()}`;
export const readWorkspace = key => transact('readonly', store => store.get(key));
export const writeWorkspace = (key, data) => transact('readwrite', store => store.put({key, version:1, savedAt:new Date().toISOString(), data}));
