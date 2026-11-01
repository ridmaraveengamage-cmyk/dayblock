// Sign-in (Google + email/password) and cloud sync via Firebase.
// Without a Firebase config the app runs in "this device only" mode.
import { firebaseConfig } from './firebase-config.js?v=6';

const App = window.DayblockApp;
const FB_VERSION = '10.12.2';
const GUEST_FLAG = 'dayblock:guest';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const configured = !!(firebaseConfig && firebaseConfig.apiKey);
let fb = null;            // { auth, db, A (auth module), F (firestore module) }
let user = null;
let unsubDoc = null;
let pushTimer = null;
let syncState = 'idle';   // idle | syncing | synced | offline | error
let authTab = 'signin';

const setAuthState = s => { document.body.dataset.auth = s; };
const isGuest = () => { try { return localStorage.getItem(GUEST_FLAG) === '1'; } catch { return false; } };
const setGuest = v => { try { v ? localStorage.setItem(GUEST_FLAG, '1') : localStorage.removeItem(GUEST_FLAG); } catch { /* storage blocked */ } };

// ---------- UI wiring ----------
const emailForm = $('#email-form'), nameField = $('#name-field');
const authName = $('#auth-name'), authEmail = $('#auth-email'), authPassword = $('#auth-password');
const authError = $('#auth-error'), authInfo = $('#auth-info'), submitBtn = $('#email-submit');
const configNote = $('#auth-config-note');

function showError(msg) { authInfo.hidden = true; authError.textContent = msg; authError.hidden = !msg; }
function showInfo(msg) { authError.hidden = true; authInfo.textContent = msg; authInfo.hidden = !msg; }

function setTab(tab) {
  authTab = tab;
  document.querySelectorAll('.auth-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  nameField.hidden = tab !== 'signup';
  submitBtn.textContent = tab === 'signup' ? 'Create account' : 'Sign in';
  authPassword.autocomplete = tab === 'signup' ? 'new-password' : 'current-password';
  $('#forgot-btn').hidden = tab === 'signup';
  showError('');
}

document.querySelector('.auth-tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

$('#guest-btn').addEventListener('click', () => {
  setGuest(true);
  setAuthState('guest');
  renderAccount();
});

function busy(on) {
  submitBtn.disabled = on;
  $('#google-btn').disabled = on || !configured;
}

const MESSAGES = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/unauthorized-domain': 'This web address isn’t allowed to sign in yet. Add it in Firebase → Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed': 'This sign-in method isn’t turned on in Firebase yet (Authentication → Sign-in method).',
  'auth/account-exists-with-different-credential': 'This email is already used with another sign-in method. Sign in with email instead.',
};
const friendly = err => (err?.code in MESSAGES ? MESSAGES[err.code] : (err?.message || 'Something went wrong. Please try again.'));

$('#google-btn').addEventListener('click', async () => {
  if (!fb) return;
  const { A, auth } = fb;
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  busy(true);
  showError('');
  try {
    await A.signInWithPopup(auth, provider);
  } catch (err) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(err.code)) {
      await A.signInWithRedirect(auth, provider).catch(e => showError(friendly(e)));
    } else {
      showError(friendly(err));
    }
  } finally {
    busy(false);
  }
});

emailForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!fb) return;
  const { A, auth } = fb;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email) return showError('Enter your email address.');
  if (password.length < 6) return showError('Use a password with at least 6 characters.');
  busy(true);
  showError('');
  try {
    if (authTab === 'signup') {
      const cred = await A.createUserWithEmailAndPassword(auth, email, password);
      const name = authName.value.trim();
      if (name) await A.updateProfile(cred.user, { displayName: name });
      A.sendEmailVerification(cred.user).catch(() => {});
      renderAccount();
      App.toast(`Welcome${name ? ', ' + name : ''}! We sent a verification link to ${email}.`);
    } else {
      await A.signInWithEmailAndPassword(auth, email, password);
    }
    authPassword.value = '';
  } catch (err) {
    showError(friendly(err));
  } finally {
    busy(false);
  }
});

$('#forgot-btn').addEventListener('click', async () => {
  if (!fb) return;
  const email = authEmail.value.trim();
  if (!email) { showError('Type your email above first, then press “Forgot password?” again.'); authEmail.focus(); return; }
  try {
    await fb.A.sendPasswordResetEmail(fb.auth, email);
    showInfo(`If an account exists for ${email}, a reset link is on its way.`);
  } catch (err) {
    showError(friendly(err));
  }
});

// ---------- Account panel (inside Settings) ----------
function initials(u) {
  const src = (u.displayName || u.email || '?').trim();
  return src.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}
function avatarHTML(u, size) {
  return u.photoURL
    ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" width="${size}" height="${size}" referrerpolicy="no-referrer">`
    : `<span class="avatar">${esc(initials(u))}</span>`;
}
const SYNC_TEXT = {
  idle: ['', 'Connecting…'], syncing: ['busy', 'Saving…'], synced: ['', 'Synced across your devices'],
  offline: ['busy', 'Offline — will sync when back online'], error: ['err', 'Sync problem — changes are kept on this device'],
};

const settingsBtn = $('#settings-btn');
const gearHTML = settingsBtn.innerHTML;

