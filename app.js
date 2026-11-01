/* Dayblock — personal planner: time blocks, to-dos, repeats, time tracking and insights.
   Data is kept in localStorage (one key per account); auth.js syncs it to the cloud when signed in. */
(() => {
  'use strict';

  // ---------- Constants ----------
  const GUEST_KEY = 'dayblock:v1';
  const HOUR_H = 64;   // pixel height of one hour; matches --hour-h in styles.css
  const SNAP = 15;     // minutes; drag and resize snap to this
  const TASK_MIME = 'application/x-dayblock-task';
  const CATEGORIES = [
    { id: 'work', name: 'Work' },
    { id: 'personal', name: 'Personal' },
    { id: 'health', name: 'Health' },
    { id: 'learning', name: 'Learning' },
    { id: 'break', name: 'Break' },
    { id: 'other', name: 'Other' },
  ];
  const CAT_IDS = CATEGORIES.map(c => c.id);
  const PRIORITIES = { high: 'High', med: 'Medium', low: 'Low' };
  const PRIORITY_RANK = { high: 0, med: 1, low: 2 };
  const REPEAT_FREQS = { daily: 'Daily', weekdays: 'Every weekday', weekly: 'Weekly', monthly: 'Monthly' };
  const VIEWS = {
    timeblock: [['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
    todo: [['list', 'List'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
    insights: [['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
    vision: [['board', 'Vision'], ['goals', 'Goals'], ['journal', 'Journal']],
  };
  const LIST_VIEWS = ['list', 'board', 'goals']; // views without date navigation
  const LIFE_AREAS = [
    { id: 'health', name: 'Health', emoji: '💪', cat: 'health' },
    { id: 'career', name: 'Career', emoji: '💼', cat: 'work' },
    { id: 'money', name: 'Money', emoji: '💰', cat: 'learning' },
    { id: 'love', name: 'Love', emoji: '❤️', cat: 'personal' },
    { id: 'family', name: 'Family & friends', emoji: '🤝', cat: 'break' },
    { id: 'growth', name: 'Growth', emoji: '🌱', cat: 'health' },
    { id: 'fun', name: 'Fun', emoji: '🎉', cat: 'personal' },
    { id: 'purpose', name: 'Purpose', emoji: '✨', cat: 'other' },
  ];
  const AREA_IDS = LIFE_AREAS.map(a => a.id);
  const areaOf = id => LIFE_AREAS.find(a => a.id === id) || LIFE_AREAS[5];
  const HORIZONS = [['life', 'Lifetime'], ['5y', 'In 5 years'], ['year', 'This year'], ['quarter', 'Next 90 days']];
  const MOODS = [['😞', 'Rough'], ['😕', 'Low'], ['😐', 'Okay'], ['🙂', 'Good'], ['😄', 'Great']];
  const svg = (inner, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    calendar: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 2.2),
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>',
    repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  };

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const snap = m => Math.round(m / SNAP) * SNAP;
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const addMonths = (iso, n) => {
    const d = fromISO(iso);
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d.getDate(), last));
    return toISO(t);
  };
  const dayNum = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const dowOf = iso => fromISO(iso).getDay();
  const datesBetween = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
  const isoToTs = (iso, min = 0) => { const d = fromISO(iso); d.setMinutes(min); return d.getTime(); };
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const overlap = (s, e, a, b) => Math.max(0, Math.min(e, b) - Math.max(s, a));

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
  const DOW_SHORT = range(0, 6).map(i => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' })); // Jan 1 2023 = Sunday
  const fmtTime = min => timeFmt.format(new Date(2000, 0, 1, 0, min));
  const fmtTs = ts => timeFmt.format(new Date(ts));
  const fmtHour = h => hourFmt.format(new Date(2000, 0, 1, h));
  const fmtDur = minutes => {
    const min = Math.round(minutes);
    const h = Math.floor(min / 60), m = min % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  };
  const fmtClock = ms => {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  };
  const toHHMM = min => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
  const fromHHMM = s => { if (!/^\d{1,2}:\d{2}/.test(s || '')) return NaN; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fmtShortDate = iso => fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  function relDay(iso) {
    const t = todayISO();
    if (iso === t) return 'Today';
    if (iso === addDays(t, 1)) return 'Tomorrow';
    if (iso === addDays(t, -1)) return 'Yesterday';
    return null;
  }
  const dayLabel = iso => relDay(iso) || fmtShortDate(iso);

  // ---------- Repeat rules ----------
  function normRepeat(r) {
    if (!r || !REPEAT_FREQS[r.freq]) return null;
    return {
      freq: r.freq,
      interval: clamp(parseInt(r.interval, 10) || 1, 1, 99),
      days: Array.isArray(r.days) ? [...new Set(r.days.map(Number).filter(d => d >= 0 && d <= 6))] : [],
      until: isISO(r.until) ? r.until : '',
    };
  }

  // Does a rule that started on `start` produce an occurrence on `date`?
  function ruleMatches(r, start, date) {
    if (date < start) return false;
    if (r.until && date > r.until) return false;
    const iv = r.interval || 1;
    const diff = dayNum(date) - dayNum(start);
    switch (r.freq) {
      case 'daily': return diff % iv === 0;
      case 'weekdays': { const d = dowOf(date); return d >= 1 && d <= 5; }
      case 'weekly': {
        const days = r.days.length ? r.days : [dowOf(start)];
        if (!days.includes(dowOf(date))) return false;
        const week = iso => Math.floor((dayNum(iso) - ((dowOf(iso) + 6) % 7)) / 7);
        return (week(date) - week(start)) % iv === 0;
      }
      case 'monthly': {
        const a = fromISO(start), b = fromISO(date);
        if (b.getDate() !== a.getDate()) return false;
        return (((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()) % iv) === 0;
      }
    }
    return false;
  }

  function nextOccurrence(r, start, after) {
    let d = after;
    for (let i = 0; i < 1200; i++) {
      d = addDays(d, 1);
      if (r.until && d > r.until) return null;
      if (ruleMatches(r, start, d)) return d;
    }
    return null;
  }

  function orderedDays(days) {
    const ws = state.settings.weekStart;
    return [...days].sort((a, b) => ((a - ws + 7) % 7) - ((b - ws + 7) % 7));
  }

  function describeRepeat(r, start) {
    if (!r) return '';
    const iv = r.interval;
    let s;
    if (r.freq === 'daily') s = iv === 1 ? 'Every day' : `Every ${iv} days`;
    else if (r.freq === 'weekdays') s = 'Every weekday';
    else if (r.freq === 'weekly') {
      const days = r.days.length ? r.days : (start ? [dowOf(start)] : []);
      s = (iv === 1 ? 'Every week' : `Every ${iv} weeks`) + (days.length ? ' on ' + orderedDays(days).map(d => DOW_SHORT[d]).join(', ') : '');
    } else {
      s = (iv === 1 ? 'Every month' : `Every ${iv} months`) + (start ? ` on day ${fromISO(start).getDate()}` : '');
    }
    if (r.until) s += `, until ${fmtShortDate(r.until)}`;
    return s;
  }

  // ---------- State & storage ----------
  const defaultSettings = { mode: 'timeblock', tbView: 'day', todoView: 'list', insView: 'week', visView: 'board', dayStart: 0, dayEnd: 24, weekStart: 1, theme: 'auto', fullDay: true };

  function normalizeVision(v) {
    v = v && typeof v === 'object' ? v : {};
    const arr = x => (Array.isArray(x) ? x : []);
    const journal = {};
    if (v.journal && typeof v.journal === 'object') {
      for (const [date, j] of Object.entries(v.journal)) {
        if (!isISO(date) || !j || typeof j !== 'object') continue;
        journal[date] = {
          mood: Number.isInteger(j.mood) && j.mood >= 0 && j.mood < MOODS.length ? j.mood : null,
          gratitude: [0, 1, 2].map(i => String(arr(j.gratitude)[i] || '')),
          intention: String(j.intention || ''),
          script: String(j.script || ''),
          notes: String(j.notes || ''),
        };
      }
    }
    return {
      statement: String(v.statement || ''),
      affirmations: arr(v.affirmations).filter(a => a && a.id && typeof a.text === 'string'),
      board: arr(v.board).filter(t => t && t.id && typeof t.text === 'string')
        .map(t => ({ id: t.id, text: t.text, emoji: String(t.emoji || '✨'), area: AREA_IDS.includes(t.area) ? t.area : 'purpose' })),
      areas: Object.fromEntries(LIFE_AREAS.map(a => [a.id, clamp(parseInt(v.areas?.[a.id], 10) || 5, 1, 10)])),
      goals: arr(v.goals).filter(g => g && g.id && typeof g.title === 'string').map(g => ({
        id: g.id,
        title: g.title,
        area: AREA_IDS.includes(g.area) ? g.area : 'growth',
        horizon: HORIZONS.some(h => h[0] === g.horizon) ? g.horizon : 'year',
        target: isISO(g.target) ? g.target : '',
        why: String(g.why || ''),
        status: g.status === 'done' ? 'done' : 'active',
        created: Number(g.created) || Date.now(),
        doneAt: Number(g.doneAt) || null,
        milestones: arr(g.milestones).filter(m => m && m.id).map(m => ({
          id: m.id, title: String(m.title || ''), done: !!m.done, taskId: typeof m.taskId === 'string' ? m.taskId : undefined,
        })),
      })),
      journal,
    };
  }

  function normalize(d) {
    const s = { ...defaultSettings, ...(d && typeof d.settings === 'object' ? d.settings : {}) };
    // Older versions defaulted to 6 AM–11 PM; move anyone still on that default to the full 24 hours once.
    if (!d?.settings?.fullDay) {
      if (+s.dayStart === 6 && +s.dayEnd === 23) { s.dayStart = 0; s.dayEnd = 24; }
      s.fullDay = true;
    }
    s.dayStart = clamp(parseInt(s.dayStart, 10) || 0, 0, 23);
    s.dayEnd = clamp(parseInt(s.dayEnd, 10) || 24, s.dayStart + 1, 24);
    s.weekStart = Number(s.weekStart) === 0 ? 0 : 1;
    if (!VIEWS[s.mode]) s.mode = 'timeblock';
    if (!VIEWS.timeblock.some(v => v[0] === s.tbView)) s.tbView = 'day';
    if (!VIEWS.todo.some(v => v[0] === s.todoView)) s.todoView = 'list';
    if (!VIEWS.insights.some(v => v[0] === s.insView)) s.insView = 'week';
    if (!VIEWS.vision.some(v => v[0] === s.visView)) s.visView = 'board';
    if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = 'auto';

    const blocks = (Array.isArray(d?.blocks) ? d.blocks : [])
      .filter(b => b && b.id && isISO(b.date) && Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
      .map(b => ({
        id: String(b.id),
        title: String(b.title || ''),
        date: b.date,
        start: b.start,
        end: b.end,
        category: CAT_IDS.includes(b.category) ? b.category : 'other',
        notes: String(b.notes || ''),
        taskId: typeof b.taskId === 'string' ? b.taskId : undefined,
        repeat: normRepeat(b.repeat),
        skip: Array.isArray(b.skip) ? b.skip.filter(isISO) : [],
        doneOn: Array.isArray(b.doneOn) ? b.doneOn.filter(isISO) : (b.done ? [b.date] : []),
      }));
    const tasks = (Array.isArray(d?.tasks) ? d.tasks : [])
      .filter(t => t && t.id && typeof t.title === 'string')
      .map(t => ({
        ...t,
        id: String(t.id),
        priority: PRIORITIES[t.priority] ? t.priority : 'med',
        category: CAT_IDS.includes(t.category) ? t.category : 'work',
        estimate: Math.max(0, parseInt(t.estimate, 10) || 0),
        due: isISO(t.due) ? t.due : '',
        done: !!t.done,
        repeat: normRepeat(t.repeat),
        notes: String(t.notes || ''),
      }));
    let entries = (Array.isArray(d?.entries) ? d.entries : [])
      .filter(e => e && e.id && typeof e.ref === 'string' && Number.isFinite(e.start) && (e.end == null || Number.isFinite(e.end)));
    let timer = d?.timer && typeof d.timer.ref === 'string' && ['running', 'paused'].includes(d.timer.status) ? { ref: d.timer.ref, status: d.timer.status } : null;
    // Keep timer and open sessions consistent.
    const open = entries.filter(e => e.end == null);
    if (!timer) open.forEach(e => { e.end = e.start; });
    else if (timer.status === 'paused') open.forEach(e => { e.end = Date.now(); });
    else if (!open.some(e => e.ref === timer.ref)) timer.status = 'paused';
    entries = entries.filter(e => e.end == null || e.end > e.start);
    return { version: 2, updatedAt: Number(d?.updatedAt) || 0, blocks, tasks, entries, timer, settings: s, vision: normalizeVision(d?.vision) };
  }

  let storeKey = GUEST_KEY;
  function loadFrom(key) {
    try {
      const raw = localStorage.getItem(key);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch {
      return normalize(null);
    }
  }

  let saveWarned = false;
  function persist() {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      if (!saveWarned) { saveWarned = true; toast('Changes could not be saved in this browser.'); }
    }
  }
  const changeListeners = new Set();
  function save() {
    state.updatedAt = Date.now();
    persist();
    changeListeners.forEach(fn => { try { fn(state); } catch (err) { console.error(err); } });
  }

  let state = loadFrom(storeKey);
  let currentDate = todayISO();
  let lastToday = currentDate;
  let todoFilter = 'active';
  let lastCategory = 'work';

  const findBlock = id => state.blocks.find(b => b.id === id);
  const findTask = id => state.tasks.find(t => t.id === id);
  const dayBounds = () => [state.settings.dayStart * 60, state.settings.dayEnd * 60];
  const minToY = m => (m - state.settings.dayStart * 60) / 60 * HOUR_H;
  const yToMin = y => state.settings.dayStart * 60 + (y / HOUR_H) * 60;
  const isEmpty = s => !s.blocks.length && !s.tasks.length && !s.entries.length;

  // ---------- Block occurrences ----------
  function occursOn(b, date) {
    if (!b.repeat) return b.date === date;
    if (b.skip.includes(date)) return false;
    return ruleMatches(b.repeat, b.date, date);
  }
  const refForBlock = (b, date) => (b.taskId && findTask(b.taskId) ? 'task:' + b.taskId : `block:${b.id}@${date}`);
  const occ = (b, date) => ({
    b, date, key: `${b.id}@${date}`,
    start: b.start, end: b.end, title: b.title, category: b.category,
    done: b.doneOn.includes(date), ref: refForBlock(b, date),
  });
  const occurrencesOn = date => state.blocks.filter(b => occursOn(b, date)).map(b => occ(b, date));
  const occurrencesIn = (a, b) => datesBetween(a, b).flatMap(occurrencesOn);
  function findOcc(key) {
    const i = key.lastIndexOf('@');
    const b = findBlock(key.slice(0, i));
    return b ? occ(b, key.slice(i + 1)) : null;
  }

  // Assigns side-by-side columns to overlapping blocks.
  function layout(items) {
    const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
    const pos = new Map();
    let cluster = [], clusterEnd = -Infinity;
    const flush = () => {
      const colEnds = [];
      for (const o of cluster) {
        let c = colEnds.findIndex(end => end <= o.start);
        if (c === -1) { c = colEnds.length; colEnds.push(o.end); } else colEnds[c] = o.end;
        pos.set(o.key, { col: c, cols: 1 });
      }
      for (const o of cluster) pos.get(o.key).cols = colEnds.length;
      cluster = [];
    };
    for (const o of sorted) {
      if (cluster.length && o.start >= clusterEnd) { flush(); clusterEnd = -Infinity; }
      cluster.push(o);
      clusterEnd = Math.max(clusterEnd, o.end);
    }
    if (cluster.length) flush();
    return pos;
  }

  function nextFreeSlot(date, len) {
    const [lo, hi] = dayBounds();
    let t = lo;
    if (date === todayISO()) t = Math.max(t, Math.ceil(nowMin() / SNAP) * SNAP);
    if (date < todayISO()) return null;
    const bs = occurrencesOn(date).sort((a, b) => a.start - b.start);
    for (const o of bs) {
      if (o.end <= t) continue;
      if (o.start - t >= len) break;
      t = Math.max(t, o.end);
    }
    return t + len <= hi ? t : null;
  }

  function remapRef(oldRef, newRef) {
    if (oldRef === newRef) return;
    state.entries.forEach(e => { if (e.ref === oldRef) e.ref = newRef; });
    if (state.timer?.ref === oldRef) state.timer.ref = newRef;
  }

  // Turn one occurrence of a repeating block into its own block.
  function detach(b, date, changes) {
    const nb = {
      ...b, id: uid(), date, repeat: null, skip: [],
      doneOn: b.doneOn.includes(date) ? [date] : [],
      ...changes,
    };
    if (nb.doneOn.length) nb.doneOn = [nb.date];
    b.skip.push(date);
    b.doneOn = b.doneOn.filter(d => d !== date);
    if (!b.taskId) remapRef(`block:${b.id}@${date}`, `block:${nb.id}@${nb.date}`);
    state.blocks.push(nb);
    return nb;
  }

  // End the series before `date` and start a new series from `date` with the changes.
  function splitFuture(b, date, changes) {
    if (date <= b.date) { Object.assign(b, changes); return b; }
    const nb = {
      ...b, id: uid(), date,
      skip: b.skip.filter(d => d >= date), doneOn: b.doneOn.filter(d => d >= date),
      ...changes,
    };
    if (!b.taskId) {
      for (const e of state.entries) {
        const m = e.ref.match(/^block:(.+)@(\d{4}-\d{2}-\d{2})$/);
        if (m && m[1] === b.id && m[2] >= date) e.ref = `block:${nb.id}@${m[2]}`;
      }
      const tm = state.timer?.ref.match(/^block:(.+)@(\d{4}-\d{2}-\d{2})$/);
      if (tm && tm[1] === b.id && tm[2] >= date) state.timer.ref = `block:${nb.id}@${tm[2]}`;
    }
    b.repeat = { ...b.repeat, until: addDays(date, -1) };
    b.skip = b.skip.filter(d => d < date);
    b.doneOn = b.doneOn.filter(d => d < date);
    state.blocks.push(nb);
    return nb;
  }

  function removeBlock(id) {
    state.blocks = state.blocks.filter(b => b.id !== id);
    if (state.timer?.ref.startsWith(`block:${id}@`)) { closeOpen(Date.now()); state.timer = null; }
  }

  // ---------- Tasks ----------
  function sortTasks(list) {
    return [...list].sort((a, b) =>
      (a.done - b.done) ||
      (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) ||
      ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0) ||
      ((a.created || 0) - (b.created || 0)));
  }

  function virtualDates(t, from, to) {
    if (!t.repeat || t.done || !t.due) return [];
    const start = from > t.due ? from : addDays(t.due, 1);
    return start > to ? [] : datesBetween(start, to).filter(d => ruleMatches(t.repeat, t.due, d));
  }

  function addTask({ title, priority = 'med', due = '', repeat = null, category = 'work', estimate = 0 }) {
    const t = { id: uid(), title: title.trim(), notes: '', priority, due, done: false, created: Date.now(), repeat: normRepeat(repeat), category, estimate };
    state.tasks.push(t);
    save();
    return t;
  }

  function setTaskDone(t, done) {
    const now = Date.now();
    if (done && !t.done) {
      t.done = true;
      t.doneAt = now;
      if (t.repeat) {
        const base = t.due || todayISO();
        const next = nextOccurrence(t.repeat, base, base);
        if (next) {
          const nt = { ...t, id: uid(), due: next, done: false, doneAt: null, created: now };
          delete nt.spawnedId; delete nt.prevRepeat;
          state.tasks.push(nt);
          t.spawnedId = nt.id;
        }
        t.prevRepeat = t.repeat;
        t.repeat = null;
        toast(next ? `Done. Next one is due ${dayLabel(next).toLowerCase()}.` : 'Done. That was the last one in the series.');
      }
      if (state.timer?.ref === 'task:' + t.id) { closeOpen(now); state.timer = null; }
    } else if (!done && t.done) {
      t.done = false;
      t.doneAt = null;
      if (t.spawnedId) {
        const sp = findTask(t.spawnedId);
        if (sp && !sp.done && !state.entries.some(e => e.ref === 'task:' + sp.id)) {
          state.tasks = state.tasks.filter(x => x !== sp);
          t.repeat = t.prevRepeat || sp.repeat;
        }
      }
      delete t.spawnedId;
      delete t.prevRepeat;
    }
    state.blocks.forEach(b => { if (b.taskId === t.id && !b.repeat) b.doneOn = t.done ? [b.date] : []; });
    const ms = milestoneForTask(t.id);
    if (ms) ms.m.done = t.done;
    save();
    renderAll();
  }

  function milestoneForTask(taskId) {
    for (const g of state.vision.goals) {
      const m = g.milestones.find(x => x.taskId === taskId);
      if (m) return { g, m };
    }
    return null;
  }

  function setOccDone(o, done) {
    const b = o.b;
    b.doneOn = b.doneOn.filter(d => d !== o.date);
    if (done) b.doneOn.push(o.date);
    const t = b.taskId && findTask(b.taskId);
    if (t && !b.repeat && t.done !== done) { setTaskDone(t, done); return; }
    save();
    renderAll();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    const ms = milestoneForTask(id);
    if (ms) delete ms.m.taskId;
    state.blocks.forEach(b => { if (b.taskId === id) delete b.taskId; });
    if (state.timer?.ref === 'task:' + id) { closeOpen(Date.now()); state.timer = null; }
  }

  function scheduleTask(t, date, startMin) {
    const [lo, hi] = dayBounds();
    let start = startMin, len = t.estimate ? clamp(t.estimate, SNAP, 8 * 60) : 60;
    if (start == null) {
      start = nextFreeSlot(date, len);
      if (start == null && len > 30) { len = 30; start = nextFreeSlot(date, 30); }
    }
    if (start == null) {
      toast(`No free time left ${relDay(date) ? relDay(date).toLowerCase() : 'on ' + fmtShortDate(date)}.`);
      return null;
    }
    start = clamp(start, lo, hi - SNAP);
    const b = {
      id: uid(), date, start, end: Math.min(start + len, hi), title: t.title, category: t.category || lastCategory,
      notes: t.notes || '', taskId: t.id, repeat: null, skip: [], doneOn: [],
    };
    state.blocks.push(b);
    save();
    renderAll();
    return b;
  }

  function withUndo(msg, mutate) {
    const snapshot = JSON.stringify(state);
    mutate();
    save();
    renderAll();
    toast(msg, () => { state = normalize(JSON.parse(snapshot)); save(); renderAll(); });
  }

  // ---------- Time tracking ----------
  const openEntry = () => state.entries.find(e => e.end == null);

  function refInfo(ref) {
    if (ref.startsWith('task:')) {
      const t = findTask(ref.slice(5));
      return t ? { kind: 'task', title: t.title, category: t.category, task: t } : null;
    }
    const key = ref.slice(6);
    const o = findOcc(key);
    return o ? { kind: 'block', title: o.title, category: o.category, occ: o } : null;
  }

  function trackedMs(ref, from = -Infinity, to = Infinity) {
    const now = Date.now();
    return sum(state.entries.filter(e => e.ref === ref), e => overlap(e.start, e.end ?? now, from, to));
  }

  function plannedForRef(ref) {
    if (ref.startsWith('task:')) {
      const t = findTask(ref.slice(5));
      if (!t) return 0;
      if (t.estimate) return t.estimate;
      return sum(state.blocks.filter(b => b.taskId === t.id && !b.repeat), b => b.end - b.start);
    }
    const o = findOcc(ref.slice(6));
    return o ? o.end - o.start : 0;
  }

  function closeOpen(now) {
    const e = openEntry();
    if (!e) return;
    e.end = now;
    if (e.end - e.start < 1000) state.entries = state.entries.filter(x => x !== e);
  }

  function startTimer(ref) {
    const info = refInfo(ref);
    if (!info) return;
    const now = Date.now();
    const cur = state.timer;
    if (cur && cur.ref === ref) {
      if (cur.status === 'running') return;
      cur.status = 'running';
    } else {
      if (cur) { closeOpen(now); toast(`Switched timer to “${info.title}”`); }
      state.timer = { ref, status: 'running' };
    }
    state.entries.push({ id: uid(), ref, title: info.title, category: info.category, start: now, end: null });
    save();
    renderAll();
  }

  function pauseTimer() {
    if (!state.timer || state.timer.status !== 'running') return;
    closeOpen(Date.now());
    state.timer.status = 'paused';
    save();
    renderAll();
  }

  function toggleTimer(ref) {
    if (state.timer?.ref === ref && state.timer.status === 'running') pauseTimer();
    else startTimer(ref);
  }

  // Stop = end tracking and mark the item complete.
  function stopTimer() {
    if (!state.timer) return;
    const ref = state.timer.ref;
    closeOpen(Date.now());
    state.timer = null;
    const total = trackedMs(ref) / 60000;
    const info = refInfo(ref);
    if (info?.kind === 'task' && !info.task.done) { setTaskDone(info.task, true); }
    else if (info?.kind === 'block' && !info.occ.done) { setOccDone(info.occ, true); }
    else { save(); renderAll(); }
    toast(`Stopped. ${fmtDur(total)} tracked${info ? ` on “${info.title}”` : ''}.`);
  }

  // ---------- DOM refs ----------
  const views = { timeblock: $('#view-timeblock'), todo: $('#view-todo'), insights: $('#view-insights'), vision: $('#view-vision') };
  const modeBtns = document.querySelectorAll('.mode-switch [data-mode]');
  const viewSwitch = $('#view-switch');
  const periodTitle = $('#period-title'), periodSub = $('#period-sub'), periodLabel = $('#period-label');
  const dayPicker = $('#day-picker'), todayBtn = $('#today-btn');
  const tbMain = $('#tb-main'), summaryEl = $('#period-summary'), unscheduledEl = $('#unscheduled');
  const quickTaskForm = $('#quick-task'), quickTaskInput = $('#quick-task-input');
  const todoForm = $('#todo-form'), todoTitle = $('#todo-title'), todoPriority = $('#todo-priority'), todoDue = $('#todo-due'), todoRepeat = $('#todo-repeat');
  const todoContent = $('#todo-content'), filtersEl = $('#filters'), clearDoneBtn = $('#clear-done');
  const insightsEl = $('#insights-content'), tooltip = $('#tooltip');
  const timerBar = $('#timer-bar'), timerTitle = $('#timer-title'), timerSub = $('#timer-sub'), timerClock = $('#timer-clock'), timerToggle = $('#timer-toggle');
  const fab = $('#fab');

  const blockDialog = $('#block-dialog'), blockForm = $('#block-form');
  const bTitle = $('#b-title'), bDate = $('#b-date'), bStart = $('#b-start'), bEnd = $('#b-end'), bNotes = $('#b-notes'), bError = $('#b-error'), bDelete = $('#b-delete'), bTrack = $('#b-track');
  const taskDialog = $('#task-dialog'), taskForm = $('#task-form');
  const tTitle = $('#t-title'), tPriority = $('#t-priority'), tDue = $('#t-due'), tEstimate = $('#t-estimate'), tNotes = $('#t-notes'), tError = $('#t-error'), tDelete = $('#t-delete'), tTrack = $('#t-track');
  const scopeDialog = $('#scope-dialog');
  const settingsDialog = $('#settings-dialog');
  const sStart = $('#s-start'), sEnd = $('#s-end'), sWeek = $('#s-week'), sTheme = $('#s-theme');
  const importInput = $('#import-input');

  let wrapEl = null, colsEl = null;
  document.documentElement.style.setProperty('--hour-h', HOUR_H + 'px');

  // ---------- Theme, mode & views ----------
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    const dark = t === 'dark' || (t === 'auto' && darkQuery.matches);
    $('meta[name="theme-color"]').content = dark ? '#0f1117' : '#f5f6fa';
  }

  const mode = () => state.settings.mode;
  const VIEW_KEY = { timeblock: 'tbView', todo: 'todoView', insights: 'insView', vision: 'visView' };
  const viewFor = (m = mode()) => state.settings[VIEW_KEY[m]];

  function setMode(m) {
    state.settings.mode = m;
    save();
    renderAll();
    if (m === 'timeblock') scrollToRelevant();
  }
  function setView(v, m = mode()) {
    state.settings[VIEW_KEY[m]] = v;
    save();
    renderAll();
    if (m === 'timeblock') scrollToRelevant();
  }
  function openDay(date, m = mode()) {
    currentDate = date;
    setView('day', m);
  }

  function periodRange(view = viewFor(), date = currentDate) {
    if (view === 'week') {
      const off = (dowOf(date) - state.settings.weekStart + 7) % 7;
      const s = addDays(date, -off);
      return [s, addDays(s, 6)];
    }
    if (view === 'month') {
      const d = fromISO(date);
      return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)), toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    }
    return [date, date];
  }

  function step(dir) {
    const v = viewFor();
    if (LIST_VIEWS.includes(v)) return;
    currentDate = v === 'week' ? addDays(currentDate, 7 * dir) : v === 'month' ? addMonths(currentDate, dir) : addDays(currentDate, dir);
    renderAll();
    scrollToRelevant();
  }
  function goToday() {
    currentDate = todayISO();
    renderAll();
    scrollToRelevant();
  }

  function rangeLabel(a, b) {
    const da = fromISO(a), db = fromISO(b);
    const sameMonth = da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
    const left = da.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const right = db.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${left} – ${right}, ${db.getFullYear()}`;
  }

  function renderToolbar() {
    const m = mode(), v = viewFor();
    viewSwitch.innerHTML = VIEWS[m].map(([id, label]) =>
      `<button type="button" role="tab" data-view="${id}" aria-selected="${id === v}">${label}</button>`).join('');
    document.body.classList.toggle('list-view', LIST_VIEWS.includes(v));
    const today = todayISO();
    if (LIST_VIEWS.includes(v)) {
      if (v === 'list') {
        periodTitle.textContent = 'All tasks';
        const open = state.tasks.filter(t => !t.done).length;
        periodSub.textContent = open ? `${open} open` : 'Nothing open';
      } else if (v === 'board') {
        periodTitle.textContent = 'Vision board';
        periodSub.textContent = 'See it, feel it, plan it';
      } else {
        const g = state.vision.goals;
        periodTitle.textContent = 'Life goals';
        periodSub.textContent = g.length ? `${g.filter(x => x.status === 'active').length} active · ${g.filter(x => x.status === 'done').length} achieved` : 'Dream big, then break it down';
      }
      periodLabel.disabled = true;
      return;
    }
    periodLabel.disabled = false;
    const [a, b] = periodRange(v);
    if (v === 'day' || v === 'journal') {
      const rel = relDay(a);
      const d = fromISO(a);
      periodTitle.textContent = rel || d.toLocaleDateString(undefined, { weekday: 'long' });
      periodSub.textContent = d.toLocaleDateString(undefined, rel ? { weekday: 'long', month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (v === 'week') {
      periodTitle.textContent = rangeLabel(a, b);
      const [ta] = periodRange('week', today);
      periodSub.textContent = a === ta ? 'This week' : a === addDays(ta, 7) ? 'Next week' : a === addDays(ta, -7) ? 'Last week' : 'Week view';
    } else {
      periodTitle.textContent = fromISO(a).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const [ma] = periodRange('month', today);
      periodSub.textContent = a === ma ? 'This month' : 'Month view';
    }
    dayPicker.value = currentDate;
    todayBtn.disabled = a <= today && today <= b;
  }

  function renderAll() {
    const m = mode();
    for (const [k, el] of Object.entries(views)) el.hidden = k !== m;
    modeBtns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    fab.hidden = m === 'insights' || m === 'vision';
    fab.setAttribute('aria-label', m === 'todo' ? 'Add task' : 'Add time block');
    renderToolbar();
    if (m === 'timeblock') renderTimeblock();
    else if (m === 'todo') renderTodo();
    else if (m === 'insights') renderInsights();
    else renderVision();
    renderTimerBar();
  }

  // ---------- Time blocks: day & week timeline ----------
  function renderTimeblock() {
    const v = state.settings.tbView;
    if (v === 'month') renderBlockMonth();
    else renderTimeline(v === 'day' ? [currentDate] : datesBetween(...periodRange('week')));
    renderSide();
  }

  function setGeom(node, start, end) {
    const [lo, hi] = dayBounds();
    const top = minToY(clamp(start, lo, hi));
    const h = Math.max(minToY(clamp(end, lo, hi)) - top, 16);
    node.style.top = (top + 1) + 'px';
    node.style.height = (h - 2) + 'px';
    node.classList.toggle('compact', h < 44);
  }

  function blockNode(o, pos, now, colWidth) {
    const n = document.createElement('div');
    const timing = state.timer?.ref === o.ref;
    const running = timing && state.timer.status === 'running';
    const narrow = colWidth / pos.cols < 96;
    n.className = `block cat-${o.category}` + (o.done ? ' done' : '') + (now >= o.start && now < o.end ? ' now' : '') +
      (running ? ' tracking' : '') + (narrow ? ' narrow' : '');
    n.dataset.key = o.key;
    const planned = o.end - o.start;
    const spent = o.ref.startsWith('task:') || timing || state.entries.some(e => e.ref === o.ref) ? trackedMs(o.ref) / 60000 : 0;
    n.innerHTML =
      `<button type="button" class="check" aria-label="${o.done ? 'Mark not done' : 'Mark done'}" aria-pressed="${o.done}"></button>` +
      `<div class="block-body"><div class="block-title"></div><div class="block-time"></div></div>` +
      (narrow ? '' : `<button type="button" class="play${timing ? ' on' : ''}" aria-label="${running ? 'Pause timer' : 'Start timer'}" title="${running ? 'Pause timer' : 'Start timer'}">${running ? ICON.pause : ICON.play}</button>`) +
      (spent > 0 ? `<span class="track-bar" style="width:${Math.min(100, spent / planned * 100)}%"></span>` : '') +
      `<div class="resize" aria-hidden="true"></div>`;
    n.querySelector('.block-title').textContent = o.title || 'Untitled';
    n.querySelector('.block-time').innerHTML = `${esc(fmtTime(o.start))} – ${esc(fmtTime(o.end))}${o.b.repeat ? ' <span class="rep" title="Repeats">↻</span>' : ''}`;
    n.title = `${o.title || 'Untitled'} · ${fmtTime(o.start)} – ${fmtTime(o.end)}` +
      (o.b.repeat ? `\n${describeRepeat(o.b.repeat, o.b.date)}` : '') +
      (spent > 0 ? `\nTracked ${fmtDur(spent)} of ${fmtDur(planned)}` : '') +
      (o.b.notes ? '\n' + o.b.notes : '');
    setGeom(n, o.start, o.end);
    const w = 100 / pos.cols;
    n.style.left = `calc(${pos.col * w}% + 2px)`;
    n.style.width = `calc(${w}% - 4px)`;
    return n;
  }

  function renderTimeline(dates) {
    const prevScroll = wrapEl?.isConnected ? wrapEl.scrollTop : null;
    const { dayStart, dayEnd } = state.settings;
    const height = (dayEnd - dayStart) * HOUR_H;
    const today = todayISO();
    const multi = dates.length > 1;
    const colsTpl = `repeat(${dates.length}, minmax(0, 1fr))`;
    const head = multi
      ? `<div class="tl-head" style="grid-template-columns:var(--hours-w) ${colsTpl}"><div></div>${dates.map(d => {
          const planned = sum(occurrencesOn(d), o => o.end - o.start);
          return `<button type="button" class="tl-day${d === today ? ' today' : ''}" data-goto="${d}" title="Open ${esc(fmtShortDate(d))}">` +
            `<span class="dow">${esc(DOW_SHORT[dowOf(d)])}</span><span class="dnum">${fromISO(d).getDate()}</span>` +
            `<span class="dhrs">${planned ? fmtDur(planned) : '&nbsp;'}</span></button>`;
        }).join('')}</div>`
      : '';
    const labels = range(dayStart, dayEnd)
      .map(h => `<span class="hour-label" style="top:${(h - dayStart) * HOUR_H}px">${esc(fmtHour(h))}</span>`).join('');
    tbMain.innerHTML =
      `<div class="timeline-wrap card" id="timeline-wrap">${head}<div class="timeline">` +
      `<div class="hours" style="height:${height}px">${labels}</div>` +
      `<div class="cols" id="cols" style="height:${height}px;grid-template-columns:${colsTpl}">` +
      dates.map(d => `<div class="col${multi && d === today ? ' today' : ''}" data-date="${d}"></div>`).join('') +
      `</div></div></div>`;
    wrapEl = $('#timeline-wrap');
    colsEl = $('#cols');
    const [lo, hi] = dayBounds();
    const colWidth = colsEl.clientWidth / dates.length;
    [...colsEl.children].forEach(col => {
      const date = col.dataset.date;
      const visible = occurrencesOn(date).filter(o => o.end > lo && o.start < hi);
      const pos = layout(visible);
      const now = date === today ? nowMin() : -1;
      visible.forEach(o => col.appendChild(blockNode(o, pos.get(o.key), now, colWidth)));
      if (date === today) {
        const m = nowMin();
        if (m >= lo && m <= hi) {
          const line = document.createElement('div');
          line.className = 'now-line';
          line.style.top = minToY(m) + 'px';
          col.appendChild(line);
        }
      }
    });
    if (prevScroll != null) wrapEl.scrollTop = prevScroll;
  }

  function scrollToRelevant() {
    if (!wrapEl?.isConnected || mode() !== 'timeblock') return;
    const [lo] = dayBounds();
    const [a, b] = periodRange();
    const today = todayISO();
    let target;
    if (a <= today && today <= b) target = nowMin() - 60;
    else {
      const occs = occurrencesIn(a, b);
      target = occs.length ? Math.min(...occs.map(o => o.start)) - 30 : 8 * 60;
    }
    wrapEl.scrollTop = Math.max(0, minToY(Math.max(lo, target)));
  }

  // ---------- Time blocks: month ----------
  function monthMatrix(date) {
    const d = fromISO(date);
    const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
    const last = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const ws = state.settings.weekStart;
    const start = addDays(first, -((dowOf(first) - ws + 7) % 7));
    const end = addDays(last, (ws + 6 - dowOf(last) + 7) % 7);
    return { dates: datesBetween(start, end), month: d.getMonth() };
  }
  const weekdayHeads = () => range(0, 6).map(i => `<div>${esc(DOW_SHORT[(state.settings.weekStart + i) % 7])}</div>`).join('');

  function renderBlockMonth() {
    wrapEl = null;
    const { dates, month } = monthMatrix(currentDate);
    const today = todayISO();
    const maxChips = innerWidth < 600 ? 2 : 3;
    tbMain.innerHTML = `<div class="card month"><div class="month-head">${weekdayHeads()}</div><div class="month-grid">` +
      dates.map(d => {
        const occs = occurrencesOn(d).sort((a, b) => a.start - b.start);
        const planned = sum(occs, o => o.end - o.start);
        const chips = occs.slice(0, maxChips).map(o =>
          `<button type="button" class="mchip cat-${o.category}${o.done ? ' done' : ''}" data-key="${esc(o.key)}" title="${esc(o.title)} · ${esc(fmtTime(o.start))} – ${esc(fmtTime(o.end))}">` +
          `<span class="tm">${esc(fmtTime(o.start))}</span><span class="t">${esc(o.title || 'Untitled')}</span></button>`).join('');
        const more = occs.length > maxChips ? `<span class="mmore">+${occs.length - maxChips} more</span>` : '';
        const cls = (fromISO(d).getMonth() !== month ? ' out' : '') + (d === today ? ' today' : '');
        return `<div class="mcell${cls}" data-date="${d}"><div class="mcell-top"><span class="mdate">${fromISO(d).getDate()}</span>` +
          `${planned ? `<span class="mhrs">${fmtDur(planned)}</span>` : ''}</div>${chips}${more}</div>`;
      }).join('') + '</div></div>';
  }

  // ---------- Time blocks: side panel ----------
  function renderSide() {
    const v = state.settings.tbView;
    const [a, b] = periodRange(v);
    const [lo, hi] = dayBounds();
    const occs = occurrencesIn(a, b);
    const planned = sum(occs, o => o.end - o.start);
    const doneMin = sum(occs.filter(o => o.done), o => o.end - o.start);
    const fromTs = isoToTs(a), toTs = isoToTs(addDays(b, 1)), now = Date.now();
    const tracked = sum(state.entries, e => overlap(e.start, e.end ?? now, fromTs, toTs)) / 60000;
    const pct = planned ? Math.round(doneMin / planned * 100) : 0;
    const outside = v === 'month' ? 0 : occs.filter(o => o.end <= lo || o.start >= hi).length;
    const periodWord = v === 'day' ? 'today' : v === 'week' ? 'this week' : 'this month';
    summaryEl.innerHTML = `
      <div class="stat-row">
        <div class="stat"><span class="stat-num">${occs.length}</span><span class="stat-label">${occs.length === 1 ? 'block' : 'blocks'}</span></div>
        <div class="stat"><span class="stat-num">${fmtDur(planned)}</span><span class="stat-label">planned</span></div>
        <div class="stat"><span class="stat-num">${fmtDur(tracked)}</span><span class="stat-label">tracked</span></div>
      </div>
      <div class="progress" role="progressbar" aria-label="Planned time completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <div class="progress-label">${planned ? `${pct}% of planned time done ${periodWord}` : v === 'month' ? 'Pick a day to start planning.' : 'Click or drag on the timeline to plan.'}</div>
      ${outside ? `<div class="off-note">${outside} block${outside > 1 ? 's are' : ' is'} outside your visible hours (change in Settings).</div>` : ''}`;

    const linked = new Set(state.blocks.filter(x => x.taskId).map(x => x.taskId));
    const list = sortTasks(state.tasks.filter(t => !t.done && !linked.has(t.id)));
    unscheduledEl.innerHTML = list.length
      ? list.map(t => `
        <li class="mini-task" draggable="true" data-id="${esc(t.id)}">
          <span class="prio prio-${t.priority}" title="${PRIORITIES[t.priority]} priority"></span>
          <span class="mini-title">${esc(t.title)}</span>
          <button type="button" class="icon-btn sm" data-act="schedule" aria-label="Schedule ${esc(t.title)} in the next free slot" title="Next free slot">${ICON.plus}</button>
        </li>`).join('')
      : '<li class="empty-mini">Nothing waiting to be scheduled.</li>';
  }

  // ---------- To-do ----------
  function trackPill(ref, planned) {
    const tracked = trackedMs(ref) / 60000;
    const timing = state.timer?.ref === ref;
    if (!tracked && !planned && !timing) return '';
    const cls = timing ? ' live' : planned && tracked > planned ? ' over' : '';
    return `<span class="pill${cls}" title="Tracked / planned">${ICON.clock}${fmtDur(tracked)}${planned ? ' / ' + fmtDur(planned) : ''}</span>`;
  }

  function dueInfo(t, today) {
    if (!t.due) return '';
    if (!t.done && t.due < today) return `<span class="pill overdue">Overdue · ${esc(fmtShortDate(t.due))}</span>`;
    const r = relDay(t.due);
    return `<span class="pill">Due ${r ? r.toLowerCase() : esc(fmtShortDate(t.due))}</span>`;
  }

  function scheduledMap() {
    const m = new Map();
    for (const b of state.blocks) {
      if (!b.taskId) continue;
      const cur = m.get(b.taskId);
      if (!cur || b.date + toHHMM(b.start) < cur.date + toHHMM(cur.start)) m.set(b.taskId, b);
    }
    return m;
  }

  function taskItem(t, sched, opt = {}) {
    const today = todayISO();
    if (opt.virtualDate) {
      return `<li class="todo-item virtual" data-id="${esc(t.id)}">
        <input type="checkbox" class="todo-check" disabled aria-label="Upcoming repeat">
        <button type="button" class="todo-main" data-act="edit">
          <span class="todo-title">${esc(t.title)}</span>
          <span class="todo-meta"><span class="pill">${ICON.repeat}Repeats · ${esc(dayLabel(opt.virtualDate))}</span></span>
        </button></li>`;
    }
    const ref = 'task:' + t.id;
    const b = sched.get(t.id);
    const timing = state.timer?.ref === ref;
    const running = timing && state.timer.status === 'running';
    const schedPill = b
      ? `<button type="button" class="pill sched" data-act="goto" data-date="${b.date}" title="Show on timeline">${esc(dayLabel(b.date))} · ${esc(fmtTime(b.start))}</button>`
      : '';
    return `
      <li class="todo-item${t.done ? ' done' : ''}" data-id="${esc(t.id)}">
        <input type="checkbox" class="todo-check" ${t.done ? 'checked' : ''} aria-label="Mark ${esc(t.title)} done">
        <button type="button" class="todo-main" data-act="edit">
          <span class="todo-title">${esc(t.title)}</span>
          <span class="todo-meta">
            <span class="pill"><span class="prio prio-${t.priority}"></span>${PRIORITIES[t.priority]}</span>
            ${dueInfo(t, today)}
            ${t.repeat ? `<span class="pill" title="${esc(describeRepeat(t.repeat, t.due))}">${ICON.repeat}${esc(REPEAT_FREQS[t.repeat.freq])}</span>` : ''}
            ${trackPill(ref, plannedForRef(ref))}
            ${(() => { const ms = milestoneForTask(t.id); return ms ? `<span class="pill" title="Step of a life goal">🎯 ${esc(ms.g.title)}</span>` : ''; })()}
            ${t.notes ? '<span class="pill">Notes</span>' : ''}
          </span>
        </button>
        ${schedPill}
        <div class="todo-actions">
          ${t.done ? '' : `<button type="button" class="icon-btn sm${timing ? ' active' : ''}" data-act="track" aria-label="${running ? 'Pause timer' : 'Start timer'}" title="${running ? 'Pause timer' : timing ? 'Resume timer' : 'Start timer'}">${running ? ICON.pause : ICON.play}</button>`}
          ${!b && !t.done ? `<button type="button" class="icon-btn sm hover-only" data-act="schedule" aria-label="Schedule in the next free slot" title="Put on the timeline">${ICON.calendar}</button>` : ''}
          <button type="button" class="icon-btn sm hover-only" data-act="delete" aria-label="Delete task" title="Delete">${ICON.trash}</button>
        </div>
      </li>`;
  }

  const section = (title, items) => items.length
    ? `<div class="todo-section"><h2 class="section-title">${esc(title)}</h2><ul class="todo-list card">${items.join('')}</ul></div>`
    : '';
  const emptyState = (title, text) => `<div class="empty-state"><strong>${esc(title)}</strong>${esc(text)}</div>`;

  function renderTodo() {
    const v = state.settings.todoView;
    filtersEl.hidden = v !== 'list';
    if (v === 'list') renderTodoList();
    else if (v === 'day') renderTodoDay();
    else if (v === 'week') renderTodoWeek();
    else renderTodoMonth();
  }

  function renderTodoList() {
    const today = todayISO();
    const active = state.tasks.filter(t => !t.done);
    const counts = {
      all: state.tasks.length,
      active: active.length,
      today: active.filter(t => t.due && t.due <= today).length,
      done: state.tasks.length - active.length,
    };
    filtersEl.querySelectorAll('[data-filter]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.filter === todoFilter));
      b.querySelector('.count').textContent = counts[b.dataset.filter];
    });
    clearDoneBtn.hidden = counts.done === 0;
    let list = state.tasks;
    if (todoFilter === 'active') list = active;
    else if (todoFilter === 'today') list = active.filter(t => t.due && t.due <= today);
    else if (todoFilter === 'done') list = list.filter(t => t.done);
    const sched = scheduledMap();
    const empty = {
      active: ['Nothing on your list', 'Add a task above to get started.'],
      today: ['Nothing due today', 'Tasks due today or earlier show up here.'],
      done: ['No finished tasks yet', 'Tick a task off and it will land here.'],
      all: ['No tasks yet', 'Add a task above to get started.'],
    }[todoFilter];
    todoContent.innerHTML = list.length
      ? `<ul class="todo-list card">${sortTasks(list).map(t => taskItem(t, sched)).join('')}</ul>`
      : emptyState(...empty);
  }

  function renderTodoDay() {
    const d = currentDate, today = todayISO();
    const sched = scheduledMap();
    const due = sortTasks(state.tasks.filter(t => t.due === d));
    const repeats = state.tasks.filter(t => virtualDates(t, d, d).length);
    let html = '';
    if (d === today) html += section('Overdue', sortTasks(state.tasks.filter(t => !t.done && t.due && t.due < today)).map(t => taskItem(t, sched)));
    html += section(`Due ${dayLabel(d).toLowerCase()}`, due.map(t => taskItem(t, sched)));
    html += section('Repeats on this day', repeats.map(t => taskItem(t, sched, { virtualDate: d })));
    if (d === today) html += section('No due date', sortTasks(state.tasks.filter(t => !t.done && !t.due)).map(t => taskItem(t, sched)));
    todoContent.innerHTML = html || emptyState('Nothing due', 'Add a task above. It will be due on this day.');
  }

  function wtask(t, virtualDate) {
    if (virtualDate) {
      return `<div class="wtask virtual" data-id="${esc(t.id)}" title="${esc(describeRepeat(t.repeat, t.due))}">` +
        `<input type="checkbox" class="todo-check" disabled aria-label="Upcoming repeat"><button type="button" class="wtask-title" data-act="edit">↻ ${esc(t.title)}</button></div>`;
    }
    return `<div class="wtask${t.done ? ' done' : ''}" data-id="${esc(t.id)}">` +
      `<input type="checkbox" class="todo-check" ${t.done ? 'checked' : ''} aria-label="Mark ${esc(t.title)} done">` +
      `<span class="prio prio-${t.priority}" style="margin-top:7px"></span>` +
      `<button type="button" class="wtask-title" data-act="edit">${esc(t.title)}</button></div>`;
  }

  function renderTodoWeek() {
    const [a, b] = periodRange('week');
    const today = todayISO();
    todoContent.innerHTML = `<div class="week-cols">` + datesBetween(a, b).map(d => {
      const real = sortTasks(state.tasks.filter(t => t.due === d));
      const virt = state.tasks.filter(t => virtualDates(t, d, d).length);
      return `<div class="card wcol${d === today ? ' today' : ''}">` +
        `<button type="button" class="wcol-head" data-goto="${d}"><span class="dow">${esc(DOW_SHORT[dowOf(d)])}</span><span class="dnum">${fromISO(d).getDate()}</span></button>` +
        real.map(t => wtask(t)).join('') + virt.map(t => wtask(t, d)).join('') +
        `<button type="button" class="wadd" data-add="${d}">+ Add</button></div>`;
    }).join('') + `</div>`;
  }

  function renderTodoMonth() {
    const { dates, month } = monthMatrix(currentDate);
    const today = todayISO();
    const maxChips = innerWidth < 600 ? 2 : 3;
    const [ma, mb] = [dates[0], dates[dates.length - 1]];
    const virt = new Map();
    for (const t of state.tasks) for (const d of virtualDates(t, ma, mb)) { if (!virt.has(d)) virt.set(d, []); virt.get(d).push(t); }
    todoContent.innerHTML = `<div class="card month"><div class="month-head">${weekdayHeads()}</div><div class="month-grid">` +
      dates.map(d => {
        const items = sortTasks(state.tasks.filter(t => t.due === d)).map(t =>
          `<button type="button" class="mchip task p-${t.priority}${t.done ? ' done' : ''}" data-task="${esc(t.id)}" title="${esc(t.title)}"><span class="t">${esc(t.title)}</span></button>`)
          .concat((virt.get(d) || []).map(t =>
            `<button type="button" class="mchip task virtual p-${t.priority}" data-task="${esc(t.id)}" title="Repeats: ${esc(t.title)}"><span class="t">↻ ${esc(t.title)}</span></button>`));
        const cls = (fromISO(d).getMonth() !== month ? ' out' : '') + (d === today ? ' today' : '');
        const more = items.length > maxChips ? `<span class="mmore">+${items.length - maxChips} more</span>` : '';
        return `<div class="mcell${cls}" data-date="${d}"><div class="mcell-top"><span class="mdate">${fromISO(d).getDate()}</span></div>${items.slice(0, maxChips).join('')}${more}</div>`;
      }).join('') + '</div></div>';
  }

  // ---------- Insights ----------
  function renderInsights() {
    const v = state.settings.insView;
    const [a, b] = periodRange(v);
    const dates = datesBetween(a, b);
    const fromTs = isoToTs(a), toTs = isoToTs(addDays(b, 1)), now = Date.now();
    // One row per task / single block / repeating series (occurrences of a series are grouped).
    const rows = new Map();
    const row = (ref, title, category) => {
      const key = ref.startsWith('block:') ? ref.slice(0, ref.lastIndexOf('@')) : ref;
      let r = rows.get(key);
      if (!r) {
        const series = key.startsWith('block:') ? findBlock(key.slice(6)) : null;
        rows.set(key, r = { ref: key, title, category, planned: 0, tracked: 0, count: 0, repeats: !!series?.repeat });
      }
      r.count++;
      return r;
    };
    const dayP = Object.fromEntries(dates.map(d => [d, 0]));
    const dayT = Object.fromEntries(dates.map(d => [d, 0]));

    for (const o of occurrencesIn(a, b)) {
      const t = o.ref.startsWith('task:') ? findTask(o.ref.slice(5)) : null;
      row(o.ref, t ? t.title : o.title, o.category).planned += o.end - o.start;
      dayP[o.date] += o.end - o.start;
    }
    const linked = new Set(state.blocks.filter(x => x.taskId).map(x => x.taskId));
    for (const t of state.tasks) {
      if (t.estimate && t.due && t.due >= a && t.due <= b && !linked.has(t.id)) {
        row('task:' + t.id, t.title, t.category).planned += t.estimate;
        dayP[t.due] += t.estimate;
      }
    }
    const sessions = [];
    for (const e of state.entries) {
      const end = e.end ?? now;
      const ms = overlap(e.start, end, fromTs, toTs);
      if (!ms) continue;
      const info = refInfo(e.ref);
      row(e.ref, info?.title ?? e.title, info?.category ?? e.category).tracked += ms / 60000;
      for (const d of dates) {
        const m = overlap(e.start, end, isoToTs(d), isoToTs(addDays(d, 1)));
        if (m) dayT[d] += m / 60000;
      }
      sessions.push({ ...e, title: info?.title ?? e.title, category: info?.category ?? e.category, dur: (end - e.start) / 60000 });
    }

    const list = [...rows.values()];
    const planned = sum(list, r => r.planned);
    const tracked = sum(list, r => r.tracked);
    if (!planned && !tracked) {
      insightsEl.innerHTML = `<div class="card">${emptyState('No data for this period yet',
        'Plan time blocks or set "time needed" on tasks, then press ▶ on any task or block to track time. Planned vs. spent time shows up here.')}</div>`;
      return;
    }
    const diff = tracked - planned;
    const onPlan = sum(list.filter(r => r.planned > 0), r => r.tracked);
    const focus = tracked ? Math.round(onPlan / tracked * 100) : 0;
    const doneTimed = list.filter(r => r.planned > 0 && r.tracked > 0);
    const kpis = `
      <div class="kpis">
        <div class="card kpi"><div class="kpi-label">Planned</div><div class="kpi-num">${fmtDur(planned)}</div><div class="kpi-sub">${list.filter(r => r.planned).length} items</div></div>
        <div class="card kpi"><div class="kpi-label">Tracked</div><div class="kpi-num">${fmtDur(tracked)}</div><div class="kpi-sub">${sessions.length} session${sessions.length === 1 ? '' : 's'}</div></div>
        <div class="card kpi"><div class="kpi-label">Difference</div><div class="kpi-num">${diff >= 0 ? '+' : '−'}${fmtDur(Math.abs(diff))}</div>
          <div class="kpi-sub ${diff > 0 ? 'over' : ''}">${planned ? (diff > 0 ? 'More than planned' : diff < 0 ? 'Less than planned' : 'Exactly as planned') : 'Nothing planned'}</div></div>
        <div class="card kpi"><div class="kpi-label">Time on planned work</div><div class="kpi-num">${tracked ? focus + '%' : '—'}</div><div class="kpi-sub">${doneTimed.length} planned item${doneTimed.length === 1 ? '' : 's'} tracked</div></div>
      </div>`;

    // Category breakdown
    const cats = CATEGORIES.map(c => ({
      ...c,
      planned: sum(list.filter(r => r.category === c.id), r => r.planned),
      tracked: sum(list.filter(r => r.category === c.id), r => r.tracked),
    })).filter(c => c.planned || c.tracked);
    const catMax = Math.max(1, ...cats.map(c => Math.max(c.planned, c.tracked)));
    const catCard = `
      <div class="card ins-card">
        <div class="ins-card-head"><h2>By category</h2><div class="legend"><span><i class="sw planned" style="opacity:.6"></i>Planned</span><span><i class="sw tracked"></i>Tracked</span></div></div>
        <div class="cat-rows">${cats.map(c => `
          <div class="cat-${c.id}">
            <div class="cat-row-head"><span class="name">${esc(c.name)}</span><span class="vals">${fmtDur(c.tracked)} of ${fmtDur(c.planned)}</span></div>
            <div class="dual-bar" data-tip="<b>${esc(c.name)}</b><br>Planned: <b>${fmtDur(c.planned)}</b><br>Tracked: <b>${fmtDur(c.tracked)}</b>">
              <span class="p" style="width:${c.planned / catMax * 100}%"></span>
              <span class="t" style="width:${c.tracked / catMax * 100}%"></span>
            </div>
          </div>`).join('')}
        </div>
      </div>`;

    const chartCard = v === 'day' ? '' : `
      <div class="card ins-card">
        <div class="ins-card-head"><h2>Planned vs. tracked per day</h2><div class="legend"><span><i class="sw planned"></i>Planned</span><span><i class="sw tracked"></i>Tracked</span></div></div>
        ${barChart(dates, dayP, dayT, v)}
      </div>`;

    const items = list.sort((x, y) => Math.max(y.planned, y.tracked) - Math.max(x.planned, x.tracked)).slice(0, 60);
    const table = `
      <div class="card ins-card">
        <div class="ins-card-head"><h2>Planned vs. spent by item</h2></div>
        <div class="table-scroll"><table class="ins-table">
          <thead><tr><th>Item</th><th class="r">Planned</th><th class="r">Tracked</th><th class="r">Difference</th><th class="r">Progress</th></tr></thead>
          <tbody>${items.map(r => {
            const d = r.tracked - r.planned;
            const pct = r.planned ? Math.round(r.tracked / r.planned * 100) : null;
            return `<tr class="cat-${r.category}">
              <td><span class="item">${esc(r.title || 'Untitled')}${r.repeats ? ' <span class="muted" title="Repeating block — all occurrences in this period">↻</span>' : ''}</span></td>
              <td class="r">${r.planned ? fmtDur(r.planned) : '—'}</td>
              <td class="r">${fmtDur(r.tracked)}</td>
              <td class="r ${r.planned && d > 0 ? 'over' : ''}">${r.planned ? (d >= 0 ? '+' : '−') + fmtDur(Math.abs(d)) : 'Unplanned'}</td>
              <td class="r">${pct == null ? '' : `<span class="mini-progress${pct > 100 ? ' over' : ''}" title="${pct}% of plan"><span style="width:${Math.min(100, pct)}%"></span></span> <span class="num">${pct}%</span>`}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;

    sessions.sort((x, y) => y.start - x.start);
    const sessCard = sessions.length ? `
      <div class="card ins-card">
        <div class="ins-card-head"><h2>Tracked sessions</h2><span class="muted small">${sessions.length} in this period</span></div>
        <div class="table-scroll"><table class="ins-table">
          <thead><tr><th>Item</th><th>When</th><th class="r">Duration</th><th></th></tr></thead>
          <tbody>${sessions.slice(0, 40).map(s => `
            <tr class="cat-${s.category}">
              <td><span class="item">${esc(s.title || 'Untitled')}</span></td>
              <td class="num">${esc(fmtShortDate(toISO(new Date(s.start))))}, ${esc(fmtTs(s.start))} – ${s.end == null ? '<b>now</b>' : esc(fmtTs(s.end))}</td>
              <td class="r">${fmtDur(s.dur)}</td>
              <td class="r">${s.end == null ? '' : `<button type="button" class="icon-btn sm" data-del-entry="${esc(s.id)}" aria-label="Delete session" title="Delete session">${ICON.trash}</button>`}</td>
            </tr>`).join('')}</tbody>
        </table></div>
      </div>` : '';

    insightsEl.innerHTML = kpis +
      (chartCard ? `<div class="ins-grid">${chartCard}${catCard}</div>` : `<div class="ins-grid" style="grid-template-columns:1fr">${catCard}</div>`) +
      table + (sessCard ? `<div style="height:16px"></div>${sessCard}` : '');
  }

  // Grouped bar chart: planned vs tracked minutes per day.
  function barChart(dates, P, T, view) {
    const W = 640, H = 230, padL = 34, padR = 6, padT = 10, padB = 28;
    const n = dates.length;
    const maxH = Math.max(1, ...dates.map(d => Math.max(P[d], T[d]))) / 60;
    const stepH = maxH <= 4 ? 1 : maxH <= 8 ? 2 : maxH <= 16 ? 4 : 8;
    const top = Math.ceil(maxH / stepH) * stepH;
    const plotH = H - padT - padB, plotW = W - padL - padR;
    const y = min => padT + plotH - (min / 60) / top * plotH;
    const gw = plotW / n;
    const bw = Math.max(2, Math.min(16, gw * 0.34));
    const today = todayISO();
    const bar = (x, min, cls) => {
      if (min <= 0) return '';
      const yy = y(min), base = padT + plotH, h = base - yy, r = Math.min(4, bw / 2, h);
      return `<path class="${cls}" d="M${x},${base}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${base}Z"/>`;
    };
    let out = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Planned versus tracked hours per day">`;
    for (let h = 0; h <= top; h += stepH) {
      const yy = y(h * 60);
      out += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text x="${padL - 6}" y="${yy + 4}" text-anchor="end">${h}h</text>`;
    }
    const labelEvery = view === 'month' ? Math.ceil(n / 10) : 1;
    dates.forEach((d, i) => {
      const gx = padL + i * gw;
      const cx = gx + gw / 2;
      out += bar(cx - bw - 1, P[d], 'bar-planned') + bar(cx + 1, T[d], 'bar-tracked');
      if (i % labelEvery === 0 || d === today) {
        const lbl = view === 'week' ? `${DOW_SHORT[dowOf(d)]} ${fromISO(d).getDate()}` : fromISO(d).getDate();
        out += `<text x="${cx}" y="${H - 8}" text-anchor="middle"${d === today ? ' style="font-weight:700;fill:var(--text)"' : ''}>${esc(lbl)}</text>`;
      }
      const diff = T[d] - P[d];
      const tip = `<b>${esc(fmtShortDate(d))}</b><br>Planned: <b>${fmtDur(P[d])}</b><br>Tracked: <b>${fmtDur(T[d])}</b>` +
        (P[d] ? `<br>${diff >= 0 ? '+' : '−'}${fmtDur(Math.abs(diff))} vs. plan` : '');
      out += `<rect class="hit" x="${gx}" y="${padT}" width="${gw}" height="${plotH}" data-tip="${esc(tip)}"/>`;
    });
    return out + '</svg>';
  }

  // Hover tooltips for charts
  function attachTips(el) {
    el.addEventListener('pointermove', e => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tooltip.hidden = true; return; }
      tooltip.innerHTML = t.getAttribute('data-tip');
      tooltip.hidden = false;
      const r = tooltip.getBoundingClientRect();
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    });
    el.addEventListener('pointerleave', () => { tooltip.hidden = true; });
  }
  attachTips(insightsEl);
  insightsEl.addEventListener('click', e => {
    const del = e.target.closest('[data-del-entry]');
    if (!del) return;
    withUndo('Session deleted', () => { state.entries = state.entries.filter(x => x.id !== del.dataset.delEntry); });
  });

  // ---------- Vision: board, goals, journal ----------
  const visionEl = $('#vision-content');
  attachTips(visionEl);
  let goalFilter = 'active';
  let goalPrefillArea = null;
  let visSaveT = null;
  const findGoal = id => state.vision.goals.find(g => g.id === id);
  const areaOptions = sel => LIFE_AREAS.map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${a.emoji} ${esc(a.name)}</option>`).join('');
  const horizonOptions = sel => HORIZONS.map(([id, l]) => `<option value="${id}"${id === sel ? ' selected' : ''}>${l}</option>`).join('');

  // Typing autosaves shortly after you stop.
  function saveSoon() {
    clearTimeout(visSaveT);
    visSaveT = setTimeout(() => {
      visSaveT = null;
      save();
      visionEl.querySelectorAll('.saved-hint').forEach(n => {
        n.textContent = 'Saved ✓';
        n.classList.add('on');
        clearTimeout(n._t);
        n._t = setTimeout(() => n.classList.remove('on'), 1500);
      });
    }, 450);
  }

  function todaysAffirmation() {
    const a = state.vision.affirmations;
    if (!a.length) return '';
    let h = 0;
    for (const c of todayISO()) h = (h * 31 + c.charCodeAt(0)) | 0;
    return a[Math.abs(h) % a.length].text;
  }

  function renderVision() {
    const v = state.settings.visView;
    if (v === 'goals') renderGoals();
    else if (v === 'journal') renderJournal();
    else renderBoard();
  }

  function renderBoard() {
    const V = state.vision;
    const aff = todaysAffirmation();
    visionEl.innerHTML = `
      <div class="card vis-hero">
        <span class="eyebrow">Today's affirmation</span>
        <p class="affirm-big">${aff ? esc(aff) : 'Add an affirmation below and one will greet you here every day.'}</p>
      </div>
      <div class="vis-grid">
        <div class="card vis-card">
          <div class="vis-head"><h2>My vision</h2><span class="saved-hint"></span></div>
          <p class="muted small">Describe the life you're creating as if it's already real: present tense, with feeling.</p>
          <textarea data-bind="statement" rows="7" placeholder="I wake up full of energy in my bright, peaceful home. My work…">${esc(V.statement)}</textarea>
        </div>
        <div class="card vis-card">
          <div class="vis-head"><h2>Affirmations</h2><span class="muted small">${V.affirmations.length}</span></div>
          <form class="inline-form" data-form="affirmation" autocomplete="off">
            <input type="text" name="text" maxlength="200" placeholder="I am… / I attract… / I deserve…" aria-label="New affirmation">
            <button class="btn" type="submit">Add</button>
          </form>
          <ul class="affirm-list">${V.affirmations.map(a => `<li><span>${esc(a.text)}</span><button type="button" class="icon-btn sm" data-del-aff="${esc(a.id)}" aria-label="Remove affirmation" title="Remove">${ICON.trash}</button></li>`).join('') || '<li class="muted small">No affirmations yet. Try “I am becoming the person I want to be.”</li>'}</ul>
        </div>
      </div>
      <div class="card vis-card">
        <div class="vis-head"><h2>Vision board</h2><span class="muted small">${V.board.length} dream${V.board.length === 1 ? '' : 's'}</span></div>
        <form class="inline-form tile-form" data-form="tile" autocomplete="off">
          <input type="text" name="emoji" maxlength="4" placeholder="🌴" aria-label="Emoji" class="emoji-in">
          <input type="text" name="text" maxlength="120" placeholder="Travel to Japan, run a marathon, own a home…" aria-label="Dream">
          <select name="area" aria-label="Life area">${areaOptions('purpose')}</select>
          <button class="btn primary" type="submit">Add</button>
        </form>
        <div class="tiles">${V.board.map(t => {
          const a = areaOf(t.area);
          return `<div class="tile cat-${a.cat}"><span class="tile-emoji">${esc(t.emoji)}</span><span class="tile-text">${esc(t.text)}</span>` +
            `<span class="tile-area">${esc(a.name)}</span><button type="button" class="tile-del" data-del-tile="${esc(t.id)}" aria-label="Remove ${esc(t.text)}">×</button></div>`;
        }).join('') || '<p class="muted small">Add the things you want to see in your life, with an emoji that makes you feel them.</p>'}</div>
      </div>
      <div class="card vis-card">
        <div class="vis-head"><h2>Wheel of life</h2><span class="saved-hint"></span></div>
        <p class="muted small">How satisfied are you with each area right now? 1 = not at all, 10 = completely.</p>
        <div class="wheel-wrap">
          <div class="wheel-chart" id="wheel-chart">${wheelSVG()}</div>
          <div class="wheel-sliders">${LIFE_AREAS.map(a => `
            <label class="wheel-row"><span class="wl">${a.emoji} ${esc(a.name)}</span>
              <input type="range" min="1" max="10" step="1" value="${V.areas[a.id]}" data-area="${a.id}" aria-label="${esc(a.name)} satisfaction">
              <b class="num" data-area-val="${a.id}">${V.areas[a.id]}</b></label>`).join('')}
          </div>
        </div>
        <div class="wheel-tip" id="wheel-tip">${wheelTip()}</div>
      </div>`;
  }

  function wheelSVG() {
    const A = state.vision.areas, n = LIFE_AREAS.length, cx = 170, cy = 160, R = 112;
    const pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]; };
    const poly = r => LIFE_AREAS.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ');
    let s = `<svg class="chart-svg wheel-svg" viewBox="-70 0 480 320" role="img" aria-label="Wheel of life: ${LIFE_AREAS.map(a => `${a.name} ${A[a.id]} of 10`).join(', ')}">`;
    for (const lvl of [2, 4, 6, 8, 10]) s += `<polygon class="ring" points="${poly(R * lvl / 10)}"/>`;
    LIFE_AREAS.forEach((_, i) => { const [x, y] = pt(i, R); s += `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
    s += `<polygon class="shape" points="${LIFE_AREAS.map((a, i) => pt(i, R * A[a.id] / 10).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
    LIFE_AREAS.forEach((a, i) => {
      const [x, y] = pt(i, R * A[a.id] / 10);
      s += `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/><circle class="hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" data-tip="<b>${esc(a.name)}</b>: ${A[a.id]}/10"/>`;
      const [lx, ly] = pt(i, R + 18);
      const anchor = Math.abs(lx - cx) < 5 ? 'middle' : lx > cx ? 'start' : 'end';
      s += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}">${a.emoji} ${esc(a.name.split(' ')[0])} · ${A[a.id]}</text>`;
    });
    return s + '</svg>';
  }

  function wheelTip() {
    const A = state.vision.areas;
    const low = [...LIFE_AREAS].sort((a, b) => A[a.id] - A[b.id])[0];
    const avg = (sum(LIFE_AREAS, a => A[a.id]) / LIFE_AREAS.length).toFixed(1);
    return `Average <b>${avg}</b>/10. Needs the most love: <b>${low.emoji} ${esc(low.name)}</b> (${A[low.id]}/10). ` +
      `<button type="button" class="link-btn" data-goal-area="${low.id}">Set a goal for ${esc(low.name)} →</button>`;
  }

  function renderGoals() {
    const G = state.vision.goals;
    const list = G.filter(g => goalFilter === 'all' || g.status === goalFilter);
    const counts = { active: G.filter(g => g.status === 'active').length, done: G.filter(g => g.status === 'done').length, all: G.length };
    let html = `
      <form class="card todo-form" data-form="goal" autocomplete="off">
        <input type="text" name="title" maxlength="160" placeholder="What do you want to achieve?" aria-label="New goal" required>
        <div class="todo-form-opts">
          <select name="area" aria-label="Life area">${areaOptions(goalPrefillArea || 'growth')}</select>
          <select name="horizon" aria-label="Time frame">${horizonOptions('year')}</select>
          <input type="date" name="target" aria-label="Target date">
          <button class="btn primary" type="submit">Add goal</button>
        </div>
      </form>
      <div class="filters">${[['active', 'Active'], ['done', 'Achieved'], ['all', 'All']].map(([id, l]) =>
        `<button type="button" class="chip" data-goal-filter="${id}" aria-pressed="${goalFilter === id}">${l}<span class="count">${counts[id]}</span></button>`).join('')}</div>`;
    goalPrefillArea = null;
    if (!list.length) {
      html += goalFilter === 'done'
        ? emptyState('No achieved goals yet', 'Mark a goal as achieved and celebrate it here.')
        : emptyState('No goals yet', 'Add a big goal above, then break it into small steps you can put on your to-do list.');
    }
    for (const [hid, label] of HORIZONS) {
      const gs = list.filter(g => g.horizon === hid);
      if (gs.length) html += `<div class="todo-section"><h2 class="section-title">${esc(label)}</h2><div class="goal-grid">${gs.map(goalCard).join('')}</div></div>`;
    }
    visionEl.innerHTML = html;
  }

  function goalCard(g) {
    const a = areaOf(g.area);
    const total = g.milestones.length, done = g.milestones.filter(m => m.done).length;
    const pct = g.status === 'done' ? 100 : total ? Math.round(done / total * 100) : 0;
    const target = g.target ? `<span class="pill${g.status === 'active' && g.target < todayISO() ? ' overdue' : ''}">By ${esc(fmtShortDate(g.target))}</span>` : '';
    return `<div class="card goal-card cat-${a.cat}${g.status === 'done' ? ' achieved' : ''}" data-goal="${esc(g.id)}">
      <div class="goal-head">
        <span class="goal-emoji" aria-hidden="true">${a.emoji}</span>
        <div class="goal-title"><h3>${esc(g.title)}</h3>
          <div class="todo-meta"><span class="pill">${esc(a.name)}</span>${target}${g.status === 'done' ? '<span class="pill live">Achieved 🎉</span>' : ''}</div></div>
        <button type="button" class="icon-btn sm" data-act="goal-edit" aria-label="Edit goal" title="Edit">${ICON.pencil}</button>
      </div>
      ${g.why ? `<p class="goal-why">“${esc(g.why)}”</p>` : ''}
      <div class="goal-progress"><div class="progress"><span style="width:${pct}%"></span></div><span class="num">${total ? `${done}/${total} steps` : `${pct}%`}</span></div>
      <ul class="milestones">${g.milestones.map(m => `
        <li data-ms="${esc(m.id)}" class="${m.done ? 'done' : ''}">
          <input type="checkbox" class="todo-check" data-act="ms-toggle" ${m.done ? 'checked' : ''} aria-label="Step done: ${esc(m.title)}">
          <span class="ms-title">${esc(m.title)}</span>
          ${m.taskId && findTask(m.taskId) ? '<span class="pill" title="On your to-do list">In to-do</span>'
            : m.done ? '' : '<button type="button" class="link-btn sm" data-act="ms-task" title="Add this step to your to-do list">+ To-do</button>'}
          <button type="button" class="icon-btn sm hover-only" data-act="ms-del" aria-label="Remove step" title="Remove">${ICON.trash}</button>
        </li>`).join('')}</ul>
      ${g.status === 'active' ? `<form class="inline-form ms-form" data-form="milestone" autocomplete="off"><input type="text" name="title" maxlength="160" placeholder="Add a step…" aria-label="New step"><button class="btn sm" type="submit">Add</button></form>` : ''}
      <div class="goal-foot">${g.status === 'active'
        ? '<button type="button" class="btn sm" data-act="goal-done">Mark achieved 🎉</button>'
        : '<button type="button" class="btn sm" data-act="goal-reopen">Reopen</button>'}</div>
    </div>`;
  }

  const blankEntry = () => ({ mood: null, gratitude: ['', '', ''], intention: '', script: '', notes: '' });
  function journalEntry(date, create) {
    const J = state.vision.journal;
    if (!J[date] && create) J[date] = blankEntry();
    return J[date] || blankEntry();
  }
  const hasContent = j => !!j && (j.mood != null || j.gratitude.some(Boolean) || !!j.intention || !!j.script || !!j.notes);
  function journalStreak() {
    let d = todayISO(), n = 0;
    if (!hasContent(state.vision.journal[d])) d = addDays(d, -1);
    while (hasContent(state.vision.journal[d])) { n++; d = addDays(d, -1); }
    return n;
  }

  function renderJournal() {
    const d = currentDate, j = journalEntry(d, false), streak = journalStreak();
    const recent = Object.keys(state.vision.journal).filter(x => x !== d && hasContent(state.vision.journal[x])).sort().reverse().slice(0, 7);
    visionEl.innerHTML = `
      <div class="journal-grid">
        <div class="card vis-card">
          <div class="vis-head"><h2>How do you feel?</h2>${streak ? `<span class="streak">🔥 ${streak}-day streak</span>` : ''}</div>
          <div class="moods" role="group" aria-label="Mood">${MOODS.map(([emo, label], i) =>
            `<button type="button" class="mood" data-mood="${i}" aria-pressed="${j.mood === i}" title="${label}"><span>${emo}</span><small>${label}</small></button>`).join('')}</div>
        </div>
        <div class="card vis-card">
          <div class="vis-head"><h2>Today's intention</h2><span class="saved-hint"></span></div>
          <input type="text" data-j="intention" maxlength="200" value="${esc(j.intention)}" placeholder="Today I will…" aria-label="Intention">
        </div>
        <div class="card vis-card">
          <div class="vis-head"><h2>I'm grateful for…</h2></div>
          <div class="grat-list">${[0, 1, 2].map(i => `<input type="text" data-j="gratitude.${i}" maxlength="200" value="${esc(j.gratitude[i])}" placeholder="${i + 1}." aria-label="Gratitude ${i + 1}">`).join('')}</div>
        </div>
        <div class="card vis-card">
          <div class="vis-head"><h2>Manifestation scripting</h2></div>
          <p class="muted small">Write about what you want as if it has already happened, and feel grateful for it.</p>
          <textarea data-j="script" rows="5" placeholder="I'm so happy and grateful now that…" aria-label="Manifestation scripting">${esc(j.script)}</textarea>
        </div>
        <div class="card vis-card wide">
          <div class="vis-head"><h2>Reflection</h2></div>
          <textarea data-j="notes" rows="3" placeholder="What went well? What did I learn? What will I do differently tomorrow?" aria-label="Reflection">${esc(j.notes)}</textarea>
        </div>
        <div class="card vis-card wide">
          <div class="vis-head"><h2>Earlier entries</h2></div>
          ${recent.length ? `<ul class="j-recent">${recent.map(x => {
            const e = state.vision.journal[x];
            return `<li><button type="button" data-goto-date="${x}"><span class="j-mood">${e.mood != null ? MOODS[e.mood][0] : '📝'}</span>` +
              `<span class="j-date">${esc(dayLabel(x))}</span><span class="j-snip">${esc(e.intention || e.gratitude.find(Boolean) || e.script || e.notes)}</span></button></li>`;
          }).join('')}</ul>` : '<p class="muted small">Your past entries will show up here. Use ← → at the top to move between days.</p>'}
        </div>
      </div>`;
  }

  visionEl.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.bind === 'statement') { state.vision.statement = t.value; saveSoon(); }
    else if (t.dataset.j) {
      const j = journalEntry(currentDate, true);
      const [k, i] = t.dataset.j.split('.');
      if (i != null) j[k][+i] = t.value; else j[k] = t.value;
      saveSoon();
    } else if (t.dataset.area) {
      state.vision.areas[t.dataset.area] = +t.value;
      visionEl.querySelector(`[data-area-val="${t.dataset.area}"]`).textContent = t.value;
      $('#wheel-chart').innerHTML = wheelSVG();
      $('#wheel-tip').innerHTML = wheelTip();
      saveSoon();
    }
  });

  visionEl.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const val = n => (f.elements[n]?.value || '').trim();
    const V = state.vision;
    const kind = f.dataset.form;
    const goalId = f.closest('[data-goal]')?.dataset.goal;
    if (kind === 'affirmation') {
      const text = val('text');
      if (!text) return;
      V.affirmations.push({ id: uid(), text });
    } else if (kind === 'tile') {
      const text = val('text');
      if (!text) return;
      V.board.push({ id: uid(), text, emoji: val('emoji') || areaOf(val('area')).emoji, area: val('area') });
    } else if (kind === 'goal') {
      const title = val('title');
      if (!title) return;
      V.goals.push({ id: uid(), title, area: val('area'), horizon: val('horizon'), target: val('target'), why: '', status: 'active', created: Date.now(), doneAt: null, milestones: [] });
      if (goalFilter === 'done') goalFilter = 'active';
      toast('Goal added. Now break it into small steps.');
    } else if (kind === 'milestone') {
      const g = findGoal(goalId);
      const title = val('title');
      if (!g || !title) return;
      g.milestones.push({ id: uid(), title, done: false });
    }
    save();
    renderAll();
    // Keep the cursor in the same box so you can add several in a row.
    const name = kind === 'affirmation' || kind === 'tile' ? 'text' : 'title';
    const scope = kind === 'milestone' ? visionEl.querySelector(`[data-goal="${goalId}"]`) : visionEl;
    scope?.querySelector(`[data-form="${kind}"] input[name="${name}"]`)?.focus();
  });

  visionEl.addEventListener('click', e => {
    const el = e.target.closest('[data-del-aff],[data-del-tile],[data-goal-area],[data-goal-filter],[data-mood],[data-goto-date],[data-act]');
    if (!el) return;
    const V = state.vision;
    if (el.dataset.delAff) { withUndo('Affirmation removed', () => { V.affirmations = V.affirmations.filter(a => a.id !== el.dataset.delAff); }); return; }
    if (el.dataset.delTile) { withUndo('Removed from your vision board', () => { V.board = V.board.filter(t => t.id !== el.dataset.delTile); }); return; }
    if (el.dataset.goalArea) {
      goalPrefillArea = el.dataset.goalArea;
      setView('goals');
      visionEl.querySelector('[data-form="goal"] input[name="title"]')?.focus();
      return;
    }
    if (el.dataset.goalFilter) { goalFilter = el.dataset.goalFilter; renderVision(); return; }
    if (el.dataset.mood != null) {
      const j = journalEntry(currentDate, true);
      const m = +el.dataset.mood;
      j.mood = j.mood === m ? null : m;
      save();
      renderVision();
      return;
    }
    if (el.dataset.gotoDate) { currentDate = el.dataset.gotoDate; renderAll(); return; }
    const g = findGoal(el.closest('[data-goal]')?.dataset.goal);
    if (!g) return;
    const m = g.milestones.find(x => x.id === el.closest('[data-ms]')?.dataset.ms);
    switch (el.dataset.act) {
      case 'goal-edit': openGoalDialog(g); break;
      case 'goal-done':
        g.status = 'done'; g.doneAt = Date.now();
        save(); renderAll();
        toast(`🎉 Goal achieved: “${g.title}”. Well done!`);
        break;
      case 'goal-reopen': g.status = 'active'; g.doneAt = null; save(); renderAll(); break;
      case 'ms-toggle': {
        if (!m) return;
        m.done = el.checked;
        const t = m.taskId && findTask(m.taskId);
        if (t && t.done !== m.done) { setTaskDone(t, m.done); return; }
        save(); renderAll();
        break;
      }
      case 'ms-task': {
        if (!m) return;
        const t = addTask({ title: m.title, category: 'personal' });
        m.taskId = t.id;
        save(); renderAll();
        toast('Added to your to-do list.');
        break;
      }
      case 'ms-del': if (m) withUndo('Step removed', () => { g.milestones = g.milestones.filter(x => x !== m); }); break;
    }
  });

  // Goal edit dialog
  const goalDialog = $('#goal-dialog');
  let editingGoalId = null;
  $('#g-area').innerHTML = areaOptions('growth');
  $('#g-horizon').innerHTML = horizonOptions('year');
  function openGoalDialog(g) {
    editingGoalId = g.id;
    $('#g-title').value = g.title;
    $('#g-area').value = g.area;
    $('#g-horizon').value = g.horizon;
    $('#g-target').value = g.target;
    $('#g-why').value = g.why;
    $('#g-error').hidden = true;
    goalDialog.showModal();
  }
  $('#goal-form').addEventListener('submit', e => {
    e.preventDefault();
    const g = findGoal(editingGoalId);
    if (!g) return goalDialog.close();
    const title = $('#g-title').value.trim();
    if (!title) return showError($('#g-error'), 'Give your goal a name.');
    Object.assign(g, { title, area: $('#g-area').value, horizon: $('#g-horizon').value, target: $('#g-target').value, why: $('#g-why').value.trim() });
    save();
    goalDialog.close();
    renderAll();
  });
  $('#g-delete').addEventListener('click', () => {
    const g = findGoal(editingGoalId);
    goalDialog.close();
    if (g) withUndo(`Deleted goal “${g.title}”`, () => { state.vision.goals = state.vision.goals.filter(x => x !== g); });
  });

  // ---------- Timer bar ----------
  function renderTimerBar() {
    const t = state.timer;
    document.body.classList.toggle('has-timer', !!t);
    timerBar.hidden = !t;
    if (!t) return;
    const info = refInfo(t.ref);
    const last = [...state.entries].reverse().find(e => e.ref === t.ref);
    timerTitle.textContent = info?.title ?? last?.title ?? 'Timer';
    timerBar.classList.toggle('paused', t.status === 'paused');
    const total = trackedMs(t.ref);
    const planned = plannedForRef(t.ref);
    timerClock.textContent = fmtClock(total);
    const open = openEntry();
    timerSub.textContent = (t.status === 'paused' ? 'Paused' : `This session ${fmtClock(open ? Date.now() - open.start : 0)}`) +
      (planned ? ` · planned ${fmtDur(planned)}${total / 60000 > planned ? ' (over)' : ''}` : '');
    timerToggle.textContent = t.status === 'paused' ? 'Resume' : 'Pause';
  }
  timerToggle.addEventListener('click', () => {
    if (!state.timer) return;
    if (state.timer.status === 'running') pauseTimer(); else startTimer(state.timer.ref);
  });
  $('#timer-stop').addEventListener('click', stopTimer);

  // ---------- Category & repeat editors ----------
  function catPicker(el, name) {
    el.innerHTML = CATEGORIES.map(c =>
      `<label class="cat-opt cat-${c.id}"><input type="radio" name="${name}" value="${c.id}"><span>${c.name}</span></label>`).join('');
    return {
      set: v => el.querySelectorAll('input').forEach(i => { i.checked = i.value === v; }),
      get: () => el.querySelector('input:checked')?.value || 'work',
    };
  }

  function repeatEditor(el, startDate) {
    const id = el.id;
    el.innerHTML = `
      <div class="repeat-line">
        <label class="field"><span>Repeat</span>
          <select class="r-freq"><option value="">Doesn't repeat</option>${Object.entries(REPEAT_FREQS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        </label>
        <label class="field narrow r-iv-wrap"><span class="r-iv-label">Every</span><input type="number" class="r-iv" min="1" max="99" value="1" inputmode="numeric"></label>
        <label class="field r-until-wrap"><span>Ends (optional)</span><input type="date" class="r-until"></label>
      </div>
      <div class="dow-picker r-days" role="group" aria-label="Repeat on">${range(0, 6).map(i => {
        const d = (state.settings.weekStart + i) % 7;
        return `<label><input type="checkbox" value="${d}" id="${id}-d${d}"><span>${esc(DOW_SHORT[d].slice(0, 2))}</span></label>`;
      }).join('')}</div>
      <div class="repeat-summary"></div>`;
    const freq = el.querySelector('.r-freq'), iv = el.querySelector('.r-iv'), until = el.querySelector('.r-until');
    const days = el.querySelector('.r-days'), summary = el.querySelector('.repeat-summary');
    const get = () => normRepeat(freq.value ? {
      freq: freq.value, interval: iv.value,
      days: [...days.querySelectorAll('input:checked')].map(i => +i.value), until: until.value,
    } : null);
    const sync = () => {
      const f = freq.value;
      el.querySelector('.r-iv-wrap').hidden = !f || f === 'weekdays';
      el.querySelector('.r-until-wrap').hidden = !f;
      days.hidden = f !== 'weekly';
      el.querySelector('.r-iv-label').textContent = f === 'daily' ? 'Every (days)' : f === 'weekly' ? 'Every (weeks)' : 'Every (months)';
      const r = get();
      summary.textContent = r ? describeRepeat(r, startDate()) : '';
      summary.hidden = !r;
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
    return {
      set(r) {
        freq.value = r?.freq || '';
        iv.value = r?.interval || 1;
        until.value = r?.until || '';
        const sel = r?.days?.length ? r.days : [dowOf(startDate())];
        days.querySelectorAll('input').forEach(i => { i.checked = sel.includes(+i.value); });
        sync();
      },
      get,
      sync,
    };
  }

  function renderTrackRow(el, ref) {
    const ms = trackedMs(ref);
    const planned = plannedForRef(ref);
    const timing = state.timer?.ref === ref;
    const running = timing && state.timer.status === 'running';
    el.innerHTML =
      `<div class="track-text">Tracked <b>${fmtDur(ms / 60000)}</b>${planned ? ` of <b>${fmtDur(planned)}</b> planned` : ''}${running ? ' · <b>running</b>' : timing ? ' · paused' : ''}</div>` +
      `<button type="button" class="btn sm${running ? '' : ' primary'}" data-track="toggle">${running ? ICON.pause + 'Pause' : ICON.play + (timing ? 'Resume' : 'Start timer')}</button>` +
      (timing ? `<button type="button" class="btn sm" data-track="stop" title="Stop tracking and mark complete">Stop</button>` : '');
  }

  function showError(node, msg) { node.textContent = msg; node.hidden = false; }

  // Asks "only this one / this and following / all"; resolves with the choice or 'cancel'.
  let scopeResolve = null;
  function finishScope(value) {
    const done = scopeResolve;
    scopeResolve = null;
    if (scopeDialog.open) scopeDialog.close();
    done?.(value);
  }
  function askScope(title, text, allowFuture) {
    finishScope('cancel');
    return new Promise(resolve => {
      scopeResolve = resolve;
      $('#scope-title').textContent = title;
      $('#scope-text').textContent = text;
      scopeDialog.querySelector('[data-scope="future"]').hidden = !allowFuture;
      scopeDialog.showModal();
    });
  }
  scopeDialog.addEventListener('click', e => {
    const b = e.target.closest('[data-scope]');
    if (b) finishScope(b.dataset.scope);
    else if (e.target === scopeDialog) finishScope('cancel');
  });
  scopeDialog.addEventListener('cancel', e => { e.preventDefault(); finishScope('cancel'); });
  scopeDialog.addEventListener('close', () => finishScope('cancel'));

  // ---------- Block dialog ----------
  const bCat = catPicker($('#b-cat'), 'b-category');
  const bRepeat = repeatEditor($('#b-repeat'), () => bDate.value || currentDate);
  bDate.addEventListener('change', () => bRepeat.sync());
  let editingOcc = null, pendingTaskId = null;

  function openBlockDialog(data) {
    editingOcc = data.b ? data : null;
    pendingTaskId = data.b ? null : (data.taskId || null);
    const src = data.b || data;
    $('#block-dialog-title').textContent = data.b ? (data.b.repeat ? 'Edit repeating block' : 'Edit block') : 'New block';
    bTitle.value = src.title || '';
    bDate.value = data.date || currentDate;
    bStart.value = toHHMM(data.start ?? 9 * 60);
    bEnd.value = toHHMM(data.end ?? 10 * 60);
    bNotes.value = src.notes || '';
    bCat.set(src.category || lastCategory);
    bRepeat.set(src.repeat || null);
    bDelete.hidden = !data.b;
    bError.hidden = true;
    bTrack.hidden = !data.b;
    if (data.b) renderTrackRow(bTrack, data.ref);
    blockDialog.showModal();
    if (!data.b) bTitle.focus();
  }

  bTrack.addEventListener('click', e => {
    const b = e.target.closest('[data-track]');
    if (!b || !editingOcc) return;
    if (b.dataset.track === 'stop') { stopTimer(); blockDialog.close(); return; }
    toggleTimer(editingOcc.ref);
    renderTrackRow(bTrack, editingOcc.ref);
  });

  blockForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = bTitle.value.trim();
    const start = fromHHMM(bStart.value);
    let end = fromHHMM(bEnd.value);
    if (end === 0 && start > 0) end = 24 * 60;
    if (!title) return showError(bError, 'Give the block a name.');
    if (!bDate.value) return showError(bError, 'Pick a date.');
    if (Number.isNaN(start) || Number.isNaN(end)) return showError(bError, 'Enter a start and end time.');
    if (end <= start) return showError(bError, 'End time must be after the start time.');
    const repeat = bRepeat.get();
    if (repeat?.until && repeat.until < bDate.value) return showError(bError, 'The repeat end date is before the start date.');
    const category = bCat.get();
    lastCategory = category;
    const date = bDate.value;
    const data = { title, start, end, category, notes: bNotes.value.trim(), repeat };

    if (!editingOcc) {
      state.blocks.push({ id: uid(), date, ...data, skip: [], doneOn: [], ...(pendingTaskId ? { taskId: pendingTaskId } : {}) });
    } else {
      const { b, date: occDate } = editingOcc;
      if (!b.repeat) {
        const oldRef = `block:${b.id}@${b.date}`;
        Object.assign(b, data, { date });
        if (!b.taskId) remapRef(oldRef, `block:${b.id}@${date}`);
      } else {
        const scope = await askScope('Edit repeating block', 'This block repeats. Which ones should change?', occDate > b.date);
        if (scope === 'cancel') return;
        if (scope === 'one') detach(b, occDate, { ...data, date, repeat: null });
        else if (scope === 'future') splitFuture(b, occDate, { ...data, date });
        else {
          const shift = dayNum(date) - dayNum(occDate);
          Object.assign(b, data);
          if (shift) b.date = addDays(b.date, shift);
          if (!data.repeat) { b.date = date; b.skip = []; }
        }
      }
    }
    save();
    blockDialog.close();
    const [a, z] = periodRange();
    if (date < a || date > z) {
      currentDate = date;
      toast(`Saved to ${dayLabel(date)}`);
    }
    renderAll();
  });

  bDelete.addEventListener('click', async () => {
    if (!editingOcc) return;
    const { b, date } = editingOcc;
    if (!b.repeat) {
      blockDialog.close();
      withUndo('Block deleted', () => removeBlock(b.id));
      return;
    }
    const scope = await askScope('Delete repeating block', 'Delete only this one, or more of the series?', date > b.date);
    if (scope === 'cancel') return;
    blockDialog.close();
    withUndo(scope === 'all' ? 'Series deleted' : 'Deleted', () => {
      if (scope === 'one') { b.skip.push(date); b.doneOn = b.doneOn.filter(d => d !== date); }
      else if (scope === 'future' && date > b.date) b.repeat = { ...b.repeat, until: addDays(date, -1) };
      else removeBlock(b.id);
    });
  });

  // ---------- Task dialog ----------
  const tCat = catPicker($('#t-cat'), 't-category');
  const tRepeat = repeatEditor($('#t-repeat'), () => tDue.value || todayISO());
  tDue.addEventListener('change', () => tRepeat.sync());
  let editingTaskId = null;

  function openTaskDialog(t) {
    editingTaskId = t.id;
    tTitle.value = t.title;
    tPriority.value = t.priority;
    tDue.value = t.due || '';
    if (![...tEstimate.options].some(o => +o.value === t.estimate)) {
      tEstimate.insertAdjacentHTML('beforeend', `<option value="${t.estimate}">${fmtDur(t.estimate)}</option>`);
    }
    tEstimate.value = String(t.estimate || 0);
    tNotes.value = t.notes || '';
    tCat.set(t.category);
    tRepeat.set(t.repeat);
    tError.hidden = true;
    tTrack.hidden = t.done && !state.entries.some(e => e.ref === 'task:' + t.id);
    renderTrackRow(tTrack, 'task:' + t.id);
    if (t.done) tTrack.querySelectorAll('[data-track]').forEach(b => b.remove());
    taskDialog.showModal();
  }

  tTrack.addEventListener('click', e => {
    const b = e.target.closest('[data-track]');
    if (!b || !editingTaskId) return;
    const ref = 'task:' + editingTaskId;
    if (b.dataset.track === 'stop') { stopTimer(); taskDialog.close(); return; }
    toggleTimer(ref);
    renderTrackRow(tTrack, ref);
  });

  taskForm.addEventListener('submit', e => {
    e.preventDefault();
    const t = findTask(editingTaskId);
    if (!t) return taskDialog.close();
    const title = tTitle.value.trim();
    if (!title) return showError(tError, 'The task needs a name.');
    const repeat = tRepeat.get();
    let due = tDue.value;
    if (repeat && !due) due = todayISO();
    if (repeat?.until && repeat.until < due) return showError(tError, 'The repeat end date is before the due date.');
    Object.assign(t, { title, priority: tPriority.value, due, notes: tNotes.value.trim(), estimate: +tEstimate.value || 0, category: tCat.get(), repeat });
    save();
    taskDialog.close();
    renderAll();
  });

  tDelete.addEventListener('click', () => {
    const t = findTask(editingTaskId);
    taskDialog.close();
    if (t) withUndo(`Deleted “${t.title}”`, () => deleteTask(t.id));
  });

  // Close buttons and backdrop clicks for all dialogs
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  });

  // ---------- Settings ----------
  function openSettings() {
    sStart.innerHTML = range(0, 23).map(h => `<option value="${h}">${esc(fmtHour(h))}</option>`).join('');
    sEnd.innerHTML = range(1, 24).map(h => `<option value="${h}">${h === 24 ? 'Midnight' : esc(fmtHour(h))}</option>`).join('');
    sStart.value = state.settings.dayStart;
    sEnd.value = state.settings.dayEnd;
    sWeek.value = state.settings.weekStart;
    sTheme.value = state.settings.theme;
    settingsDialog.showModal();
  }

  sStart.addEventListener('change', () => {
    const v = +sStart.value;
    state.settings.dayStart = v;
    if (state.settings.dayEnd <= v) { state.settings.dayEnd = v + 1; sEnd.value = v + 1; }
    save(); renderAll();
  });
  sEnd.addEventListener('change', () => {
    const v = +sEnd.value;
    state.settings.dayEnd = v;
    if (state.settings.dayStart >= v) { state.settings.dayStart = v - 1; sStart.value = v - 1; }
    save(); renderAll();
  });
  sWeek.addEventListener('change', () => {
    state.settings.weekStart = +sWeek.value;
    save(); renderAll();
    bRepeatRebuild();
  });
  sTheme.addEventListener('change', () => { state.settings.theme = sTheme.value; save(); applyTheme(); });
  darkQuery.addEventListener?.('change', applyTheme);
  // Weekday order in repeat pickers follows the week-start setting.
  let bRep = bRepeat, tRep = tRepeat;
  function bRepeatRebuild() {
    Object.assign(bRep, repeatEditor($('#b-repeat'), () => bDate.value || currentDate));
    Object.assign(tRep, repeatEditor($('#t-repeat'), () => tDue.value || todayISO()));
  }

  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dayblock-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    if (!file) return;
    file.text()
      .then(txt => {
        const data = JSON.parse(txt);
        if (!Array.isArray(data.blocks) || !Array.isArray(data.tasks)) throw new Error('bad file');
        if (!confirm('Replace all your current blocks, tasks and tracked time with this backup?')) return;
        state = normalize(data);
        save(); applyTheme(); renderAll();
        settingsDialog.close();
        toast('Backup restored.');
      })
      .catch(() => toast('That file is not a valid Dayblock backup.'))
      .finally(() => { importInput.value = ''; });
  });

  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('Erase all blocks, tasks and tracked time? This cannot be undone.')) return;
    const settings = state.settings;
    state = normalize({ settings });
    save(); applyTheme(); renderAll();
    settingsDialog.close();
    toast('All data erased.');
  });

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $('#install-group').hidden = false;
  });
  $('#install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $('#install-group').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#install-group').hidden = true; });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, undo) {
    const node = $('#toast');
    const hide = () => node.classList.remove('show');
    node.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    node.appendChild(span);
    if (undo) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Undo';
      b.addEventListener('click', () => { undo(); hide(); });
      node.appendChild(b);
    }
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hide, undo ? 6000 : 3500);
  }

  // ---------- Timeline pointer interactions ----------
  // Mouse: drag empty space to create, drag a block to move (also across days), drag its bottom edge to resize.
  // Touch: swiping always scrolls. Tap = open / create, press-and-hold a block = move it, bottom edge = resize.
  let drag = null;
  let pending = null;          // a touch press that may still turn into a tap, a hold-to-drag, or a scroll
  const HOLD_MS = 420;

  tbMain.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.check, .play')) return;
    const col = e.target.closest('.col');
    if (!col || !colsEl) return;
    const touch = e.pointerType !== 'mouse';
    if (!touch) e.preventDefault();
    const cols = [...colsEl.children];
    const node = e.target.closest('.block');
    const y = e.clientY - col.getBoundingClientRect().top;
    let d;
    if (node && !node.classList.contains('ghost')) {
      const o = findOcc(node.dataset.key);
      if (!o) return;
      d = {
        mode: e.target.closest('.resize') ? 'resize' : 'move',
        o, node, cols, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        newStart: o.start, newEnd: o.end, newDate: o.date, moved: false,
      };
    } else {
      d = { mode: 'create', col, cols, date: col.dataset.date, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, anchor: snap(yToMin(y)), clickMin: yToMin(y), moved: false, ghost: null };
    }
    if (!touch || d.mode === 'resize') {
      drag = d;
      d.touch = touch;
      try { colsEl.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      return;
    }
    // Touch: wait to see whether this is a tap, a hold, or a scroll.
    pending = d;
    if (d.mode === 'move') {
      d.timer = setTimeout(() => {
        if (pending !== d) return;
        pending = null;
        drag = d;
        d.touch = true;
        d.held = true;
        d.node.classList.add('dragging');
        navigator.vibrate?.(12);
        try { colsEl.setPointerCapture(d.pointerId); } catch { /* ignore */ }
      }, HOLD_MS);
    }
  });

  // While a held block is being dragged, stop the page from scrolling.
  tbMain.addEventListener('touchmove', e => { if (drag?.touch) e.preventDefault(); }, { passive: false });
  tbMain.addEventListener('contextmenu', e => { if (drag?.touch || pending) e.preventDefault(); });

  function clearPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending = null;
  }

  tbMain.addEventListener('pointermove', e => {
    if (pending && e.pointerId === pending.pointerId) {
      if (Math.abs(e.clientY - pending.startY) > 8 || Math.abs(e.clientX - pending.startX) > 8) clearPending(); // it's a scroll
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY, dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
    drag.moved = true;
    const [lo, hi] = dayBounds();
    const dMin = dy / HOUR_H * 60;

    if (drag.mode === 'move') {
      const len = drag.o.end - drag.o.start;
      const s = clamp(snap(drag.o.start + dMin), lo, Math.max(lo, hi - len));
      drag.newStart = s;
      drag.newEnd = s + len;
      if (drag.cols.length > 1) {
        const idx = drag.cols.findIndex(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; });
        const target = drag.cols[idx];
        if (target && target.dataset.date !== drag.newDate) {
          drag.newDate = target.dataset.date;
          target.appendChild(drag.node);
          drag.node.style.left = '2px';
          drag.node.style.width = 'calc(100% - 4px)';
        }
      }
    } else if (drag.mode === 'resize') {
      drag.newEnd = clamp(snap(drag.o.end + dMin), drag.o.start + SNAP, hi);
    } else {
      const cur = clamp(snap(yToMin(e.clientY - drag.col.getBoundingClientRect().top)), lo, hi);
      let s = Math.min(drag.anchor, cur), en = Math.max(drag.anchor, cur);
      if (en - s < SNAP) en = Math.min(s + SNAP, hi);
      if (en - s < SNAP) s = en - SNAP;
      drag.newStart = s;
      drag.newEnd = en;
      if (!drag.ghost) {
        drag.ghost = document.createElement('div');
        drag.ghost.className = 'block ghost';
        drag.ghost.style.left = '2px';
        drag.ghost.style.width = 'calc(100% - 4px)';
        drag.col.appendChild(drag.ghost);
      }
      setGeom(drag.ghost, s, en);
      drag.ghost.textContent = `${fmtTime(s)} – ${fmtTime(en)} · ${fmtDur(en - s)}`;
      return;
    }
    drag.node.classList.add('dragging');
    setGeom(drag.node, drag.newStart, drag.newEnd);
    const tEl = drag.node.querySelector('.block-time');
    if (tEl) tEl.textContent = `${fmtTime(drag.newStart)} – ${fmtTime(drag.newEnd)}`;
  });

  function endDrag(e, cancelled) {
    if (pending && e.pointerId === pending.pointerId) {
      const p = pending;
      clearPending();
      if (cancelled) return; // the browser took over to scroll — leave the timeline alone
      // A quick tap: open the block, or start a new one-hour block.
      if (p.mode === 'move') { openBlockDialog(p.o); return; }
      const [lo, hi] = dayBounds();
      const s = clamp(Math.floor(p.clickMin / 30) * 30, lo, hi - 30);
      openBlockDialog({ date: p.date, start: s, end: Math.min(s + 60, hi) });
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    d.ghost?.remove();
    if (cancelled) {
      if (d.moved) renderTimeblock(); else d.node?.classList.remove('dragging');
      return;
    }
    const [lo, hi] = dayBounds();
    if (d.held && !d.moved) { d.node.classList.remove('dragging'); return; }
    if (d.mode === 'create') {
      if (d.moved) openBlockDialog({ date: d.date, start: d.newStart, end: d.newEnd });
      else {
        const s = clamp(Math.floor(d.clickMin / 30) * 30, lo, hi - 30);
        openBlockDialog({ date: d.date, start: s, end: Math.min(s + 60, hi) });
      }
      return;
    }
    const o = d.o;
    if (!d.moved) { openBlockDialog(o); return; }
    if (d.newStart === o.start && d.newEnd === o.end && d.newDate === o.date) { renderTimeblock(); return; }
    const b = o.b;
    if (b.repeat) {
      detach(b, o.date, { date: d.newDate, start: d.newStart, end: d.newEnd });
      toast('Changed this occurrence only.');
    } else {
      const oldRef = `block:${b.id}@${b.date}`;
      Object.assign(b, { date: d.newDate, start: d.newStart, end: d.newEnd });
      if (!b.taskId) remapRef(oldRef, `block:${b.id}@${b.date}`);
      if (b.doneOn.length) b.doneOn = [b.date];
    }
    save();
    renderAll();
  }
  tbMain.addEventListener('pointerup', e => endDrag(e, false));
  tbMain.addEventListener('pointercancel', e => endDrag(e, true));

  tbMain.addEventListener('click', e => {
    const check = e.target.closest('.check');
    const play = e.target.closest('.play');
    if (check || play) {
      const o = findOcc((check || play).closest('.block').dataset.key);
      if (!o) return;
      if (check) setOccDone(o, !o.done);
      else toggleTimer(o.ref);
      return;
    }
    const head = e.target.closest('[data-goto]');
    if (head) { openDay(head.dataset.goto); return; }
    const chip = e.target.closest('.mchip');
    if (chip) { const o = findOcc(chip.dataset.key); if (o) openBlockDialog(o); return; }
    const cell = e.target.closest('.mcell');
    if (cell) openDay(cell.dataset.date);
  });

  // ---------- Drag tasks from the side list onto the timeline ----------
  let dropGhost = null;
  const clearDropGhost = () => { dropGhost?.remove(); dropGhost = null; };
  const dropStart = (e, col) => {
    const [lo, hi] = dayBounds();
    const y = e.clientY - col.getBoundingClientRect().top;
    return clamp(Math.floor(yToMin(y) / SNAP) * SNAP, lo, hi - 30);
  };

  unscheduledEl.addEventListener('dragstart', e => {
    const li = e.target.closest?.('.mini-task');
    if (!li) return;
    e.dataTransfer.setData(TASK_MIME, li.dataset.id);
    e.dataTransfer.setData('text/plain', findTask(li.dataset.id)?.title || '');
    e.dataTransfer.effectAllowed = 'copy';
    li.classList.add('dragging');
  });
  unscheduledEl.addEventListener('dragend', e => {
    e.target.closest?.('.mini-task')?.classList.remove('dragging');
    clearDropGhost();
  });
  tbMain.addEventListener('dragover', e => {
    const col = e.target.closest?.('.col');
    if (!col || !e.dataTransfer.types.includes(TASK_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const [, hi] = dayBounds();
    const s = dropStart(e, col), en = Math.min(s + 60, hi);
    if (!dropGhost) {
      dropGhost = document.createElement('div');
      dropGhost.className = 'block ghost';
      dropGhost.style.left = '2px';
      dropGhost.style.width = 'calc(100% - 4px)';
    }
    if (dropGhost.parentNode !== col) col.appendChild(dropGhost);
    setGeom(dropGhost, s, en);
    dropGhost.textContent = `${fmtTime(s)} – ${fmtTime(en)}`;
  });
  tbMain.addEventListener('dragleave', e => { if (!tbMain.contains(e.relatedTarget)) clearDropGhost(); });
  tbMain.addEventListener('drop', e => {
    const col = e.target.closest?.('.col');
    const id = e.dataTransfer.getData(TASK_MIME);
    clearDropGhost();
    if (!col || !id) return;
    e.preventDefault();
    const t = findTask(id);
    if (t) scheduleTask(t, col.dataset.date, dropStart(e, col));
  });

  // ---------- Other event wiring ----------
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  viewSwitch.addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) setView(b.dataset.view);
  });
  $('#settings-btn').addEventListener('click', openSettings);
  $('#prev-btn').addEventListener('click', () => step(-1));
  $('#next-btn').addEventListener('click', () => step(1));
  todayBtn.addEventListener('click', goToday);
  dayPicker.addEventListener('change', () => {
    if (!dayPicker.value) return;
    currentDate = dayPicker.value;
    renderAll();
    scrollToRelevant();
  });
  periodLabel.addEventListener('click', () => {
    try { dayPicker.showPicker(); } catch { dayPicker.focus(); }
  });

  quickTaskForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = quickTaskInput.value.trim();
    if (!title) return;
    addTask({ title, category: lastCategory });
    quickTaskInput.value = '';
    renderAll();
  });

  unscheduledEl.addEventListener('click', e => {
    const li = e.target.closest('.mini-task');
    const t = li && findTask(li.dataset.id);
    if (!t) return;
    if (e.target.closest('[data-act="schedule"]')) {
      const date = state.settings.tbView === 'day' || currentDate >= todayISO() ? currentDate : todayISO();
      const b = scheduleTask(t, date);
      if (b) toast(`Scheduled “${t.title}” ${dayLabel(b.date).toLowerCase()} at ${fmtTime(b.start)}`);
    } else {
      openTaskDialog(t);
    }
  });

  todoForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = todoTitle.value.trim();
    if (!title) return;
    const v = state.settings.todoView;
    let due = todoDue.value || (v === 'day' ? currentDate : '');
    const repeat = todoRepeat.value ? { freq: todoRepeat.value, interval: 1, days: [], until: '' } : null;
    if (repeat && !due) due = todayISO();
    addTask({ title, priority: todoPriority.value, due, repeat });
    todoTitle.value = '';
    todoDue.value = '';
    todoRepeat.value = '';
    if (v === 'list' && todoFilter === 'done') todoFilter = 'active';
    renderAll();
    todoTitle.focus();
  });

  filtersEl.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    todoFilter = b.dataset.filter;
    renderTodo();
  });

  clearDoneBtn.addEventListener('click', () => {
    const n = state.tasks.filter(t => t.done).length;
    withUndo(`Cleared ${n} completed task${n === 1 ? '' : 's'}`, () => {
      state.tasks.filter(t => t.done).forEach(t => deleteTask(t.id));
    });
  });

  todoContent.addEventListener('change', e => {
    if (!e.target.matches('.todo-check')) return;
    const t = findTask(e.target.closest('[data-id]').dataset.id);
    if (t) setTaskDone(t, e.target.checked);
  });

  todoContent.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { todoDue.value = add.dataset.add; todoTitle.focus(); todoTitle.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const head = e.target.closest('[data-goto]');
    if (head && !head.dataset.act) { openDay(head.dataset.goto); return; }
    const chip = e.target.closest('[data-task]');
    if (chip) { const t = findTask(chip.dataset.task); if (t) openTaskDialog(t); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) {
      const cell = e.target.closest('.mcell');
      if (cell) openDay(cell.dataset.date);
      return;
    }
    const t = findTask(btn.closest('[data-id]').dataset.id);
    if (!t) return;
    switch (btn.dataset.act) {
      case 'edit': openTaskDialog(t); break;
      case 'delete': withUndo(`Deleted “${t.title}”`, () => deleteTask(t.id)); break;
      case 'track': toggleTimer('task:' + t.id); break;
      case 'schedule': {
        const b = scheduleTask(t, t.due && t.due > todayISO() ? t.due : todayISO());
        if (b) toast(`Scheduled ${dayLabel(b.date).toLowerCase()} at ${fmtTime(b.start)}`);
        break;
      }
      case 'goto': currentDate = btn.dataset.date; state.settings.tbView = 'day'; setMode('timeblock'); break;
    }
  });

  function newItem() {
    const m = mode();
    if (m === 'todo') {
      if (state.settings.todoView === 'day' && !todoDue.value) todoDue.value = currentDate;
      todoTitle.focus();
      return;
    }
    if (m !== 'timeblock') return;
    const [lo, hi] = dayBounds();
    const date = state.settings.tbView === 'day' ? currentDate : (periodRange()[0] <= todayISO() && todayISO() <= periodRange()[1] ? todayISO() : periodRange()[0]);
    const s = nextFreeSlot(date, 60) ?? clamp(9 * 60, lo, hi - 60);
    openBlockDialog({ date, start: s, end: Math.min(s + 60, hi) });
  }
  fab.addEventListener('click', newItem);

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]') || document.body.dataset.auth === 'signedout' || document.body.dataset.auth === 'loading') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); return; }
    if (key === 't') { goToday(); return; }
    if (key === 'd' || key === 'w' || key === 'm') {
      const v = { d: 'day', w: 'week', m: 'month' }[key];
      if (VIEWS[mode()].some(x => x[0] === v)) setView(v);
      return;
    }
    if (key === 'n') { e.preventDefault(); newItem(); }
  });

  // Clock: timer display every second, timeline "now" refresh every 30 s, midnight rollover.
  let ticks = 0;
  setInterval(() => {
    ticks++;
    if (state.timer?.status === 'running') renderTimerBar();
    if (ticks % 30 !== 0) return;
    const t = todayISO();
    if (t !== lastToday) {
      if (currentDate === lastToday) currentDate = t;
      lastToday = t;
      renderAll();
    } else if (mode() === 'timeblock') {
      updateNow();
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !drag && !pending) renderAll(); });

  // Move the red "now" line and the current-block highlight without rebuilding the timeline (keeps scrolling smooth).
  function updateNow() {
    if (!colsEl?.isConnected) return;
    const today = todayISO(), m = nowMin();
    const [lo, hi] = dayBounds();
    colsEl.querySelectorAll('.now-line').forEach(n => n.remove());
    const col = colsEl.querySelector(`.col[data-date="${today}"]`);
    if (col && m >= lo && m <= hi) {
      const line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = minToY(m) + 'px';
      col.appendChild(line);
    }
    colsEl.querySelectorAll('.block[data-key]').forEach(n => {
      const o = findOcc(n.dataset.key);
      if (o) n.classList.toggle('now', o.date === today && m >= o.start && m < o.end);
    });
  }

  // Keep tabs in sync if the app is open twice.
  window.addEventListener('storage', e => {
    if (e.key === storeKey && !drag) { state = loadFrom(storeKey); applyTheme(); renderAll(); }
  });
  // Only re-layout when the width changes — phones fire "resize" when the address bar hides while scrolling.
  let resizeT, lastWidth = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (!drag && !pending) renderAll(); }, 150);
  });

  // ---------- API used by auth.js (sign-in and cloud sync) ----------
  window.DayblockApp = {
    GUEST_KEY,
    getState: () => state,
    getStoreKey: () => storeKey,
    isEmpty,
    normalize,
    // Switch to another local store (e.g. per account). `seed` fills an empty store.
    switchStore(key, { seed } = {}) {
      storeKey = key;
      let s = loadFrom(key);
      let seeded = false;
      if (seed && isEmpty(s) && !isEmpty(seed)) { s = normalize(seed); seeded = true; }
      state = s;
      persist();
      applyTheme();
      renderAll();
      return { seeded };
    },
    // Replace data with a copy from the cloud (does not trigger another upload).
    replaceState(data) {
      if (drag || pending || visSaveT) return; // don't interrupt a drag or unsaved typing; our save will sync next
      const typing = document.activeElement?.closest?.('#vision-content') && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (typing) { state = normalize(data); persist(); return; }
      state = normalize(data);
      persist();
      applyTheme();
      renderAll();
    },
    onChange(fn) { changeListeners.add(fn); },
    toast,
  };

  // ---------- Start ----------
  applyTheme();
  renderAll();
  scrollToRelevant();

  if (location.protocol === 'file:') document.body.dataset.auth = 'guest';
  setTimeout(() => {
    if (document.body.dataset.auth === 'loading') {
      document.body.dataset.auth = 'signedout';
      const note = $('#auth-config-note');
      note.textContent = 'Sign-in could not load. Check your connection, or continue without an account.';
      note.hidden = false;
    }
  }, 9000);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
