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

const KEY_SETTINGS = 'xf_settings_v1';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSettings(patch) {
  const cur = loadSettings();
  const next = { ...cur, ...patch };
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(next));
  return next;
}