function renderAccount() {
  const box = $('#account-box');
  const u = fb?.auth.currentUser || user;
  if (u) {
    const [cls, text] = SYNC_TEXT[syncState];
    box.innerHTML = `${avatarHTML(u, 40)}
      <div class="who"><b>${esc(u.displayName || 'Signed in')}</b><span>${esc(u.email || '')}</span><br>
        <span><i class="sync-dot ${cls}"></i>${esc(text)}</span></div>
      <button type="button" class="btn" id="signout-btn">Sign out</button>`;
    settingsBtn.innerHTML = avatarHTML(u, 30);
  } else {
    box.innerHTML = `<div class="who"><b>Not signed in</b><span>Your plans are saved on this device only.</span></div>
      <button type="button" class="btn primary" id="signin-btn">Sign in or create account</button>`;
    settingsBtn.innerHTML = gearHTML;
  }
}

document.addEventListener('click', async e => {
  if (e.target.closest('#signin-btn')) {
    $('#settings-dialog').close();
    setGuest(false);
    setAuthState('signedout');
  } else if (e.target.closest('#signout-btn')) {
    if (!fb) return;
    if (pushTimer) { clearTimeout(pushTimer); await pushNow(); }
    await fb.A.signOut(fb.auth);
    $('#settings-dialog').close();
  }
});

// ---------- Cloud sync ----------
function setSync(s) { syncState = s; renderAccount(); }

function userDoc() { return fb.F.doc(fb.db, 'users', user.uid); }

async function pushNow() {
  pushTimer = null;
  if (!user || !fb) return;
  setSync(navigator.onLine === false ? 'offline' : 'syncing');
  try {
    const s = App.getState();
    await fb.F.setDoc(userDoc(), { data: JSON.stringify(s), updatedAt: s.updatedAt || Date.now(), savedAt: fb.F.serverTimestamp() });
    setSync('synced');
  } catch (err) {
    console.warn('Sync failed', err);
    setSync(navigator.onLine === false ? 'offline' : 'error');
  }
}
function schedulePush() {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 800);
}
App.onChange(schedulePush);
window.addEventListener('online', () => { if (user) schedulePush(); });

// Combine two copies by item id; the newer copy wins on conflicts.
function merge(a, b) {
  const [older, newer] = (a.updatedAt || 0) <= (b.updatedAt || 0) ? [a, b] : [b, a];
  const byId = (x, y) => {
    const m = new Map((x || []).map(i => [i.id, i]));
    (y || []).forEach(i => m.set(i.id, i));
    return [...m.values()];
  };
  return {
    ...newer,
    blocks: byId(older.blocks, newer.blocks),
    tasks: byId(older.tasks, newer.tasks),
    entries: byId(older.entries, newer.entries),
    updatedAt: Date.now(),
  };
}

function onSignedIn(u) {
  user = u;
  setGuest(false);
  const fromGuest = App.getStoreKey() === App.GUEST_KEY ? App.getState() : null;
  const { seeded } = App.switchStore(`dayblock:u:${u.uid}`, { seed: fromGuest });
  setAuthState('in');
  setSync('idle');
  let first = true;
  unsubDoc?.();
  unsubDoc = fb.F.onSnapshot(userDoc(), { includeMetadataChanges: false }, snap => {
    if (snap.metadata.hasPendingWrites) return;
    const local = App.getState();
    if (!snap.exists()) {
      if (first && !App.isEmpty(local)) pushNow(); else setSync('synced');
      first = false;
      return;
    }
    let remote;
    try { remote = JSON.parse(snap.data().data); } catch { first = false; return; }
    if (first && seeded) {
      App.replaceState(merge(remote, local));
      pushNow();
      App.toast('Your plans from this device were added to your account.');
    } else if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
      App.replaceState(remote);
      setSync('synced');
    } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
      schedulePush();
    } else {
      setSync('synced');
    }
    first = false;
  }, err => {
    console.warn('Sync listener error', err);
    setSync('error');
  });
}

function onSignedOut() {
  unsubDoc?.();
  unsubDoc = null;
  user = null;
  syncState = 'idle';
  if (App.getStoreKey() !== App.GUEST_KEY) App.switchStore(App.GUEST_KEY);
  setAuthState(isGuest() ? 'guest' : 'signedout');
  renderAccount();
}

// ---------- Start ----------
async function init() {
  renderAccount();
  if (!configured) {
    configNote.innerHTML = 'Google and email sign-in aren’t set up yet. Add your Firebase keys to <code>firebase-config.js</code> (see README). You can still use Dayblock on this device.';
    configNote.hidden = false;
    $('#google-btn').disabled = true;
    submitBtn.disabled = true;
    $('#forgot-btn').disabled = true;
    setAuthState(isGuest() ? 'guest' : 'signedout');
    return;
  }
  try {
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
    const [appMod, A, F] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    const auth = A.getAuth(app);
    const db = F.getFirestore(app);
    fb = { auth, db, A, F };
    A.getRedirectResult(auth).catch(err => showError(friendly(err)));
    A.onAuthStateChanged(auth, u => (u ? onSignedIn(u) : onSignedOut()));
  } catch (err) {
    console.warn('Firebase failed to load', err);
    configNote.textContent = 'Couldn’t reach the sign-in service (are you offline?). You can keep using Dayblock on this device.';
    configNote.hidden = false;
    $('#google-btn').disabled = true;
    submitBtn.disabled = true;
    setAuthState(isGuest() ? 'guest' : 'signedout');
  }
}

setTab('signin');
init();
