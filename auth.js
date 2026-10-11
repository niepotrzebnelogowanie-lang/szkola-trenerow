import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.SZKOLA_SUPABASE_CONFIG || {};
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || '') && !!config.anonKey && !String(config.anonKey).includes('YOUR_');
const root = document.getElementById('modal-root');
let supabase = null;
let currentUser = null;
let syncing = false;
let syncTimer = null;
let lastAuthError = '';

if (configured) {
  supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emailValid = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function authButtonLabel() {
  const button = document.getElementById('auth-open');
  if (!button) return;
  if (currentUser) button.innerHTML = `<span class="auth-user-dot"></span>${safe(currentUser.email)} <span aria-hidden="true">⌄</span>`;
  else button.innerHTML = 'Zaloguj się <span aria-hidden="true">↗</span>';
  button.setAttribute('aria-label', currentUser ? `Konto: ${currentUser.email}` : 'Zaloguj się lub utwórz konto');
  const profile = document.querySelector('.profile-mini');
  if (profile) {
    const strong = profile.querySelector('strong');
    const sub = profile.querySelector('span');
    const avatar = profile.querySelector('.avatar');
    if (strong) strong.textContent = currentUser ? (currentUser.email.split('@')[0] || 'Trener') : 'Twój warsztat';
    if (sub) sub.textContent = currentUser ? 'Konto zsynchronizowane' : 'Tryb lokalny';
    if (avatar) avatar.textContent = currentUser ? currentUser.email.slice(0,2).toUpperCase() : 'ST';
  }
}
function toastAuth(message, error=false) {
  const host = document.getElementById('toast-root');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
function setMessage(message, error=false) {
  const node = root?.querySelector('[data-auth-message]');
  if (!node) return;
  node.textContent = message;
  node.className = 'auth-message' + (error ? ' error' : '');
  node.hidden = !message;
}
function closeAuth() { root.innerHTML = ''; document.body.classList.remove('auth-modal-open'); }
function showAuth(mode='login', message='') {
  document.body.classList.add('auth-modal-open');
  root.innerHTML = `
    <div class="auth-backdrop" data-auth-close></div>
    <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button class="auth-close" type="button" data-auth-close aria-label="Zamknij">×</button>
      <div class="auth-brand-mark" aria-hidden="true">ST</div>
      <div class="auth-kicker">SZKOŁA TRENERÓW / TWOJE KONTO</div>
      <h2 id="auth-title">${mode==='register'?'Dołącz do akademii':mode==='forgot'?'Odzyskaj dostęp':mode==='new-password'?'Ustaw nowe hasło':currentUser?'Twoje konto':'Witaj ponownie'}</h2>
      <p class="auth-intro">${mode==='register'?'Załóż konto, aby zachować postępy i korzystać z nich na różnych urządzeniach.':mode==='forgot'?'Wyślemy na Twój adres e-mail bezpieczny link do zmiany hasła.':mode==='new-password'?'Wybierz nowe, unikalne hasło do swojego konta.':currentUser?'Twoje konto i synchronizacja postępów.':'Zaloguj się, aby zsynchronizować warsztat trenerski.'}</p>
      ${!configured ? `<div class="auth-setup-notice"><strong>Konfiguracja kont jeszcze nie jest zakończona.</strong><p>Dodaj adres URL projektu Supabase i klucz anon/public w pliku <code>supabase-config.js</code>, a następnie wykonaj instrukcję z README. Nie wklejaj tutaj klucza service_role.</p></div>` : ''}
      ${currentUser && mode==='account' ? `<div class="auth-account-card"><span class="auth-user-dot"></span><div><strong>${safe(currentUser.email)}</strong><small>Konto aktywne</small></div></div><button class="btn primary auth-submit" type="button" data-auth-logout>Wyloguj się</button>` : `
        <div class="auth-tabs" role="tablist" aria-label="Opcje konta">
          <button type="button" data-auth-mode="login" class="${mode==='login'?'active':''}" ${mode==='forgot'||mode==='new-password'?'disabled':''}>Zaloguj się</button>
          <button type="button" data-auth-mode="register" class="${mode==='register'?'active':''}" ${mode==='forgot'||mode==='new-password'?'disabled':''}>Zarejestruj się</button>
        </div>
        <form id="auth-form" novalidate>
          ${mode==='new-password'?'':`<label class="auth-label" for="auth-email">Adres e-mail</label><input class="auth-input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="trener@example.com" required maxlength="254" ${mode==='forgot'?'':'autofocus'}>`}
          ${mode==='login'||mode==='register'||mode==='new-password'?`<label class="auth-label" for="auth-password">${mode==='new-password'?'Nowe hasło':'Hasło'}</label><input class="auth-input" id="auth-password" name="password" type="password" autocomplete="${mode==='register'?'new-password':mode==='new-password'?'new-password':'current-password'}" placeholder="${mode==='register'||mode==='new-password'?'Minimum 10 znaków':'Wpisz hasło'}" required minlength="${mode==='register'||mode==='new-password'?'10':'1'}" maxlength="128">`:''}
          ${mode==='register'?`<label class="auth-label" for="auth-password-confirm">Powtórz hasło</label><input class="auth-input" id="auth-password-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Wpisz hasło ponownie" required minlength="10" maxlength="128">`:''}
          <div class="auth-message" data-auth-message ${message?'':'hidden'}>${safe(message)}</div>
          <button class="btn primary auth-submit" type="submit" ${configured?'':'disabled'}>${mode==='register'?'Utwórz konto':mode==='forgot'?'Wyślij link odzyskiwania':mode==='new-password'?'Zapisz nowe hasło':'Zaloguj się'} <span aria-hidden="true">↗</span></button>
        </form>
        ${mode==='login'?'<button class="auth-link" type="button" data-auth-mode="forgot">Nie pamiętam hasła</button>':''}
        ${mode==='forgot'||mode==='new-password'?'<button class="auth-link" type="button" data-auth-mode="login">Wróć do logowania</button>':''}
        ${mode==='register'?'<p class="auth-legal">Rejestrując się, potwierdzasz, że podany adres e-mail należy do Ciebie. Link weryfikacyjny może być wymagany przed pierwszym logowaniem.</p>':''}
      `}
      <div class="auth-footer"><span>BEZPIECZNE LOGOWANIE</span><span>SUPABASE AUTH</span></div>
    </section>`;
  setTimeout(() => root.querySelector('input:not([disabled])')?.focus(), 30);
}

async function syncFromCloud(user) {
  if (!supabase || !user || syncing || !window.SzkolaApp) return;
  syncing = true;
  try {
    const app = window.SzkolaApp;
    const { data, error } = await supabase.from('user_workspaces').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const localRaw = localStorage.getItem(app.storeKey);
    const local = localRaw ? JSON.parse(localRaw) : null;
    if (data?.data && typeof data.data === 'object') {
      // Preserve unsynced work before switching identity on a shared browser.
      if (local && ((local.completedLessons||[]).length || (local.journal||[]).length || (local.players||[]).length || Object.keys(local.analysisWork||{}).length || Object.keys(local.practiceSubmissions||{}).length)) {
        localStorage.setItem('szkola-trenerow-local-backup-before-account', JSON.stringify(local));
      }
      // Cloud data wins on sign-in to avoid uploading data left by another user on a shared device.
      const cloudData = {...data.data, _updatedAt: data.updated_at || data.data._updatedAt || new Date().toISOString()};
      app.replaceStore(cloudData);
      toastAuth('Postępy pobrane z Twojego konta.');
    } else {
      const hasLocalWork = local && ((local.completedLessons||[]).length || (local.journal||[]).length || (local.players||[]).length || Object.keys(local.analysisWork||{}).length || Object.keys(local.practiceSubmissions||{}).length);
      if (hasLocalWork && window.confirm('To konto nie ma jeszcze zapisanych postępów. Czy przenieść na nie dane z tej przeglądarki? Wybierz „Anuluj”, aby zachować lokalną kopię i zacząć na koncie od czystego warsztatu.')) {
        await writeCloud(user, app.store);
        toastAuth('Lokalne postępy zostały przeniesione na konto.');
      } else if (hasLocalWork) {
        localStorage.setItem('szkola-trenerow-local-backup-before-account', JSON.stringify(local));
        app.replaceStore(app.defaultStore());
        await writeCloud(user, app.store);
        toastAuth('Konto zaczyna od czystego warsztatu. Lokalną kopię zachowano w tej przeglądarce.');
      } else {
        await writeCloud(user, app.store);
        toastAuth('Konto gotowe. Postępy będą synchronizowane.');
      }
    }
  } catch (err) {
    console.error('Szkoła trenerów: cloud sync error', err);
    toastAuth('Logowanie działa, ale synchronizacja nie powiodła się. Sprawdź konfigurację tabeli w Supabase.', true);
  } finally { syncing = false; }
}
async function writeCloud(user, store) {
  if (!supabase || !user) return;
  const payload = JSON.parse(JSON.stringify(store));
  payload._updatedAt = new Date().toISOString();
  const { error } = await supabase.from('user_workspaces').upsert({ user_id:user.id, data:payload, updated_at:payload._updatedAt }, { onConflict:'user_id' });
  if (error) throw error;
}
function queueSync(store) {
  if (!supabase || !currentUser || syncing) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try { await writeCloud(currentUser, store); }
    catch (err) { console.error('Szkoła trenerów: save error', err); toastAuth('Nie udało się zsynchronizować zmian. Dane pozostają zapisane lokalnie.', true); }
  }, 900);
}
window.SzkolaAuth = {
  open: () => showAuth(currentUser ? 'account' : 'login'),
  queueSync,
  getUser: () => currentUser
};

