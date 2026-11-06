/* Dayblock — personal planner: time blocks, to-dos, repeats, time tracking and insights.
   Data is kept in localStorage (one key per account); auth.js syncs it to the cloud when signed in. */
(() => {
  'use strict';

  // ---------- Constants ----------
  const GUEST_KEY = 'dayblock:v1';
  const HOUR_H = 64;   // pixel height of one hour; matches --hour-h in styles.css
  const SNAP = 15;     // minutes; drag and resize snap to this
  const TASK_MIME = 'application/x-dayblock-task';
  // Built-in categories (users can rename, recolor, delete and add their own in Settings).
  const DEFAULT_CATEGORIES = [
    { id: 'work', name: 'Work', color: '#6366f1' },
    { id: 'personal', name: 'Personal', color: '#d946ef' },
    { id: 'health', name: 'Health', color: '#10b981' },
    { id: 'learning', name: 'Learning', color: '#f97316' },
    { id: 'break', name: 'Break', color: '#0ea5e9' },
    { id: 'other', name: 'Other', color: '#64748b' },
  ];
  const CAT_SWATCHES = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#0ea5e9', '#64748b'];
  const PRIORITIES = { high: 'High', med: 'Medium', low: 'Low' };
  const PRIORITY_RANK = { high: 0, med: 1, low: 2 };
  const REPEAT_FREQS = { daily: 'Daily', weekdays: 'Every weekday', weekly: 'Weekly', monthly: 'Monthly' };
  const VIEWS = {
    timeblock: [['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
    todo: [['list', 'List'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
    insights: [['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
    vision: [['board', 'Vision'], ['goals', 'Goals'], ['journal', 'Journal']],
    diary: [['feed', 'Memories'], ['month', 'Calendar']],
    learn: [['guide', 'How to use'], ['lessons', 'Lessons']],
  };
  const LIST_VIEWS = ['list', 'board', 'goals', 'feed', 'guide', 'lessons']; // views without date navigation
  const LOOKS = ['classic', 'aurora', 'midnight', 'paper'];
  const LIFE_AREAS = [
    { id: 'health', name: 'Health', emoji: '💪', color: '#10b981' },
    { id: 'career', name: 'Career', emoji: '💼', color: '#6366f1' },
    { id: 'money', name: 'Money', emoji: '💰', color: '#f59e0b' },
    { id: 'love', name: 'Love', emoji: '❤️', color: '#ec4899' },
    { id: 'family', name: 'Family & friends', emoji: '🤝', color: '#0ea5e9' },
    { id: 'growth', name: 'Growth', emoji: '🌱', color: '#22c55e' },
    { id: 'fun', name: 'Fun', emoji: '🎉', color: '#a855f7' },
    { id: 'purpose', name: 'Purpose', emoji: '✨', color: '#64748b' },
  ].map(a => ({ ...a, cat: 'area-' + a.id }));
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
  // Same, for use mid-sentence: "today" / "tomorrow" in lowercase, real dates untouched.
  const dayLabelIn = iso => (relDay(iso) ? relDay(iso).toLowerCase() : fmtShortDate(iso));

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
  const defaultSettings = {
    mode: 'timeblock', tbView: 'day', todoView: 'list', insView: 'week', visView: 'board', diaryView: 'feed', learnView: 'guide',
    dayStart: 0, dayEnd: 24, weekStart: 1, theme: 'auto', look: 'classic', lookChosen: false, chainMode: 'ask', fullDay: true,
  };
  const arrOf = x => (Array.isArray(x) ? x : []);
  const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
  const normHistory = h => arrOf(h).filter(p => p && isISO(p.to)).map(p => ({ from: isISO(p.from) ? p.from : '', to: p.to, at: Number(p.at) || Date.now(), reason: String(p.reason || '') }));

  function normalizeCategories(list) {
    const out = [];
    for (const c of arrOf(list)) {
      if (!c || typeof c.id !== 'string' || !c.id || out.some(x => x.id === c.id)) continue;
      out.push({ id: c.id.replace(/[^a-z0-9_-]/gi, ''), name: String(c.name || 'Untitled').slice(0, 30), color: isHex(c.color) ? c.color : '#64748b' });
    }
    if (!out.length) return DEFAULT_CATEGORIES.map(c => ({ ...c }));
    if (!out.some(c => c.id === 'other')) out.push({ ...DEFAULT_CATEGORIES[5] });
    return out;
  }

  function normalizeDiary(list) {
    return arrOf(list).filter(e => e && e.id && isISO(e.date)).map(e => ({
      id: String(e.id),
      date: e.date,
      title: String(e.title || ''),
      text: String(e.text || ''),
      mood: Number.isInteger(e.mood) && e.mood >= 0 && e.mood < MOODS.length ? e.mood : null,
      fav: !!e.fav,
      created: Number(e.created) || Date.now(),
      media: arrOf(e.media).filter(m => m && m.id).map(m => ({
        id: String(m.id), kind: ['image', 'video', 'audio', 'file'].includes(m.kind) ? m.kind : 'file',
        name: String(m.name || 'file'), mime: String(m.mime || ''), size: Number(m.size) || 0, sync: !!m.sync,
      })),
    }));
  }

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
    if (!VIEWS.diary.some(v => v[0] === s.diaryView)) s.diaryView = 'feed';
    if (!VIEWS.learn.some(v => v[0] === s.learnView)) s.learnView = 'guide';
    if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = 'auto';
    // The original design (Classic) is the default until someone picks another look in Settings.
    if (!LOOKS.includes(s.look) || !s.lookChosen) s.look = 'classic';
    if (!['ask', 'auto'].includes(s.chainMode)) s.chainMode = 'ask';
    const categories = normalizeCategories(d?.categories);
    const CAT_IDS = categories.map(c => c.id);

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
        postponed: normHistory(b.postponed),
      }));
    const tasks = (Array.isArray(d?.tasks) ? d.tasks : [])
      .filter(t => t && t.id && typeof t.title === 'string')
      .map(t => ({
        ...t,
        id: String(t.id),
        priority: PRIORITIES[t.priority] ? t.priority : 'med',
        category: CAT_IDS.includes(t.category) ? t.category : (CAT_IDS.includes('work') ? 'work' : 'other'),
        estimate: Math.max(0, parseInt(t.estimate, 10) || 0),
        due: isISO(t.due) ? t.due : '',
        done: !!t.done,
        repeat: normRepeat(t.repeat),
        notes: String(t.notes || ''),
        after: typeof t.after === 'string' ? t.after : '',
        postponed: normHistory(t.postponed),
      }));
    // Drop links to tasks that no longer exist, and break any loops.
    const taskIds = new Set(tasks.map(t => t.id));
    for (const t of tasks) {
      if (!taskIds.has(t.after) || t.after === t.id) { t.after = ''; continue; }
      let cur = tasks.find(x => x.id === t.after), hops = 0;
      while (cur && cur.after && hops < 200) { if (cur.after === t.id) { t.after = ''; break; } cur = tasks.find(x => x.id === cur.after); hops++; }
    }
    let entries = (Array.isArray(d?.entries) ? d.entries : [])
      .filter(e => e && e.id && typeof e.ref === 'string' && Number.isFinite(e.start) && (e.end == null || Number.isFinite(e.end)));
    let timer = d?.timer && typeof d.timer.ref === 'string' && ['running', 'paused'].includes(d.timer.status) ? { ref: d.timer.ref, status: d.timer.status } : null;
    // Keep timer and open sessions consistent.
    const open = entries.filter(e => e.end == null);
    if (!timer) open.forEach(e => { e.end = e.start; });
    else if (timer.status === 'paused') open.forEach(e => { e.end = Date.now(); });
    else if (!open.some(e => e.ref === timer.ref)) timer.status = 'paused';
    entries = entries.filter(e => e.end == null || e.end > e.start);
    const lateSeen = d?.lateSeen && typeof d.lateSeen === 'object' ? Object.fromEntries(Object.entries(d.lateSeen).filter(([k, v]) => taskIds.has(k) && typeof v === 'string')) : {};
    return {
      version: 3, updatedAt: Number(d?.updatedAt) || 0, blocks, tasks, entries, timer, settings: s, categories,
      vision: normalizeVision(d?.vision), diary: normalizeDiary(d?.diary),
      learn: { done: arrOf(d?.learn?.done).filter(x => typeof x === 'string') }, lateSeen,
    };
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
  const cats = () => state.categories;
  const catOf = id => cats().find(c => c.id === id) || cats().find(c => c.id === 'other') || cats()[0];
  const defaultCat = () => (cats().some(c => c.id === lastCategory) ? lastCategory : cats()[0].id);

  // Category colors live in a generated stylesheet so custom categories work in every look.
  function applyCategoryStyles() {
    let el = document.getElementById('cat-styles');
    if (!el) { el = document.createElement('style'); el.id = 'cat-styles'; document.head.appendChild(el); }
    const rule = (cls, color) => `.${cls}{--cat-base:${color};--cat:color-mix(in oklab,${color} var(--cat-fg-amt),var(--cat-fg-blend));--cat-bg:color-mix(in oklab,${color} var(--cat-bg-amt),var(--surface-solid));}`;
    el.textContent = cats().map(c => rule('cat-' + c.id, c.color)).join('') + LIFE_AREAS.map(a => rule(a.cat, a.color)).join('');
  }
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
    const t = { id: uid(), title: title.trim(), notes: '', priority, due, done: false, created: Date.now(), repeat: normRepeat(repeat), category, estimate, after: '', postponed: [] };
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
        toast(next ? `Done. Next one is due ${dayLabelIn(next)}.` : 'Done. That was the last one in the series.');
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

  // ---------- Postponing & linked tasks (finish-to-start chains) ----------
  const successorsOf = id => state.tasks.filter(t => t.after === id && !t.done);
  function chainAfter(id, seen = new Set()) {
    for (const s of successorsOf(id)) if (!seen.has(s.id)) { seen.add(s.id); chainAfter(s.id, seen); }
    return seen;
  }
  // The date a task "lives" on: its latest unfinished scheduled block, else its due date.
  function taskDate(t) {
    const bs = state.blocks.filter(b => b.taskId === t.id && !b.repeat && !b.doneOn.length).map(b => b.date).sort();
    return bs[bs.length - 1] || t.due || '';
  }
  function addHistory(obj, from, to, reason) {
    obj.postponed = [...(obj.postponed || []), { from, to, at: Date.now(), reason: reason || '' }];
  }
  // Move a task and its unfinished one-off blocks by N days, then drag every linked task after it by the same amount.
  function shiftTask(t, days, reason, visited = new Set()) {
    if (!days || visited.has(t.id)) return 0;
    visited.add(t.id);
    const from = taskDate(t);
    if (t.due) t.due = addDays(t.due, days);
    for (const b of state.blocks) {
      if (b.taskId !== t.id || b.repeat || b.doneOn.length) continue;
      b.date = addDays(b.date, days);
    }
    if (from && days > 0) addHistory(t, from, addDays(from, days), reason);
    let moved = 1;
    for (const s of successorsOf(t.id)) moved += shiftTask(s, days, `Moved with “${t.title}”`, visited);
    return moved;
  }
  // Postpone a task to a later date. Returns how many linked tasks moved with it.
  function postponeTask(t, to, reason, fromDate) {
    const from = fromDate || taskDate(t) || todayISO();
    const days = dayNum(to) - dayNum(from);
    if (days <= 0) return -1;
    delete state.lateSeen[t.id];
    if (!taskDate(t)) {
      t.due = to;
      addHistory(t, from, to, reason);
      const visited = new Set([t.id]);
      return sum(successorsOf(t.id), s => shiftTask(s, days, `Moved with “${t.title}”`, visited));
    }
    const n = Math.max(0, shiftTask(t, days, reason) - 1);
    if (t.due && t.due < to) t.due = to;
    return n;
  }
  // Postpone one block occurrence (a block linked to a task moves the task instead).
  function postponeOcc(o, to, reason) {
    const t = o.b.taskId && findTask(o.b.taskId);
    if (t && !o.b.repeat) return postponeTask(t, to, reason, o.date);
    if (dayNum(to) <= dayNum(o.date)) return -1;
    if (o.b.repeat) {
      const nb = detach(o.b, o.date, { date: to, repeat: null });
      addHistory(nb, o.date, to, reason);
    } else {
      const oldRef = `block:${o.b.id}@${o.b.date}`;
      o.b.date = to;
      if (!o.b.taskId) remapRef(oldRef, `block:${o.b.id}@${to}`);
      addHistory(o.b, o.date, to, reason);
    }
    return 0;
  }
  // When does a task count as late? After its last scheduled block ends, or at the end of its due date.
  function taskDeadline(t) {
    const bs = state.blocks.filter(b => b.taskId === t.id && !b.repeat);
    if (bs.length) return Math.max(...bs.map(b => isoToTs(b.date, b.end)));
    if (t.due) return isoToTs(addDays(t.due, 1));
    return null;
  }
  function lateChains() {
    const now = Date.now();
    return state.tasks.filter(t => {
      if (t.done || !successorsOf(t.id).length) return false;
      const dl = taskDeadline(t);
      return dl && dl < now && state.lateSeen[t.id] !== String(dl);
    });
  }
  function pushChainToTomorrow(t, reason = 'Ran late') {
    const tomorrow = addDays(todayISO(), 1);
    const from = taskDate(t) || todayISO();
    const target = dayNum(from) >= dayNum(tomorrow) ? addDays(from, 1) : tomorrow;
    return postponeTask(t, target, reason);
  }
  let lastLateKey = '';
  function checkLateChains() {
    const late = lateChains();
    if (state.settings.chainMode === 'auto' && late.length) {
      let moved = 0;
      late.forEach(t => { moved += 1 + Math.max(0, pushChainToTomorrow(t, 'Ran late (moved automatically)')); });
      save();
      renderAll();
      toast(`${late.length} late task${late.length === 1 ? '' : 's'} and ${moved - late.length} linked task${moved - late.length === 1 ? '' : 's'} moved to tomorrow.`);
      return;
    }
    const key = late.map(t => t.id).join(',');
    if (key !== lastLateKey) { lastLateKey = key; renderBanner(); }
  }
  // A block was moved to a later day by hand (drag or edit): record it as postponed and drag linked tasks along.
  function markMovedLater(b, oldDate, newDate) {
    const days = dayNum(newDate) - dayNum(oldDate);
    if (days <= 0) return null;
    const t = b.taskId && findTask(b.taskId);
    if (!t) { addHistory(b, oldDate, newDate, ''); return { count: b.postponed.length, linked: 0 }; }
    addHistory(t, oldDate, newDate, '');
    if (t.due && t.due < newDate) t.due = newDate;
    const visited = new Set([t.id]);
    const linked = sum(successorsOf(t.id), s => shiftTask(s, days, `Moved with “${t.title}”`, visited));
    delete state.lateSeen[t.id];
    return { count: t.postponed.length, linked };
  }
  const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  function postponedToast(info, to, snapshot) {
    if (!info) return;
    const msg = `Marked as postponed to ${dayLabelIn(to)}` + (info.count > 1 ? ` (${ordinal(info.count)} time)` : '') +
      (info.linked ? `. ${info.linked} linked task${info.linked === 1 ? '' : 's'} moved too.` : '.');
    toast(msg, snapshot ? () => { state = normalize(JSON.parse(snapshot)); save(); renderAll(); } : undefined);
  }
  function historyHTML(list) {
    if (!list?.length) return '';
    return `<b>↷ Postponed ${list.length}×</b>` + list.slice(-4).reverse().map(p =>
      `<span>${esc(p.from ? fmtShortDate(p.from) : '—')} → ${esc(fmtShortDate(p.to))}${p.reason ? ` · ${esc(p.reason)}` : ''}</span>`).join('');
  }

  function renderBanner() {
    const m = mode();
    const late = ['timeblock', 'todo'].includes(m) ? lateChains() : [];
    if (!late.length) { bannerEl.innerHTML = ''; return; }
    const t = late[0];
    const n = chainAfter(t.id).size;
    bannerEl.innerHTML = `<div class="banner" data-late="${esc(t.id)}">
      <span class="b-icon" aria-hidden="true">⏰</span>
      <div class="b-text"><b>“${esc(t.title)}” wasn’t finished on time.</b> ${n} linked task${n === 1 ? '' : 's'} come${n === 1 ? 's' : ''} after it.${late.length > 1 ? ` (+${late.length - 1} more late chain${late.length > 2 ? 's' : ''})` : ''}</div>
      <div class="b-actions">
        <button type="button" class="btn sm primary" data-late-act="push">Push chain to tomorrow</button>
        <button type="button" class="btn sm" data-late-act="pick">Pick a date…</button>
        <button type="button" class="btn sm" data-late-act="done">Mark done</button>
        <button type="button" class="btn sm" data-late-act="dismiss">Dismiss</button>
      </div></div>`;
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
      notes: t.notes || '', taskId: t.id, repeat: null, skip: [], doneOn: [], postponed: [],
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
    const today = todayISO();
    const span = actualSpan(ref, today);
    const slot = plannedSlot(ref, today);
    if (info?.kind === 'task' && !info.task.done) { setTaskDone(info.task, true); }
    else if (info?.kind === 'block' && !info.occ.done) { setOccDone(info.occ, true); }
    else { save(); renderAll(); }
    const finish = span ? ` Finished ${fmtTs(span.end)}` + (slot ? ` (${deltaLabel(span.end, today, slot.end, 'end').replace(/<[^>]+>/g, '')})` : '') + '.' : '';
    toast(`${fmtDur(total)} tracked${info ? ` on “${info.title}”` : ''}.${finish}`);
  }

  // ---------- DOM refs ----------
  const views = {
    timeblock: $('#view-timeblock'), todo: $('#view-todo'), insights: $('#view-insights'),
    vision: $('#view-vision'), diary: $('#view-diary'), learn: $('#view-learn'),
  };
  const modeBtns = document.querySelectorAll('.app-nav [data-mode]');
  const bannerEl = $('#chain-banner'), tbStrip = $('#tb-strip'), todoStrip = $('#todo-strip'), sideQuote = $('#side-quote');
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
  // Each look has a light and a dark palette. "Match my device" follows the system, except
  // Midnight, which stays dark unless the device explicitly asks for light.
  function applyTheme() {
    const { theme: t, look } = state.settings;
    const dark = t === 'dark' || (t === 'auto' && (look === 'midnight' ? !matchMedia('(prefers-color-scheme: light)').matches : darkQuery.matches));
    const root = document.documentElement;
    root.dataset.look = look;
    root.dataset.scheme = dark ? 'dark' : 'light';
    delete root.dataset.theme;
    try { localStorage.setItem('dayblock:look', JSON.stringify({ look, mode: t })); } catch { /* ignore */ }
    requestAnimationFrame(() => {
      const c = getComputedStyle(root).getPropertyValue('--theme-color').trim();
      if (c) $('meta[name="theme-color"]').content = c;
    });
    applyCategoryStyles();
  }

  const mode = () => state.settings.mode;
  const VIEW_KEY = { timeblock: 'tbView', todo: 'todoView', insights: 'insView', vision: 'visView', diary: 'diaryView', learn: 'learnView' };
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
      } else if (v === 'feed') {
        periodTitle.textContent = 'Diary';
        const n = state.diary.length;
        periodSub.textContent = n ? `${n} memor${n === 1 ? 'y' : 'ies'} saved` : 'Your story, one day at a time';
      } else if (v === 'guide') {
        periodTitle.textContent = 'How to use Dayblock';
        periodSub.textContent = 'A quick tour of every feature';
      } else if (v === 'lessons') {
        periodTitle.textContent = learnOpen ? 'Lesson' : 'Learn';
        const total = (window.DAYBLOCK_LEARN?.lessons || []).length;
        periodSub.textContent = `${state.learn.done.length} of ${total} lessons completed`;
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
    fab.hidden = !['timeblock', 'todo', 'diary'].includes(m);
    fab.setAttribute('aria-label', m === 'todo' ? 'Add task' : m === 'diary' ? 'New memory' : 'Add time block');
    renderToolbar();
    renderBanner();
    tbStrip.innerHTML = m === 'timeblock' && state.settings.tbView === 'day' ? weekStrip() : '';
    todoStrip.innerHTML = m === 'todo' && state.settings.todoView === 'day' ? weekStrip() : '';
    if (m === 'timeblock') renderTimeblock();
    else if (m === 'todo') renderTodo();
    else if (m === 'insights') renderInsights();
    else if (m === 'vision') renderVision();
    else if (m === 'diary') renderDiary();
    else renderLearn();
    renderTimerBar();
    renderSideQuote();
  }

  // 7-day strip above day views: tap a day to jump to it. Dots show that day's blocks.
  function weekStrip() {
    const [a] = periodRange('week');
    const today = todayISO();
    return `<div class="week-strip">${datesBetween(a, addDays(a, 6)).map(d => {
      const occs = occurrencesOn(d).slice(0, 4);
      return `<button type="button" data-strip="${d}" class="${d === today ? 'today' : ''}"${d === currentDate ? ' aria-current="date"' : ''}>` +
        `${esc(DOW_SHORT[dowOf(d)])}<b>${fromISO(d).getDate()}</b>` +
        `<span class="dots">${occs.map(o => `<i class="cat-${o.category}"></i>`).join('')}</span></button>`;
    }).join('')}</div>`;
  }
  [tbStrip, todoStrip].forEach(el => el.addEventListener('click', e => {
    const b = e.target.closest('[data-strip]');
    if (!b) return;
    currentDate = b.dataset.strip;
    renderAll();
    scrollToRelevant();
  }));

  function renderSideQuote() {
    const a = todaysAffirmation();
    sideQuote.hidden = !a;
    if (a) sideQuote.innerHTML = `Today's affirmation<b>“${esc(a)}”</b>`;
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

  // First start and last finish of the tracked sessions for an item on one day (finish = now while running).
  function actualSpan(ref, date) {
    const ds = isoToTs(date), de = isoToTs(addDays(date, 1)), now = Date.now();
    const es = state.entries.filter(e => e.ref === ref && overlap(e.start, e.end ?? now, ds, de) > 0);
    if (!es.length) return null;
    return {
      start: Math.min(...es.map(e => e.start)),
      end: Math.max(...es.map(e => e.end ?? now)),
      live: es.some(e => e.end == null),
      ms: sum(es, e => overlap(e.start, e.end ?? now, ds, de)),
    };
  }
  // "+12m late" / "5m early" / "on time" against a planned minute-of-day.
  function deltaLabel(actualTs, date, plannedMin, kind) {
    const diff = Math.round((actualTs - isoToTs(date, plannedMin)) / 60000);
    if (Math.abs(diff) <= 2) return `<span class="ontime">on time</span>`;
    const word = kind === 'start' ? (diff > 0 ? 'late' : 'early') : (diff > 0 ? 'over' : 'early');
    return `<span class="${diff > 0 ? 'late' : 'early'}">${fmtDur(Math.abs(diff))} ${word}</span>`;
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
    const span = spent > 0 ? actualSpan(o.ref, o.date) : null;
    const actual = span
      ? `<div class="block-actual">● ${esc(fmtTs(span.start))} – ${span.live ? 'now' : esc(fmtTs(span.end))} · ${deltaLabel(span.start, o.date, o.start, 'start')}</div>`
      : '';
    const pp = o.b.postponed?.length || (o.b.taskId && findTask(o.b.taskId)?.postponed?.length) || 0;
    const chain = o.b.taskId && (findTask(o.b.taskId)?.after || state.tasks.some(t => t.after === o.b.taskId));
    n.innerHTML =
      `<button type="button" class="check" aria-label="${o.done ? 'Mark not done' : 'Mark done'}" aria-pressed="${o.done}"></button>` +
      `<div class="block-body"><div class="block-title"></div><div class="block-time"></div>${actual}</div>` +
      (narrow ? '' : `<button type="button" class="play${timing ? ' on' : ''}" aria-label="${running ? 'Pause timer' : 'Start timer'}" title="${running ? 'Pause timer' : 'Start timer'}">${running ? ICON.pause : ICON.play}</button>`) +
      (spent > 0 ? `<span class="track-bar" style="width:${Math.min(100, spent / planned * 100)}%"></span>` : '') +
      `<div class="resize" aria-hidden="true"></div>`;
    n.querySelector('.block-title').textContent = o.title || 'Untitled';
    n.querySelector('.block-time').innerHTML = `${esc(fmtTime(o.start))} – ${esc(fmtTime(o.end))}` +
      (o.b.repeat ? ' <span class="rep" title="Repeats">↻</span>' : '') +
      (chain ? ' <span class="lnk" title="Linked task">🔗</span>' : '') +
      (pp ? ` <span class="lnk" title="Postponed ${pp}×">↷${pp}</span>` : '');
    n.title = `${o.title || 'Untitled'} · planned ${fmtTime(o.start)} – ${fmtTime(o.end)}` +
      (span ? `\nActual ${fmtTs(span.start)} – ${span.live ? 'now' : fmtTs(span.end)}` : '') +
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
      drawActualLanes(col, date);
    });
    updateNow();
    if (prevScroll != null) wrapEl.scrollTop = prevScroll;
  }

  // Slim bars on the right edge of a day column showing when you actually tracked time.
  function drawActualLanes(col, date) {
    col.querySelectorAll('.actual').forEach(n => n.remove());
    const [lo, hi] = dayBounds();
    const ds = isoToTs(date), de = isoToTs(addDays(date, 1)), now = Date.now();
    for (const e of state.entries) {
      const end = e.end ?? now;
      if (overlap(e.start, end, ds, de) <= 0) continue;
      const sMin = clamp((Math.max(e.start, ds) - ds) / 60000, lo, hi);
      const eMin = clamp((Math.min(end, de) - ds) / 60000, lo, hi);
      if (eMin <= sMin) continue;
      const info = refInfo(e.ref);
      const lane = document.createElement('div');
      lane.className = `actual cat-${info?.category || e.category || 'other'}${e.end == null ? ' live' : ''}`;
      lane.style.top = minToY(sMin) + 'px';
      lane.style.height = Math.max(3, minToY(eMin) - minToY(sMin)) + 'px';
      lane.dataset.entry = e.id;
      lane.title = `Tracked: ${info?.title || e.title}\n${fmtTs(e.start)} – ${e.end == null ? 'now (running)' : fmtTs(e.end)} · ${fmtDur((end - e.start) / 60000)}`;
      col.appendChild(lane);
    }
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
    const doneCount = occs.filter(o => o.done).length;
    const mood = !planned ? 'Ready when you are' : pct >= 100 ? 'All done. Great work!' : pct >= 60 ? 'Great momentum' : pct >= 25 ? 'Good progress' : 'Let’s get started';
    summaryEl.innerHTML = `
      <div class="ring-row">
        <div class="ring" style="--p:${Math.min(100, pct)}" role="progressbar" aria-label="Planned time completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span>${pct}%</span></div>
        <div><b>${mood}</b><small>${planned ? `${doneCount} of ${occs.length} block${occs.length === 1 ? '' : 's'} done ${periodWord}` : v === 'month' ? 'Pick a day to start planning.' : 'Click or drag on the timeline to plan.'}</small></div>
      </div>
      <div class="stat-row">
        <div class="stat"><span class="stat-num">${fmtDur(planned)}</span><span class="stat-label">planned</span></div>
        <div class="stat"><span class="stat-num">${fmtDur(tracked)}</span><span class="stat-label">tracked</span></div>
        <div class="stat"><span class="stat-num">${occs.length}</span><span class="stat-label">${occs.length === 1 ? 'block' : 'blocks'}</span></div>
      </div>
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
            ${(() => { const p = t.after && findTask(t.after); return p ? `<span class="pill link" title="Starts after this task">🔗 After: ${esc(p.title)}${p.done ? ' ✓' : ''}</span>` : ''; })()}
            ${(() => { const n = successorsOf(t.id).length; return n ? `<span class="pill link" title="Tasks waiting for this one">→ ${n} waiting</span>` : ''; })()}
            ${t.postponed?.length ? `<span class="pill warn" title="${esc(t.postponed.map(p => `${p.from} → ${p.to}${p.reason ? ' (' + p.reason + ')' : ''}`).join('\n'))}">↷ Postponed ${t.postponed.length}×</span>` : ''}
            ${t.notes ? '<span class="pill">Notes</span>' : ''}
          </span>
        </button>
        ${schedPill}
        <div class="todo-actions">
          ${t.done ? '' : `<button type="button" class="icon-btn sm${timing ? ' active' : ''}" data-act="track" aria-label="${running ? 'Pause timer' : 'Start timer'}" title="${running ? 'Pause timer' : timing ? 'Resume timer' : 'Start timer'}">${running ? ICON.pause : ICON.play}</button>`}
          ${!b && !t.done ? `<button type="button" class="icon-btn sm hover-only" data-act="schedule" aria-label="Schedule in the next free slot" title="Put on the timeline">${ICON.calendar}</button>` : ''}
          ${!t.done ? `<button type="button" class="icon-btn sm hover-only" data-act="postpone" aria-label="Postpone" title="Postpone">↷</button>` : ''}
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
    const isLinked = t => !!t.after || state.tasks.some(x => x.after === t.id);
    const counts = {
      all: state.tasks.length,
      active: active.length,
      today: active.filter(t => t.due && t.due <= today).length,
      linked: active.filter(isLinked).length,
      postponed: active.filter(t => t.postponed?.length).length,
      done: state.tasks.length - active.length,
    };
    filtersEl.querySelectorAll('[data-filter]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.filter === todoFilter));
      b.querySelector('.count').textContent = counts[b.dataset.filter];
    });
    clearDoneBtn.hidden = counts.done === 0;
    const sched = scheduledMap();
    if (todoFilter === 'linked') { renderChains(sched); return; }
    let list = state.tasks;
    if (todoFilter === 'active') list = active;
    else if (todoFilter === 'today') list = active.filter(t => t.due && t.due <= today);
    else if (todoFilter === 'postponed') list = active.filter(t => t.postponed?.length).sort((a, b) => b.postponed.length - a.postponed.length);
    else if (todoFilter === 'done') list = list.filter(t => t.done);
    const empty = {
      active: ['Nothing on your list', 'Add a task above to get started.'],
      today: ['Nothing due today', 'Tasks due today or earlier show up here.'],
      postponed: ['Nothing postponed', 'Tasks you move to a later date show up here, so you can spot what keeps slipping.'],
      done: ['No finished tasks yet', 'Tick a task off and it will land here.'],
      all: ['No tasks yet', 'Add a task above to get started.'],
    }[todoFilter];
    todoContent.innerHTML = list.length
      ? `<ul class="todo-list card">${(todoFilter === 'postponed' ? list : sortTasks(list)).map(t => taskItem(t, sched)).join('')}</ul>`
      : emptyState(...empty);
  }

  // Linked tasks shown as chains in order: A → B → C.
  function renderChains(sched) {
    const roots = state.tasks.filter(t => !t.done && (!t.after || findTask(t.after)?.done) && successorsOf(t.id).length);
    const chainList = root => {
      const out = [], walk = (t, depth) => { out.push([t, depth]); successorsOf(t.id).forEach(s => walk(s, depth + 1)); };
      walk(root, 0);
      return out;
    };
    todoContent.innerHTML = roots.length
      ? roots.map(r => {
          const items = chainList(r);
          return `<div class="todo-section"><h2 class="section-title">🔗 Chain · ${items.length} tasks</h2><ul class="todo-list card">` +
            items.map(([t, depth]) => taskItem(t, sched).replace('<li class="todo-item', `<li style="padding-left:${10 + depth * 22}px" class="todo-item`)).join('') + '</ul></div>';
        }).join('')
      : emptyState('No linked tasks yet', 'Open a task and choose “Starts after” to link it to another. If the first one slips, everything after it moves too.');
  }

  function renderTodoDay() {
    const d = currentDate, today = todayISO();
    const sched = scheduledMap();
    const due = sortTasks(state.tasks.filter(t => t.due === d));
    const repeats = state.tasks.filter(t => virtualDates(t, d, d).length);
    let html = '';
    if (d === today) html += section('Overdue', sortTasks(state.tasks.filter(t => !t.done && t.due && t.due < today)).map(t => taskItem(t, sched)));
    html += section(`Due ${dayLabelIn(d)}`, due.map(t => taskItem(t, sched)));
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
      const extras = insightsExtras(a, b, v);
      insightsEl.innerHTML = (extras.hasData ? '' : `<div class="card">${emptyState('No data for this period yet',
        'Plan time blocks or set "time needed" on tasks, then press ▶ on any task or block to track time. Planned vs. spent time shows up here.')}</div>`) + extras.html;
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
    const catRows = cats().map(c => ({
      ...c,
      planned: sum(list.filter(r => r.category === c.id), r => r.planned),
      tracked: sum(list.filter(r => r.category === c.id), r => r.tracked),
    })).filter(c => c.planned || c.tracked);
    const catMax = Math.max(1, ...catRows.map(c => Math.max(c.planned, c.tracked)));
    const catCard = `
      <div class="card ins-card">
        <div class="ins-card-head"><h2>By category</h2><div class="legend"><span><i class="sw planned" style="opacity:.6"></i>Planned</span><span><i class="sw tracked"></i>Tracked</span></div></div>
        <div class="cat-rows">${catRows.map(c => `
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

    const extras = insightsExtras(a, b, v);
    insightsEl.innerHTML = kpis + extras.tips +
      (chartCard ? `<div class="ins-grid">${chartCard}${catCard}</div>` : `<div class="ins-grid" style="grid-template-columns:1fr">${catCard}</div>`) +
      extras.cards + table + (sessCard ? `<div style="height:16px"></div>${sessCard}` : '');
  }

  // Punctuality (actual vs planned start/finish), working hours, postponements and tips for a period.
  function insightsExtras(a, b, v) {
    const fromTs = isoToTs(a), toTs = isoToTs(addDays(b, 1)), now = Date.now();
    // 1) Punctuality: every planned block in the period that you tracked.
    const rows = [];
    for (const o of occurrencesIn(a, b)) {
      const span = actualSpan(o.ref, o.date);
      if (!span) continue;
      const ps = isoToTs(o.date, o.start), pe = isoToTs(o.date, o.end);
      rows.push({
        o, span,
        startD: Math.round((span.start - ps) / 60000),
        endD: span.live ? null : Math.round((span.end - pe) / 60000),
        ps, pe,
      });
    }
    const avg = xs => (xs.length ? Math.round(sum(xs, x => x) / xs.length) : 0);
    const starts = rows.map(r => r.startD), ends = rows.filter(r => r.endD != null).map(r => r.endD);
    const onTime = rows.filter(r => Math.abs(r.startD) <= 5).length;
    const fmtD = (d, kind) => d == null ? '<span class="d-ontime">running</span>'
      : Math.abs(d) <= 2 ? '<span class="d-ontime">on time</span>'
      : `<span class="${d > 0 ? 'd-late' : 'd-early'}">${d > 0 ? '+' : '−'}${fmtDur(Math.abs(d))} ${kind === 'start' ? (d > 0 ? 'late' : 'early') : (d > 0 ? 'over' : 'early')}</span>`;
    let punctCard = '';
    if (rows.length) {
      const avgS = avg(starts), avgE = avg(ends);
      punctCard = `<div class="card ins-card">
        <div class="ins-card-head"><h2>Started and finished vs. plan</h2><span class="muted small">${rows.length} tracked block${rows.length === 1 ? '' : 's'}</span></div>
        <div class="punct-grid">
          <div class="punct"><b class="${avgS > 5 ? 'late' : avgS < -5 ? 'early' : ''}">${Math.abs(avgS) <= 2 ? 'On time' : `${fmtDur(Math.abs(avgS))} ${avgS > 0 ? 'late' : 'early'}`}</b><small>average start</small></div>
          <div class="punct"><b>${Math.round(onTime / rows.length * 100)}%</b><small>started within 5 min of plan</small></div>
          <div class="punct"><b class="${avgE > 5 ? 'late' : avgE < -5 ? 'early' : ''}">${!ends.length ? '—' : Math.abs(avgE) <= 2 ? 'On time' : `${fmtDur(Math.abs(avgE))} ${avgE > 0 ? 'over' : 'early'}`}</b><small>average finish</small></div>
        </div>
        <div class="table-scroll"><table class="ins-table">
          <thead><tr><th>Block</th><th>Planned</th><th>Actual</th><th class="r">Start</th><th class="r">Finish</th><th>Plan vs. actual</th></tr></thead>
          <tbody>${rows.sort((x, y) => y.span.start - x.span.start).slice(0, 20).map(r => {
            const lo = Math.min(r.ps, r.span.start), hi = Math.max(r.pe, r.span.end), w = Math.max(1, hi - lo);
            const pct = (s, e) => `left:${(s - lo) / w * 100}%;width:${Math.max(2, (e - s) / w * 100)}%`;
            return `<tr class="cat-${r.o.category}">
              <td><span class="item">${esc(r.o.title || 'Untitled')}</span><small class="muted">${esc(dayLabel(r.o.date))}</small></td>
              <td class="num">${esc(fmtTime(r.o.start))}–${esc(fmtTime(r.o.end))}</td>
              <td class="num">${esc(fmtTs(r.span.start))}–${r.span.live ? 'now' : esc(fmtTs(r.span.end))}</td>
              <td class="r">${fmtD(r.startD, 'start')}</td><td class="r">${fmtD(r.endD, 'end')}</td>
              <td><span class="tl-compare" title="Top: planned · Bottom: actual"><span class="pl" style="${pct(r.ps, r.pe)}"></span><span class="ac" style="${pct(r.span.start, r.span.end)}"></span></span></td>
            </tr>`;
          }).join('')}</tbody></table></div></div>`;
    }

    // 2) When you actually work: tracked minutes by hour of day.
    const byHour = new Array(24).fill(0);
    for (const e of state.entries) {
      const end = e.end ?? now;
      let t = Math.max(e.start, fromTs);
      const stop = Math.min(end, toTs);
      while (t < stop) {
        const d = new Date(t);
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
        byHour[d.getHours()] += (Math.min(next, stop) - t) / 60000;
        t = next;
      }
    }
    const trackedTotal = sum(byHour, x => x);
    let hourCard = '', peakText = '';
    if (trackedTotal >= 5) {
      // Best 2-hour window.
      let best = 0;
      for (let h = 0; h < 23; h++) {
        const s = byHour[h] + byHour[h + 1], bs = byHour[best] + byHour[best + 1];
        if (s > bs || (s === bs && byHour[h] > byHour[best])) best = h;
      }
      peakText = `${fmtHour(best)}–${fmtHour(best + 2)}`;
      const maxM = Math.max(...byHour, 1);
      const W = 640, H = 150, padL = 4, padB = 22, bw = (W - padL) / 24;
      let svgOut = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tracked time by hour of day">`;
      byHour.forEach((m, h) => {
        const bh = m / maxM * (H - padB - 8);
        const x = padL + h * bw + 2, y = H - padB - bh;
        if (m > 0) svgOut += `<path class="bar-tracked" d="M${x},${H - padB}V${y + Math.min(3, bh)}Q${x},${y} ${x + 3},${y}H${x + bw - 7}Q${x + bw - 4},${y} ${x + bw - 4},${y + Math.min(3, bh)}V${H - padB}Z"/>`;
        if (h % 3 === 0) svgOut += `<text x="${x + (bw - 4) / 2}" y="${H - 6}" text-anchor="middle">${esc(fmtHour(h))}</text>`;
        svgOut += `<rect class="hit" x="${padL + h * bw}" y="0" width="${bw}" height="${H - padB}" data-tip="<b>${esc(fmtHour(h))}–${esc(fmtHour(h + 1))}</b><br>Tracked: <b>${fmtDur(m)}</b>"/>`;
      });
      hourCard = `<div class="card ins-card">
        <div class="ins-card-head"><h2>When you actually work</h2><span class="muted small">Peak: ${esc(peakText)}</span></div>
        <p class="ins-note">Tracked time by hour of day. Your strongest two hours are <b>${esc(peakText)}</b>.</p>${svgOut}</svg></div>`;
    }

    // 3) Postponements made in this period.
    const pps = [];
    for (const t of state.tasks) for (const p of (t.postponed || [])) if (p.at >= fromTs && p.at < toTs) pps.push({ ...p, title: t.title, key: 'task:' + t.id });
    for (const bl of state.blocks) for (const p of (bl.postponed || [])) if (p.at >= fromTs && p.at < toTs) pps.push({ ...p, title: bl.title, key: 'block:' + bl.id });
    let ppCard = '';
    const topItems = Object.values(pps.reduce((acc, p) => { (acc[p.key] ||= { title: p.title, n: 0 }).n++; return acc; }, {})).sort((x, y) => y.n - x.n);
    if (pps.length) {
      const reasons = Object.entries(pps.reduce((acc, p) => { const r = p.reason || 'No reason given'; acc[r] = (acc[r] || 0) + 1; return acc; }, {})).sort((x, y) => y[1] - x[1]);
      const days = sum(pps, p => Math.max(0, dayNum(p.to) - dayNum(p.from || p.to)));
      ppCard = `<div class="card ins-card">
        <div class="ins-card-head"><h2>Postponed</h2><span class="muted small">${pps.length} time${pps.length === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'} pushed</span></div>
        <div class="ins-grid" style="margin:0;grid-template-columns:1fr 1fr">
          <div><h3 class="section-title" style="margin-bottom:8px">Most postponed</h3>
            <ul class="insight-tips">${topItems.slice(0, 5).map(x => `<li><span>↷</span><span><b>${esc(x.title)}</b> · ${x.n}×</span></li>`).join('')}</ul></div>
          <div><h3 class="section-title" style="margin-bottom:8px">Why</h3>
            <ul class="insight-tips">${reasons.slice(0, 5).map(([r, n]) => `<li><span>•</span><span>${esc(r)} · <b>${n}</b></span></li>`).join('')}</ul></div>
        </div></div>`;
    }

    // 4) Plain-language tips from the numbers above.
    const tips = [];
    if (rows.length >= 2) {
      const s = avg(starts);
      if (s > 7) tips.push(['⏱', `You start <b>${fmtDur(s)} late</b> on average. Try a 10-minute buffer before blocks, or set a reminder 5 minutes earlier.`]);
      else if (rows.length && onTime / rows.length >= .7) tips.push(['🎯', `<b>${Math.round(onTime / rows.length * 100)}%</b> of your blocks started on time. Great discipline!`]);
      const e = avg(ends);
      if (ends.length >= 2 && e > 10) tips.push(['📏', `Blocks run <b>${fmtDur(e)} over</b> on average. Plan about ${Math.min(50, Math.round(e / 60 * 100))}% more time for similar work.`]);
    }
    if (peakText) tips.push(['⚡', `Your most productive window is <b>${esc(peakText)}</b>. Protect it for your most important work.`]);
    if (topItems[0]?.n >= 2) tips.push(['🪓', `“<b>${esc(topItems[0].title)}</b>” was postponed ${topItems[0].n} times. Break it into a smaller first step, or schedule it during your peak hours.`]);
    const tipsHTML = tips.length ? `<div class="card ins-card" style="margin-bottom:16px"><div class="ins-card-head"><h2>What your data says</h2></div><ul class="insight-tips">${tips.map(([i, t]) => `<li><span>${i}</span><span>${t}</span></li>`).join('')}</ul></div>` : '';
    const cards = [punctCard, hourCard, ppCard].filter(Boolean).map(c => c.replace('class="card ins-card"', 'class="card ins-card" style="margin-bottom:16px"')).join('');
    return { tips: tipsHTML, cards, html: tipsHTML + cards, hasData: !!(rows.length || trackedTotal || pps.length) };
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

  // ---------- Diary: memories with photos, videos and files ----------
  const diaryEl = $('#diary-content');
  const ddDialog = $('#diary-dialog');
  const MAX_FILE = 200 * 1024 * 1024;
  let diaryQuery = '', diaryFavOnly = false, editingDiaryId = null, draft = [], removedMedia = [];
  // Hooks filled in by auth.js when signed in (photos sync through the account).
  const remote = { fetch: null, upload: null, remove: null };

  // Files live in IndexedDB on this device.
  const Media = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('dayblock-media', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = async (mode, fn) => {
      const d = await open();
      return new Promise((res, rej) => {
        const t = d.transaction('files', mode);
        const req = fn(t.objectStore('files'));
        t.oncomplete = () => res(req?.result);
        t.onerror = () => rej(t.error);
      });
    };
    const urls = new Map();
    return {
      put: (id, blob) => run('readwrite', s => s.put(blob, id)),
      get: id => run('readonly', s => s.get(id)),
      del: id => { const u = urls.get(id); if (u) URL.revokeObjectURL(u); urls.delete(id); return run('readwrite', s => s.delete(id)).catch(() => {}); },
      async url(id, allowRemote) {
        if (urls.has(id)) return urls.get(id);
        let blob = await this.get(id).catch(() => null);
        if (!blob && allowRemote && remote.fetch) {
          const dataUrl = await remote.fetch(id).catch(() => null);
          if (dataUrl) { blob = await (await fetch(dataUrl)).blob(); this.put(id, blob).catch(() => {}); }
        }
        if (!blob) return null;
        const u = URL.createObjectURL(blob);
        urls.set(id, u);
        return u;
      },
    };
  })();

  // Shrink photos so they stay small enough to sync (under ~900 KB).
  function compressImage(file, maxSide = 1600) {
    return new Promise((res, rej) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(src);
        let w = img.naturalWidth, h = img.naturalHeight;
        const s = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * s); h = Math.round(h * s);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        let q = .82, dataUrl = c.toDataURL('image/jpeg', q);
        while (dataUrl.length > 900000 && q > .45) { q -= .1; dataUrl = c.toDataURL('image/jpeg', q); }
        if (dataUrl.length > 900000) {
          const c2 = document.createElement('canvas');
          c2.width = Math.round(w * .6); c2.height = Math.round(h * .6);
          c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height);
          dataUrl = c2.toDataURL('image/jpeg', .7);
        }
        fetch(dataUrl).then(r => r.blob()).then(blob => res({ blob, dataUrl })).catch(rej);
      };
      img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('unreadable image')); };
      img.src = src;
    });
  }
  const fmtSize = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  const kindOf = mime => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
  const fileIcon = m => m.kind === 'audio' ? '🎵' : /pdf/.test(m.mime) ? '📄' : /zip/.test(m.mime) ? '🗜️' : /sheet|excel/.test(m.mime) ? '📊' : /presentation|powerpoint/.test(m.mime) ? '📽️' : '📎';

  function renderDiary() {
    if (state.settings.diaryView === 'month') renderDiaryMonth();
    else renderDiaryFeed();
  }

  function mediaHTML(media, editable) {
    const visual = media.filter(m => m.kind === 'image' || m.kind === 'video');
    const files = media.filter(m => m.kind !== 'image' && m.kind !== 'video');
    return (visual.length ? `<div class="media-grid${visual.length === 1 && !editable ? ' one' : ''}">${visual.map(m =>
      `<button type="button" class="media-item" data-media="${esc(m.id)}" data-kind="${m.kind}" data-sync="${m.sync ? 1 : 0}" aria-label="Open ${esc(m.name)}">` +
      `<span class="spinner" aria-hidden="true"></span>${editable ? `<span class="rm" data-rm="${esc(m.id)}" role="button" aria-label="Remove">×</span>` : ''}</button>`).join('')}</div>` : '') +
      (files.length ? `<div class="file-list">${files.map(m =>
        `<button type="button" class="file-chip" data-file="${esc(m.id)}" data-name="${esc(m.name)}">${fileIcon(m)} <span>${esc(m.name)}</span><small>${fmtSize(m.size)}</small>` +
        `${editable ? `<span class="rm" data-rm="${esc(m.id)}" role="button" aria-label="Remove" style="position:static;background:none;color:var(--muted)">×</span>` : ''}</button>`).join('')}</div>` : '');
  }

  // Load thumbnails for media buttons inside a container.
  function hydrateMedia(root, urlFor) {
    root.querySelectorAll('[data-media]').forEach(async el => {
      const id = el.dataset.media;
      const u = urlFor ? urlFor(id) : await Media.url(id, el.dataset.sync === '1');
      const rm = el.querySelector('.rm');
      if (!u) {
        el.classList.add('missing');
        el.innerHTML = el.dataset.sync === '1' ? 'Photo is still syncing…' : (el.dataset.kind === 'video' ? '🎬 Video saved on another device' : 'Saved on another device');
      } else if (el.dataset.kind === 'video') {
        el.innerHTML = `<video src="${u}" muted preload="metadata" playsinline></video><span class="play-badge" aria-hidden="true">▶</span>`;
      } else {
        el.innerHTML = `<img src="${u}" alt="" loading="lazy">`;
      }
      if (rm) el.appendChild(rm);
    });
  }

  function renderDiaryFeed() {
    const q = diaryQuery.trim().toLowerCase();
    const list = state.diary
      .filter(e => (!diaryFavOnly || e.fav) && (!q || `${e.title} ${e.text}`.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    let html = `<button type="button" class="card diary-compose" data-diary-new><span class="avatar-sm" aria-hidden="true">✍️</span><span>What happened today? Add a memory, photo or video…</span></button>`;
    if (state.diary.length) {
      html += `<div class="diary-search"><input type="search" id="diary-q" placeholder="Search your memories…" value="${esc(diaryQuery)}" aria-label="Search memories">` +
        `<button type="button" class="chip" data-diary-favs aria-pressed="${diaryFavOnly}">♥ Favorites</button></div>`;
    }
    if (!state.diary.length) {
      html += `<div class="card">${emptyState('Your diary is empty', 'Capture moments, milestones and feelings. Add photos and videos to bring them back to life later.')}</div>`;
    } else if (!list.length) {
      html += `<div class="card">${emptyState('No matching memories', 'Try another word, or clear the search.')}</div>`;
    } else {
      let month = '';
      html += '<div class="diary-feed">';
      for (const e of list) {
        const d = fromISO(e.date);
        const m = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (m !== month) { month = m; html += `<h2 class="diary-month-title">${esc(m)}</h2>`; }
        const long = e.text.length > 420 || e.text.split('\n').length > 7;
        html += `<article class="card d-entry" data-diary="${esc(e.id)}">
          <div class="d-entry-head">
            <div class="d-date"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</small></div>
            <div class="d-title"><h3>${esc(e.title || dayLabel(e.date))}</h3>
              <div class="todo-meta">${e.mood != null ? `<span class="pill">${MOODS[e.mood][0]} ${MOODS[e.mood][1]}</span>` : ''}${e.media.length ? `<span class="pill">📎 ${e.media.length}</span>` : ''}<span class="pill">${esc(relDay(e.date) || fmtShortDate(e.date))}</span></div></div>
            <button type="button" class="icon-btn sm fav-btn${e.fav ? ' on' : ''}" data-diary-fav aria-pressed="${e.fav}" aria-label="Favorite" title="Favorite">${e.fav ? '♥' : '♡'}</button>
            <button type="button" class="icon-btn sm" data-diary-edit aria-label="Edit memory" title="Edit">${ICON.pencil}</button>
          </div>
          ${e.text ? `<p class="d-text${long ? ' clamped' : ''}">${esc(e.text)}</p>${long ? '<button type="button" class="link-btn sm" data-diary-more>Read more</button>' : ''}` : ''}
          ${mediaHTML(e.media, false)}
        </article>`;
      }
      html += '</div>';
    }
    diaryEl.innerHTML = html;
    hydrateMedia(diaryEl);
  }

  function renderDiaryMonth() {
    const { dates, month } = monthMatrix(currentDate);
    const today = todayISO();
    diaryEl.innerHTML = `<div class="card month"><div class="month-head">${weekdayHeads()}</div><div class="month-grid">` +
      dates.map(d => {
        const es = state.diary.filter(e => e.date === d);
        const img = es.flatMap(e => e.media).find(m => m.kind === 'image');
        const cls = (fromISO(d).getMonth() !== month ? ' out' : '') + (d === today ? ' today' : '');
        return `<div class="mcell${cls}" data-diary-day="${d}"><div class="mcell-top"><span class="mdate">${fromISO(d).getDate()}</span>${es.length > 1 ? `<span class="mhrs">${es.length}</span>` : ''}</div>` +
          es.slice(0, 2).map(e => `<button type="button" class="mchip diary" data-diary-open="${esc(e.id)}"><span class="t">${e.mood != null ? MOODS[e.mood][0] + ' ' : ''}${esc(e.title || e.text.slice(0, 40) || 'Memory')}</span></button>`).join('') +
          (img ? `<div class="mthumbs"><span class="media-item" data-media="${esc(img.id)}" data-kind="image" data-sync="${img.sync ? 1 : 0}" style="width:30px;height:30px;border-radius:6px"></span></div>` : '') +
          `</div>`;
      }).join('') + '</div></div>';
    hydrateMedia(diaryEl);
  }

  function openDiaryDialog(entry) {
    const e = entry || { date: currentDate > todayISO() ? todayISO() : currentDate, title: '', text: '', mood: null, media: [] };
    editingDiaryId = entry?.id || null;
    draft = e.media.map(m => ({ meta: m }));
    removedMedia = [];
    $('#dd-title').textContent = entry ? 'Edit memory' : 'New memory';
    $('#dd-name').value = e.title;
    $('#dd-date').value = e.date;
    $('#dd-text').value = e.text;
    $('#dd-mood').innerHTML = '<option value="">No mood</option>' + MOODS.map(([emo, l], i) => `<option value="${i}"${e.mood === i ? ' selected' : ''}>${emo} ${l}</option>`).join('');
    $('#dd-delete').hidden = !entry;
    $('#dd-error').hidden = true;
    $('#dd-storage').textContent = document.body.dataset.auth === 'in'
      ? 'Photos sync to your account. Videos and other files stay on this device (up to 200 MB each).'
      : 'Saved on this device. Sign in to sync photos across your devices.';
    renderDraft();
    ddDialog.showModal();
    if (!entry) $('#dd-text').focus();
  }

  function renderDraft() {
    const box = $('#dd-preview');
    box.innerHTML = mediaHTML(draft.map(d => d.meta), true);
    const local = new Map(draft.filter(d => d.url).map(d => [d.meta.id, d.url]));
    hydrateMedia(box, id => local.get(id) || null);
    // Existing media (already saved) loads from storage.
    box.querySelectorAll('[data-media]').forEach(async el => {
      if (local.has(el.dataset.media)) return;
      const u = await Media.url(el.dataset.media, el.dataset.sync === '1');
      const rm = el.querySelector('.rm');
      if (u) el.innerHTML = el.dataset.kind === 'video' ? `<video src="${u}" muted preload="metadata"></video><span class="play-badge">▶</span>` : `<img src="${u}" alt="">`;
      if (rm) el.appendChild(rm);
    });
  }

  async function addFiles(files) {
    const err = $('#dd-error');
    err.hidden = true;
    for (const f of files) {
      if (f.size > MAX_FILE) { showError(err, `“${f.name}” is larger than 200 MB.`); continue; }
      let kind = kindOf(f.type || '');
      const meta = { id: 'm' + uid(), kind, name: f.name || 'file', mime: f.type || 'application/octet-stream', size: f.size, sync: false };
      let blob = f, dataUrl = null;
      if (kind === 'image' && !/gif|svg/.test(f.type)) {
        try {
          ({ blob, dataUrl } = await compressImage(f));
          Object.assign(meta, { mime: 'image/jpeg', size: blob.size, sync: true });
        } catch { meta.kind = kind = 'file'; }
      }
      draft.push({ meta, blob, dataUrl, url: URL.createObjectURL(blob), isNew: true });
    }
    renderDraft();
  }
  $('#dd-files').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
  const drop = $('#dd-drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
  $('#dd-preview').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (!rm) return;
    e.preventDefault();
    e.stopPropagation();
    const id = rm.dataset.rm;
    const d = draft.find(x => x.meta.id === id);
    if (d && !d.isNew) removedMedia.push(d.meta);
    if (d?.url) URL.revokeObjectURL(d.url);
    draft = draft.filter(x => x.meta.id !== id);
    renderDraft();
  });

  $('#diary-form').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('#dd-text').value.trim(), title = $('#dd-name').value.trim(), date = $('#dd-date').value;
    if (!isISO(date)) return showError($('#dd-error'), 'Pick a date.');
    if (!text && !title && !draft.length) return showError($('#dd-error'), 'Write something or add a photo first.');
    const save$ = $('#dd-save');
    save$.disabled = true;
    try {
      for (const d of draft.filter(x => x.isNew)) {
        await Media.put(d.meta.id, d.blob);
        if (d.meta.sync && remote.upload) remote.upload(d.meta.id, d.dataUrl, d.meta).catch(() => {});
      }
    } catch {
      save$.disabled = false;
      return showError($('#dd-error'), 'Couldn’t save the files on this device (storage may be full).');
    }
    removedMedia.forEach(m => { Media.del(m.id); remote.remove?.(m.id); });
    const mood = $('#dd-mood').value === '' ? null : +$('#dd-mood').value;
    const data = { title, text, date, mood, media: draft.map(d => d.meta) };
    const existing = editingDiaryId && state.diary.find(x => x.id === editingDiaryId);
    if (existing) Object.assign(existing, data);
    else state.diary.push({ id: 'd' + uid(), fav: false, created: Date.now(), ...data });
    draft.forEach(d => { if (d.url) URL.revokeObjectURL(d.url); });
    save$.disabled = false;
    save();
    ddDialog.close();
    if (mode() !== 'diary') setMode('diary'); else renderAll();
    toast(existing ? 'Memory updated.' : 'Memory saved. 💜');
  });

  $('#dd-delete').addEventListener('click', () => {
    const entry = state.diary.find(x => x.id === editingDiaryId);
    if (!entry) return;
    ddDialog.close();
    withUndo('Memory deleted', () => { state.diary = state.diary.filter(x => x.id !== entry.id); });
    // Remove the files a little later, unless the delete was undone.
    setTimeout(() => {
      if (state.diary.some(x => x.id === entry.id)) return;
      entry.media.forEach(m => { Media.del(m.id); remote.remove?.(m.id); });
    }, 8000);
  });

  function openLightbox(id, kind) {
    const lb = $('#lightbox');
    Media.url(id, true).then(u => {
      if (!u) { toast('This file is saved on another device.'); return; }
      const meta = state.diary.flatMap(e => e.media).find(m => m.id === id);
      lb.innerHTML = `<div class="lb-bar"><a href="${u}" download="${esc(meta?.name || 'memory')}">Download</a><button type="button" data-lb-close>Close</button></div>` +
        (kind === 'video' ? `<video src="${u}" controls autoplay playsinline></video>` : `<img src="${u}" alt="">`);
      lb.hidden = false;
    });
  }
  $('#lightbox').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    if (e.target.closest('[data-lb-close]') || e.target.id === 'lightbox') { $('#lightbox').hidden = true; $('#lightbox').innerHTML = ''; }
  });

  diaryEl.addEventListener('input', e => {
    if (e.target.id !== 'diary-q') return;
    diaryQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderDiaryFeed();
    const q = $('#diary-q');
    if (q) { q.focus(); q.setSelectionRange(pos, pos); }
  });
  diaryEl.addEventListener('click', e => {
    if (e.target.closest('[data-diary-new]')) { openDiaryDialog(); return; }
    if (e.target.closest('[data-diary-favs]')) { diaryFavOnly = !diaryFavOnly; renderDiaryFeed(); return; }
    const media = e.target.closest('[data-media]');
    if (media && !media.classList.contains('missing') && state.settings.diaryView !== 'month') { openLightbox(media.dataset.media, media.dataset.kind); return; }
    const file = e.target.closest('[data-file]');
    if (file) {
      Media.url(file.dataset.file).then(u => {
        if (!u) { toast('This file is saved on another device.'); return; }
        const a = document.createElement('a');
        a.href = u; a.download = file.dataset.name; document.body.appendChild(a); a.click(); a.remove();
      });
      return;
    }
    const openId = e.target.closest('[data-diary-open]')?.dataset.diaryOpen;
    if (openId) { openDiaryDialog(state.diary.find(x => x.id === openId)); return; }
    const day = e.target.closest('[data-diary-day]');
    if (day) { currentDate = day.dataset.diaryDay; openDiaryDialog(); return; }
    const card = e.target.closest('[data-diary]');
    const entry = card && state.diary.find(x => x.id === card.dataset.diary);
    if (!entry) return;
    if (e.target.closest('[data-diary-edit]')) openDiaryDialog(entry);
    else if (e.target.closest('[data-diary-fav]')) { entry.fav = !entry.fav; save(); renderDiaryFeed(); }
    else if (e.target.closest('[data-diary-more]')) { card.querySelector('.d-text')?.classList.remove('clamped'); e.target.remove(); }
  });

  // ---------- Learn: how-to guide and lessons ----------
  const learnEl = $('#learn-content');
  let learnOpen = null;   // { type: 'guide' | 'lesson', id }
  let learnCat = 'All';
  const learnData = () => window.DAYBLOCK_LEARN || { guide: [], lessons: [] };
  const isLearned = id => state.learn.done.includes(id);

  function renderLearn() {
    const L = learnData();
    if (learnOpen) { renderReader(L); return; }
    if (state.settings.learnView === 'lessons') renderLessons(L); else renderGuide(L);
  }
  const ringHTML = (done, total) => `<div class="ring" style="--p:${total ? Math.round(done / total * 100) : 0}"><span>${done}/${total}</span></div>`;

  function renderGuide(L) {
    const done = L.guide.filter(g => isLearned(g.id)).length;
    learnEl.innerHTML = `
      <div class="card learn-hero"><div><span class="eyebrow">Getting started</span><h2>Welcome to Dayblock 👋</h2>
        <p>A quick tour of everything the app can do, from planning your first day to tracking time, setting life goals and keeping a diary. Each step takes about a minute.</p></div>
        <div class="learn-progress">${ringHTML(done, L.guide.length)}<small>steps read</small></div></div>
      <div class="guide-toc">${L.guide.map((g, i) => `
        <button type="button" class="card guide-step" data-learn="guide:${esc(g.id)}">
          <span class="g-num">${isLearned(g.id) ? '✓' : i + 1}</span>
          <span><h3>${esc(g.icon)} ${esc(g.title)}</h3><p>${esc(g.summary)}</p></span>
        </button>`).join('')}</div>`;
  }

  function renderLessons(L) {
    const done = L.lessons.filter(l => isLearned(l.id)).length;
    const catsL = ['All', ...new Set(L.lessons.map(l => l.cat))];
    const list = L.lessons.filter(l => learnCat === 'All' || l.cat === learnCat);
    learnEl.innerHTML = `
      <div class="card learn-hero"><div><span class="eyebrow">Learn & grow</span><h2>Master your time, grow your life</h2>
        <p>Short, practical lessons on time management, focus, goals, habits and wellbeing. Each one ends with something to try in Dayblock right away.</p></div>
        <div class="learn-progress">${ringHTML(done, L.lessons.length)}<small>lessons completed</small></div></div>
      <div class="learn-cats">${catsL.map(c => `<button type="button" class="chip" data-learn-cat="${esc(c)}" aria-pressed="${c === learnCat}">${esc(c)}</button>`).join('')}</div>
      <div class="lesson-grid">${list.map(l => `
        <button type="button" class="card lesson-card${isLearned(l.id) ? ' done' : ''}" data-learn="lesson:${esc(l.id)}">
          <span class="l-icon" aria-hidden="true">${esc(l.icon)}</span>
          <h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p>
          <span class="l-meta"><span class="pill">${esc(l.cat)}</span><span class="pill">${l.minutes} min read</span>${isLearned(l.id) ? '<span class="pill good">✓ Done</span>' : ''}</span>
        </button>`).join('')}</div>`;
  }

  function renderReader(L) {
    const list = learnOpen.type === 'guide' ? L.guide : L.lessons;
    const i = list.findIndex(x => x.id === learnOpen.id);
    const item = list[i];
    if (!item) { learnOpen = null; renderLearn(); return; }
    const next = list[i + 1];
    learnEl.innerHTML = `<div class="reader">
      <button type="button" class="btn sm reader-back" data-learn-back>← ${learnOpen.type === 'guide' ? 'All steps' : 'All lessons'}</button>
      <article class="card reader-card">
        <span class="eyebrow">${learnOpen.type === 'guide' ? `Step ${i + 1} of ${list.length}` : esc(item.cat)}</span>
        <h1>${esc(item.icon)} ${esc(item.title)}</h1>
        <div class="r-meta">${item.minutes ? `<span class="pill">${item.minutes} min read</span>` : ''}${isLearned(item.id) ? '<span class="pill good">✓ Completed</span>' : ''}</div>
        <div class="r-body">${item.body}</div>
        ${item.takeaways?.length ? `<div class="takeaways"><h3>Key takeaways</h3><ul>${item.takeaways.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
        ${item.try?.length ? `<div class="try-it"><h3>Try it in Dayblock</h3><div class="btn-row">${item.try.map((t, k) => `<button type="button" class="btn" data-learn-try="${k}">${esc(t.label)}</button>`).join('')}</div></div>` : ''}
        <div class="reader-foot">
          <button type="button" class="btn${isLearned(item.id) ? '' : ' primary'}" data-learn-done>${isLearned(item.id) ? '✓ Completed' : 'Mark as complete'}</button>
          ${next ? `<button type="button" class="btn" data-learn="${learnOpen.type}:${esc(next.id)}">Next: ${esc(next.title)} →</button>` : ''}
        </div>
      </article></div>`;
    learnEl.querySelector('.reader')?.scrollIntoView({ block: 'start' });
    scrollTo({ top: 0 });
  }

  // "Try it" buttons from lessons and guide steps.
  function learnAction(a) {
    const today = todayISO();
    switch (a.action) {
      case 'block': {
        const len = a.minutes || 60;
        const [lo, hi] = dayBounds();
        const s = nextFreeSlot(today, len) ?? clamp(9 * 60, lo, hi - len);
        currentDate = today;
        state.settings.tbView = 'day';
        setMode('timeblock');
        openBlockDialog({ date: today, start: s, end: Math.min(s + len, hi), title: a.title || '', category: cats().some(c => c.id === a.cat) ? a.cat : defaultCat() });
        break;
      }
      case 'task': {
        const repeat = a.repeat ? normRepeat(a.repeat) : null;
        let due = a.due === 'today' ? today : a.due === 'sunday' ? nextDow(addDays(today, -1), 0) : '';
        if (repeat && !due) due = today;
        addTask({ title: a.title, repeat, due, estimate: a.estimate || 0, priority: a.priority || 'med', category: defaultCat() });
        renderAll();
        toast(`Added “${a.title}” to your to-do list${repeat ? ` (${describeRepeat(repeat, due)})` : ''}.`);
        break;
      }
      case 'view':
        if (a.view) state.settings[VIEW_KEY[a.mode]] = a.view;
        learnOpen = null;
        setMode(a.mode);
        break;
      case 'diary': setMode('diary'); openDiaryDialog(); break;
      case 'settings': openSettings(); break;
    }
  }

  learnEl.addEventListener('click', e => {
    const open = e.target.closest('[data-learn]');
    if (open) { const [type, id] = open.dataset.learn.split(':'); learnOpen = { type, id }; renderAll(); return; }
    if (e.target.closest('[data-learn-back]')) { learnOpen = null; renderAll(); return; }
    const cat = e.target.closest('[data-learn-cat]');
    if (cat) { learnCat = cat.dataset.learnCat; renderLearn(); return; }
    const L = learnData();
    const list = learnOpen?.type === 'guide' ? L.guide : L.lessons;
    const item = learnOpen && list.find(x => x.id === learnOpen.id);
    if (!item) return;
    if (e.target.closest('[data-learn-done]')) {
      const d = state.learn.done;
      state.learn.done = d.includes(item.id) ? d.filter(x => x !== item.id) : [...d, item.id];
      save();
      renderAll();
      if (state.learn.done.includes(item.id)) toast('Nice! Marked as complete. 🎓');
      return;
    }
    const tryBtn = e.target.closest('[data-learn-try]');
    if (tryBtn) {
      if (!isLearned(item.id)) { state.learn.done = [...state.learn.done, item.id]; save(); }
      learnAction(item.try[+tryBtn.dataset.learnTry]);
    }
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
    const today = todayISO();
    const span = actualSpan(t.ref, today);
    const slot = plannedSlot(t.ref, today);
    const parts = [];
    if (span) parts.push(`Started ${esc(fmtTs(span.start))}` + (slot ? ` (${deltaLabel(span.start, today, slot.start, 'start')})` : ''));
    parts.push(t.status === 'paused' ? 'Paused' : `Now ${esc(fmtTs(Date.now()))}`);
    if (slot) parts.push(`Plan ${esc(fmtTime(slot.start))}–${esc(fmtTime(slot.end))}`);
    else if (planned) parts.push(`Planned ${fmtDur(planned)}`);
    if (planned && total / 60000 > planned) parts.push('<span class="late">over time</span>');
    timerSub.innerHTML = parts.join(' · ');
    timerToggle.textContent = t.status === 'paused' ? 'Resume' : 'Pause';
  }

  // The planned slot for an item on a date: the block itself, or the task's block that day.
  function plannedSlot(ref, date) {
    if (ref.startsWith('block:')) {
      const o = findOcc(ref.slice(6));
      return o && o.date === date ? { start: o.start, end: o.end } : null;
    }
    const id = ref.slice(5);
    const b = state.blocks.find(x => x.taskId === id && occursOn(x, date));
    return b ? { start: b.start, end: b.end } : null;
  }
  timerToggle.addEventListener('click', () => {
    if (!state.timer) return;
    if (state.timer.status === 'running') pauseTimer(); else startTimer(state.timer.ref);
  });
  $('#timer-stop').addEventListener('click', stopTimer);

  // ---------- Category & repeat editors ----------
  // Category chips; rebuilt on every open so custom categories show up.
  function catPicker(el, name) {
    const build = () => {
      el.innerHTML = cats().map(c =>
        `<label class="cat-opt cat-${c.id}"><input type="radio" name="${name}" value="${c.id}"><span>${esc(c.name)}</span></label>`).join('');
    };
    return {
      set: v => { build(); const id = cats().some(c => c.id === v) ? v : defaultCat(); el.querySelectorAll('input').forEach(i => { i.checked = i.value === id; }); },
      get: () => el.querySelector('input:checked')?.value || defaultCat(),
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

  function renderTrackRow(el, ref, date) {
    const ms = trackedMs(ref);
    const planned = plannedForRef(ref);
    const timing = state.timer?.ref === ref;
    const running = timing && state.timer.status === 'running';
    // Actual start/finish, compared with the plan when there is one.
    const es = state.entries.filter(e => e.ref === ref);
    let times = '';
    if (es.length) {
      const first = Math.min(...es.map(e => e.start));
      const lastEnd = Math.max(...es.map(e => e.end ?? Date.now()));
      const d = date || toISO(new Date(first));
      const slot = plannedSlot(ref, d);
      times = `<span class="track-times">Started <b>${esc(fmtTs(first))}</b>${slot ? ` (${deltaLabel(first, d, slot.start, 'start')})` : ''}` +
        ` · ${es.some(e => e.end == null) ? 'still running' : `finished <b>${esc(fmtTs(lastEnd))}</b>${slot ? ` (${deltaLabel(lastEnd, d, slot.end, 'end')})` : ''}`}` +
        ` · ${es.length} session${es.length === 1 ? '' : 's'}</span>`;
    }
    el.innerHTML =
      `<div class="track-text">Tracked <b>${fmtDur(ms / 60000)}</b>${planned ? ` of <b>${fmtDur(planned)}</b> planned` : ''}${running ? ' · <b>running</b>' : timing ? ' · paused' : ''}${times}</div>` +
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
    $('#b-postpone').hidden = !data.b || data.done;
    bError.hidden = true;
    bTrack.hidden = !data.b;
    if (data.b) renderTrackRow(bTrack, data.ref, data.date);
    const linkedTask = data.b?.taskId && findTask(data.b.taskId);
    const hist = linkedTask ? linkedTask.postponed : data.b?.postponed;
    $('#b-history').innerHTML = historyHTML(hist);
    $('#b-history').hidden = !hist?.length;
    blockDialog.showModal();
    if (!data.b) bTitle.focus();
  }

  bTrack.addEventListener('click', e => {
    const b = e.target.closest('[data-track]');
    if (!b || !editingOcc) return;
    if (b.dataset.track === 'stop') { stopTimer(); blockDialog.close(); return; }
    toggleTimer(editingOcc.ref);
    renderTrackRow(bTrack, editingOcc.ref, editingOcc.date);
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

    const snapshot = JSON.stringify(state);
    let later = null;
    if (!editingOcc) {
      state.blocks.push({ id: uid(), date, ...data, skip: [], doneOn: [], postponed: [], ...(pendingTaskId ? { taskId: pendingTaskId } : {}) });
    } else {
      const { b, date: occDate } = editingOcc;
      if (!b.repeat) {
        const oldRef = `block:${b.id}@${b.date}`;
        const oldDate = b.date;
        Object.assign(b, data, { date });
        if (!b.taskId) remapRef(oldRef, `block:${b.id}@${date}`);
        if (!data.repeat) later = markMovedLater(b, oldDate, date);
      } else {
        const scope = await askScope('Edit repeating block', 'This block repeats. Which ones should change?', occDate > b.date);
        if (scope === 'cancel') return;
        if (scope === 'one') later = markMovedLater(detach(b, occDate, { ...data, date, repeat: null }), occDate, date);
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
      if (!later) toast(`Saved to ${dayLabelIn(date)}`);
    }
    renderAll();
    postponedToast(later, date, snapshot);
  });

  $('#b-postpone').addEventListener('click', () => { if (editingOcc) openPostpone({ kind: 'occ', occ: editingOcc }); });

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
    // "Starts after": any other open task that isn't already waiting on this one (no loops).
    const blocked = chainAfter(t.id);
    const choices = sortTasks(state.tasks.filter(x => x.id !== t.id && !blocked.has(x.id) && (!x.done || x.id === t.after)));
    $('#t-after').innerHTML = '<option value="">Nothing, it can start any time</option>' +
      choices.map(x => `<option value="${esc(x.id)}"${x.id === t.after ? ' selected' : ''}>${esc(x.title)}${taskDate(x) ? ` (${esc(fmtShortDate(taskDate(x)))})` : ''}</option>`).join('');
    $('#t-history').innerHTML = historyHTML(t.postponed);
    $('#t-history').hidden = !t.postponed?.length;
    $('#t-postpone').hidden = t.done;
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
    const after = $('#t-after').value;
    const pred = after && findTask(after);
    let note = '';
    // A linked task can't be due before the task it waits for.
    if (pred && taskDate(pred) && due && due < taskDate(pred)) { due = taskDate(pred); note = ` Due date moved to ${dayLabelIn(due)} so it comes after “${pred.title}”.`; }
    const snapshot = JSON.stringify(state);
    const oldDue = t.due;
    Object.assign(t, { title, priority: tPriority.value, due, notes: tNotes.value.trim(), estimate: +tEstimate.value || 0, category: tCat.get(), repeat, after: pred ? after : '' });
    let later = null;
    if (oldDue && due && due > oldDue && !note) {
      const days = dayNum(due) - dayNum(oldDue);
      addHistory(t, oldDue, due, '');
      const visited = new Set([t.id]);
      later = { count: t.postponed.length, linked: sum(successorsOf(t.id), s => shiftTask(s, days, `Moved with “${t.title}”`, visited)) };
    }
    save();
    taskDialog.close();
    renderAll();
    if (later) postponedToast(later, due, snapshot);
    else if (note) toast(note.trim());
  });

  tDelete.addEventListener('click', () => {
    const t = findTask(editingTaskId);
    taskDialog.close();
    if (t) withUndo(`Deleted “${t.title}”`, () => deleteTask(t.id));
  });
  $('#t-postpone').addEventListener('click', () => { const t = findTask(editingTaskId); if (t) openPostpone({ kind: 'task', task: t }); });

  // ---------- Postpone dialog ----------
  const ppDialog = $('#postpone-dialog'), ppDate = $('#pp-date'), ppReason = $('#pp-reason'), ppOpts = $('#pp-opts'), ppChain = $('#pp-chain'), ppError = $('#pp-error');
  let ppTarget = null;
  const ppFrom = () => (ppTarget.kind === 'task' ? (taskDate(ppTarget.task) || todayISO()) : ppTarget.occ.date);
  const ppTask = () => (ppTarget.kind === 'task' ? ppTarget.task : (ppTarget.occ.b.taskId && !ppTarget.occ.b.repeat ? findTask(ppTarget.occ.b.taskId) : null));
  function nextDow(from, dow) { let d = addDays(from, 1); while (dowOf(d) !== dow) d = addDays(d, 1); return d; }
  function openPostpone(target) {
    ppTarget = target;
    const from = ppFrom();
    const base = from > todayISO() ? from : todayISO();
    const title = target.kind === 'task' ? target.task.title : target.occ.title;
    $('#pp-what').textContent = `“${title}” is planned for ${dayLabelIn(from)}. Move it to:`;
    const opts = [];
    const add = (label, d) => { if (d > from && !opts.some(o => o[1] === d)) opts.push([label, d]); };
    add('Tomorrow', addDays(base, 1));
    add('This weekend', nextDow(base, 6));
    add('Next week', nextDow(base, state.settings.weekStart));
    add('In 3 days', addDays(base, 3));
    ppOpts.innerHTML = opts.slice(0, 3).map(([l, d]) => `<button type="button" data-pp="${d}"><b>${l}</b><small>${esc(fmtShortDate(d))}</small></button>`).join('');
    ppDate.min = addDays(from, 1);
    ppReason.value = '';
    ppError.hidden = true;
    selectPP(opts[0][1]);
    ppDialog.showModal();
  }
  function selectPP(d) {
    ppDate.value = d;
    ppOpts.querySelectorAll('[data-pp]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pp === d)));
    const t = ppTask();
    const n = t ? chainAfter(t.id).size : 0;
    const days = d ? dayNum(d) - dayNum(ppFrom()) : 0;
    ppChain.hidden = !n || days <= 0;
    ppChain.innerHTML = `🔗 ${n} linked task${n === 1 ? '' : 's'} after this will also move ${days} day${days === 1 ? '' : 's'} later.`;
  }
  ppOpts.addEventListener('click', e => { const b = e.target.closest('[data-pp]'); if (b) selectPP(b.dataset.pp); });
  ppDate.addEventListener('input', () => selectPP(ppDate.value));
  $('#postpone-form').addEventListener('submit', e => {
    e.preventDefault();
    const to = ppDate.value;
    const from = ppFrom();
    if (!isISO(to) || to <= from) return showError(ppError, `Pick a date after ${fmtShortDate(from)}.`);
    const snapshot = JSON.stringify(state);
    const reason = ppReason.value;
    const linked = ppTarget.kind === 'task' ? postponeTask(ppTarget.task, to, reason) : postponeOcc(ppTarget.occ, to, reason);
    if (linked < 0) return showError(ppError, 'That date isn’t later than the current one.');
    const t = ppTask();
    const count = t ? t.postponed.length : (state.blocks.find(b => b.postponed?.some(p => p.to === to && p.from === from))?.postponed.length || 1);
    save();
    ppDialog.close();
    if (blockDialog.open) blockDialog.close();
    if (taskDialog.open) taskDialog.close();
    renderAll();
    postponedToast({ count, linked }, to, snapshot);
  });

  // Late-chain banner actions
  bannerEl.addEventListener('click', e => {
    const b = e.target.closest('[data-late-act]');
    const t = b && findTask(b.closest('[data-late]').dataset.late);
    if (!t) return;
    const act = b.dataset.lateAct;
    if (act === 'pick') { openPostpone({ kind: 'task', task: t }); return; }
    if (act === 'done') { setTaskDone(t, true); return; }
    if (act === 'dismiss') { state.lateSeen[t.id] = String(taskDeadline(t)); save(); renderBanner(); return; }
    const snapshot = JSON.stringify(state);
    const linked = pushChainToTomorrow(t);
    save();
    renderAll();
    toast(`Moved “${t.title}” and ${linked} linked task${linked === 1 ? '' : 's'} to ${dayLabelIn(taskDate(t))}.`,
      () => { state = normalize(JSON.parse(snapshot)); save(); renderAll(); });
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
    $('#s-chain').value = state.settings.chainMode;
    $('#s-look').querySelectorAll('input').forEach(i => { i.checked = i.value === state.settings.look; });
    renderCatEditor();
    settingsDialog.showModal();
  }

  // Looks
  $('#s-look').addEventListener('change', e => {
    if (!e.target.matches('input[name="look"]')) return;
    state.settings.look = e.target.value;
    state.settings.lookChosen = true;
    save();
    applyTheme();
    renderAll();
  });
  $('#s-chain').addEventListener('change', e => { state.settings.chainMode = e.target.value; save(); checkLateChains(); });

  // Categories editor
  function renderCatEditor() {
    const used = id => state.tasks.filter(t => t.category === id).length + state.blocks.filter(b => b.category === id).length;
    $('#s-cats').innerHTML = cats().map(c => `
      <div class="cat-edit-row cat-${c.id}" data-cat="${esc(c.id)}">
        <input type="color" value="${esc(c.color)}" aria-label="Color for ${esc(c.name)}" data-cat-color>
        <input type="text" value="${esc(c.name)}" maxlength="30" aria-label="Category name" data-cat-name>
        <span class="count">${used(c.id)} item${used(c.id) === 1 ? '' : 's'}</span>
        ${c.id === 'other' ? '<span class="icon-btn sm" aria-hidden="true"></span>' : `<button type="button" class="icon-btn sm" data-cat-del aria-label="Delete ${esc(c.name)}" title="Delete (items move to Other)">${ICON.trash}</button>`}
      </div>`).join('');
    $('#s-cat-color').value = CAT_SWATCHES.find(s => !cats().some(c => c.color.toLowerCase() === s)) || '#14b8a6';
  }
  $('#s-cats').addEventListener('input', e => {
    const row = e.target.closest('[data-cat]');
    const c = row && cats().find(x => x.id === row.dataset.cat);
    if (!c) return;
    if (e.target.matches('[data-cat-color]')) { c.color = e.target.value; applyCategoryStyles(); }
    if (e.target.matches('[data-cat-name]')) c.name = e.target.value.trim() || 'Untitled';
    save();
  });
  $('#s-cats').addEventListener('change', () => renderAll());
  $('#s-cats').addEventListener('click', e => {
    const del = e.target.closest('[data-cat-del]');
    if (!del) return;
    const id = del.closest('[data-cat]').dataset.cat;
    const c = cats().find(x => x.id === id);
    if (!c) return;
    withUndo(`Deleted category “${c.name}”. Its items moved to Other.`, () => {
      state.categories = state.categories.filter(x => x.id !== id);
      state.tasks.forEach(t => { if (t.category === id) t.category = 'other'; });
      state.blocks.forEach(b => { if (b.category === id) b.category = 'other'; });
      if (lastCategory === id) lastCategory = defaultCat();
    });
    applyCategoryStyles();
    renderCatEditor();
  });
  $('#s-cat-add').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#s-cat-name').value.trim();
    if (!name) { $('#s-cat-name').focus(); return; }
    if (cats().some(c => c.name.toLowerCase() === name.toLowerCase())) { toast(`You already have a “${name}” category.`); return; }
    state.categories.push({ id: 'c' + uid(), name: name.slice(0, 30), color: $('#s-cat-color').value });
    $('#s-cat-name').value = '';
    save();
    applyCategoryStyles();
    renderCatEditor();
    renderAll();
    toast(`Added “${name}”. Pick it when you create a block or task.`);
  });

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
    const snapshot = JSON.stringify(state);
    let later = null;
    if (b.repeat) {
      const nb = detach(b, o.date, { date: d.newDate, start: d.newStart, end: d.newEnd });
      later = markMovedLater(nb, o.date, d.newDate);
      if (!later) toast('Changed this occurrence only.');
    } else {
      const oldRef = `block:${b.id}@${b.date}`;
      Object.assign(b, { date: d.newDate, start: d.newStart, end: d.newEnd });
      if (!b.taskId) remapRef(oldRef, `block:${b.id}@${b.date}`);
      if (b.doneOn.length) b.doneOn = [b.date];
      later = markMovedLater(b, o.date, d.newDate);
    }
    save();
    renderAll();
    postponedToast(later, d.newDate, snapshot);
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
  modeBtns.forEach(b => b.addEventListener('click', () => { if (b.dataset.mode === 'learn') learnOpen = null; setMode(b.dataset.mode); scrollTo({ top: 0 }); }));
  viewSwitch.addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) { if (mode() === 'learn') learnOpen = null; setView(b.dataset.view); }
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
      if (b) toast(`Scheduled “${t.title}” ${dayLabelIn(b.date)} at ${fmtTime(b.start)}`);
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
      case 'postpone': openPostpone({ kind: 'task', task: t }); break;
      case 'schedule': {
        const b = scheduleTask(t, t.due && t.due > todayISO() ? t.due : todayISO());
        if (b) toast(`Scheduled ${dayLabelIn(b.date)} at ${fmtTime(b.start)}`);
        break;
      }
      case 'goto': currentDate = btn.dataset.date; state.settings.tbView = 'day'; setMode('timeblock'); break;
    }
  });

  function newItem() {
    const m = mode();
    if (m === 'diary') { openDiaryDialog(); return; }
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
    if (ticks % 30 === 15) checkLateChains();
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
      if (colsEl.children.length === 1) line.innerHTML = `<span>${esc(fmtTs(Date.now()))}</span>`;
      col.appendChild(line);
    }
    colsEl.querySelectorAll('.block[data-key]').forEach(n => {
      const o = findOcc(n.dataset.key);
      if (o) n.classList.toggle('now', o.date === today && m >= o.start && m < o.end);
    });
    // Grow the live tracked lane and refresh the "actual" line on the running block.
    if (state.timer?.status === 'running' && col) {
      drawActualLanes(col, today);
      const tn = colsEl.querySelector('.block.tracking[data-key]');
      const o = tn && findOcc(tn.dataset.key);
      const span = o && actualSpan(o.ref, o.date);
      const el = tn?.querySelector('.block-actual');
      if (el && span) el.innerHTML = `● ${esc(fmtTs(span.start))} – now · ${deltaLabel(span.start, o.date, o.start, 'start')}`;
    }
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
    // Photo sync hooks (auth.js): fetch(id) -> dataURL, upload(id, dataURL, meta), remove(id).
    setRemoteMedia(hooks) { Object.assign(remote, hooks || { fetch: null, upload: null, remove: null }); if (mode() === 'diary') renderAll(); },
    // Photos added while signed out that should be uploaded once signed in.
    async pendingPhotos() { const out = []; for (const e of state.diary) for (const m of e.media) if (m.sync) out.push(m); return out; },
    getMediaBlob: id => Media.get(id),
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
