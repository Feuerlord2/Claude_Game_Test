// Safe localStorage wrapper — survives Safari private mode / disabled storage.

import { STORAGE_PREFIX } from './config.js';

const memory = new Map();
let usable = true;
try {
  const k = STORAGE_PREFIX + '__probe';
  localStorage.setItem(k, '1');
  localStorage.removeItem(k);
} catch {
  usable = false;
}

export const Storage = {
  get(key, fallback = null) {
    try {
      const raw = usable ? localStorage.getItem(STORAGE_PREFIX + key) : memory.get(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      const raw = JSON.stringify(value);
      if (usable) localStorage.setItem(STORAGE_PREFIX + key, raw);
      else memory.set(key, raw);
    } catch { /* quota/denied — keep playing without persistence */ }
  },

  remove(key) {
    try {
      if (usable) localStorage.removeItem(STORAGE_PREFIX + key);
      else memory.delete(key);
    } catch { /* ignore */ }
  },
};