async function submitAuth(form) {
  const fd = new FormData(form);
  const email = String(fd.get('email')||'').trim().toLowerCase();
  const password = String(fd.get('password')||'');
  const confirm = String(fd.get('confirm')||'');
  const mode = root.querySelector('#auth-title')?.textContent.includes('Dołącz') ? 'register'
    : root.querySelector('#auth-title')?.textContent.includes('Odzyskaj') ? 'forgot'
    : root.querySelector('#auth-title')?.textContent.includes('Ustaw nowe') ? 'new-password' : 'login';
  if (!supabase) { setMessage('Najpierw skonfiguruj Supabase w supabase-config.js i uruchom SQL z folderu supabase/.', true); return; }
  if (mode!=='new-password' && !emailValid(email)) { setMessage('Wpisz poprawny adres e-mail.', true); return; }
  if ((mode==='register'||mode==='new-password') && password.length<10) { setMessage('Hasło musi mieć co najmniej 10 znaków.', true); return; }
  if (password.length>128) { setMessage('Hasło jest zbyt długie.', true); return; }
  if (mode==='register' && password!==confirm) { setMessage('Hasła nie są identyczne.', true); return; }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; submit.textContent = 'Przetwarzanie…';
  try {
    if (mode==='register') {
      const {data,error} = await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
      if (error) throw error;
      if (data.session) { currentUser=data.user; authButtonLabel(); closeAuth(); await syncFromCloud(currentUser); toastAuth('Konto utworzone i zalogowane.'); }
      else showAuth('login','Konto utworzone. Sprawdź skrzynkę e-mail i kliknij link weryfikacyjny przed zalogowaniem.');
    } else if (mode==='login') {
      const {data,error} = await supabase.auth.signInWithPassword({email,password});
      if (error) throw error;
      currentUser=data.user; authButtonLabel(); closeAuth(); await syncFromCloud(currentUser); toastAuth('Zalogowano pomyślnie.');
    } else if (mode==='forgot') {
      const {error} = await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname+'?reset=1'});
      if (error) throw error;
      showAuth('login','Jeśli konto z tym adresem istnieje, wysłaliśmy wiadomość z linkiem do zmiany hasła. Sprawdź też spam.');
    } else if (mode==='new-password') {
      if (!password) { setMessage('Wpisz nowe hasło.',true); return; }
      const {error} = await supabase.auth.updateUser({password});
      if (error) throw error;
      const {data} = await supabase.auth.getUser(); currentUser=data.user; authButtonLabel(); closeAuth(); toastAuth('Hasło zostało zmienione.');
    }
  } catch (err) {
    const msg = err?.message || 'Nie udało się wykonać operacji. Spróbuj ponownie.';
    setMessage(msg, true);
    const activeSubmit = root.querySelector('[type="submit"]');
    if(activeSubmit){activeSubmit.disabled=false;activeSubmit.textContent=mode==='register'?'Utwórz konto':mode==='forgot'?'Wyślij link odzyskiwania':mode==='new-password'?'Zapisz nowe hasło':'Zaloguj się';}
  }
}

