'use strict';

/* deterministic hash for the demo year (kept local so the engine's stays private) */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export async function fetchContributions(user) {
  const res = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.contributions || !json.contributions.length) throw new Error('empty');
  return json.contributions.map(c => ({ date: c.date, count: c.count, level: c.level }));
}

/* A believable year of demo data: weekday rhythm, bursts, quiet stretches. */
export function demoContributions() {
  const days = [];
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 364);
  let burst = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    if (hash(i * 3.7) < 0.03) burst = 4 + Math.floor(hash(i * 9.1) * 8);
    let p = weekend ? 0.22 : 0.72;
    p *= 0.7 + 0.3 * Math.sin(i / 58 + 1.2);
    if (hash(i * 1.3) < 0.05) p = 0;
    let count = 0;
    if (hash(i * 5.9) < p) {
      count = 1 + Math.floor(Math.pow(hash(i * 7.3), 2) * 9);
      if (burst > 0) { count += 3 + Math.floor(hash(i * 2.2) * 6); burst--; }
    }
    const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
    days.push({ date: d.toISOString().slice(0, 10), count, level });
  }
  return days;
}

export function computeStats(days) {
  let total = 0, streak = 0, best = 0;
  for (const d of days) {
    total += d.count;
    if (d.count > 0) { streak++; best = Math.max(best, streak); } else streak = 0;
  }
  return { total, streak: best };
}
