const KEY_WATCH = 'xf_watch_list_v1';

export function loadWatchList() {
  try {
    const raw = localStorage.getItem(KEY_WATCH);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveWatchList(list) {
  localStorage.setItem(KEY_WATCH, JSON.stringify(list));
}