root.addEventListener('click', async e => {
  if (e.target.closest('[data-auth-close]')) { closeAuth(); return; }
  const modeButton = e.target.closest('[data-auth-mode]');
  if (modeButton && !modeButton.disabled) { showAuth(modeButton.dataset.authMode); return; }
  if (e.target.closest('[data-auth-logout]')) {
    if (supabase) { const {error} = await supabase.auth.signOut(); if(error){toastAuth('Nie udało się wylogować.',true);return;} }
    currentUser=null; authButtonLabel(); closeAuth(); toastAuth('Wylogowano. Lokalne dane pozostają na tym urządzeniu.'); return;
  }
});
root.addEventListener('submit', e => { if(e.target.id==='auth-form'){e.preventDefault();submitAuth(e.target);} });
document.getElementById('auth-open')?.addEventListener('click', () => showAuth(currentUser ? 'account' : 'login'));
document.addEventListener('click', e => { if(e.target.closest('[data-auth-open]')) {e.preventDefault();showAuth(currentUser?'account':'login');} });
document.addEventListener('keydown', e => { if(e.key==='Escape' && root.innerHTML) closeAuth(); });

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    authButtonLabel();
    if (event === 'PASSWORD_RECOVERY') showAuth('new-password');
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setTimeout(() => { if(session?.user) syncFromCloud(session.user); }, 0);
  });
} else {
  authButtonLabel();
}
if (new URLSearchParams(window.location.search).get('reset') === '1') showAuth('new-password');
