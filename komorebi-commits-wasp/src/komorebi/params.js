'use strict';

/* URL param scheme shared by the main page's address bar, share links,
   and gallery deep links: ?user=<handle> plus any non-default prefs. */

import { PREF_DEFS, clampPref, defaultPrefs } from './engine.js';

export function prefsFromSearch(search) {
  const params = new URLSearchParams(search);
  const prefs = defaultPrefs();
  for (const name of Object.keys(PREF_DEFS)) {
    if (params.has(name)) {
      const v = parseFloat(params.get(name));
      if (Number.isFinite(v)) prefs[name] = clampPref(name, v);
    }
  }
  return prefs;
}

export function buildSearch(user, prefs) {
  const params = new URLSearchParams();
  if (user) params.set('user', user);
  for (const [name, d] of Object.entries(PREF_DEFS)) {
    if (Math.abs(prefs[name] - d.def) > 1e-9) params.set(name, prefs[name]);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
