(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const LS_KEY = 'amorim-beauty:v2';
  const AUTH_KEY = 'amorim-beauty:auth';
  const DAY_START = 8 * 60;
  const DAY_END = 20 * 60;
  const SLOT_WINDOW = 60;

  const WD = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const WD_S = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const STATUS = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' };
  const VIEWS = ['agenda', 'disponibilidade', 'clientes', 'servicos', 'profissionais'];

  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l9 16H3l9-16z"/><path d="M12 9.5v4M12 16.6v.1"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
  const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

  const DEMO_ADMIN = { email: 'geovana@amorimbeauty.com.br', password: 'amorim2026', name: 'Geovana Amorim' };

  const state = {
    mode: 'demo',
    modeNote: 'Postgres na Vercel',
    storageNote: 'Dados salvos no navegador',
    clientTab: 'agendar',
    lookupPhone: '',
    lookupResult: null,
    lookupError: '',
    area: 'admin',
    authed: false,
    adminName: 'Administradora',
    authToken: '',
    loginError: '',
    needsSetup: false,
    setupError: '',
    view: 'agenda',
    calView: 'day',
    date: todayISO(),
    profFilter: 'all',
    serviceFilter: 'all',
    clientQuery: '',
    seededOn: null,
    touched: false,
    clients: [],
    services: [],
    professionals: [],
    appointments: [],
    slots: []
  };

  const booking = { date: null, slotId: null, serviceId: null, step: 'browse', confirmed: null, error: '', draft: { name: '', phone: '' } };

  function pad(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayISO() { return isoDate(new Date()); }
  function fromISO(s) {
    const n = normDate(s);
    const p = n.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function isISO(s) {
    const m = String(s == null ? '' : s).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) return false;
    const d = fromISO(m);
    return !isNaN(d.getTime()) && isoDate(d) === m;
  }
  // A API pode devolver DATE como objeto Date ou string com fuso/hora. Normalizamos
  // para 'YYYY-MM-DD' e 'HH:MM' para que nada exiba NaN/undefined na interface.
  function normDate(v) {
    if (v == null) return '';
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : isoDate(v);
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    if (!/\d{4}/.test(s)) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : isoDate(d);
  }
  function normTime(v) {
    const m = String(v == null ? '' : v).match(/^(\d{1,2}):(\d{2})/);
    return m ? pad(Number(m[1])) + ':' + m[2] : '';
  }
  function normSlot(s) { return Object.assign({}, s, { date: normDate(s.date), start: normTime(s.start) }); }
  function normAppt(a) { return Object.assign({}, a, { date: normDate(a.date), start: normTime(a.start) }); }
  function addDays(iso, n) {
    if (!isISO(iso)) return '';
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  }
  function toMin(t) { const p = String(t || '00:00').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
  function fromMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function brl(cents) { return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function uid(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function longDate(iso) {
    if (!isISO(iso)) return 'Data a confirmar';
    const d = fromISO(iso);
    return WD[d.getDay()] + ', ' + d.getDate() + ' de ' + MO[d.getMonth()];
  }
  function shortDate(iso) {
    if (!isISO(iso)) return '—';
    const d = fromISO(iso);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  }
  function shortToday() {
    const d = new Date();
    return WD_S[d.getDay()] + ', ' + d.getDate() + ' ' + MO[d.getMonth()].slice(0, 3);
  }
  function weekStart(iso) {
    if (!isISO(iso)) return '';
    const d = fromISO(iso);
    const off = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - off);
    return isoDate(d);
  }
  function weekLabel(iso) {
    const start = weekStart(iso);
    if (!start) return 'Semana';
    const end = addDays(start, 6);
    if (!end) return cap(longDate(start));
    const s = fromISO(start);
    const e = fromISO(end);
    if (s.getMonth() === e.getMonth()) return s.getDate() + ' – ' + e.getDate() + ' de ' + MO[s.getMonth()];
    return s.getDate() + ' ' + MO[s.getMonth()].slice(0, 3) + ' – ' + e.getDate() + ' ' + MO[e.getMonth()].slice(0, 3);
  }
  function initials(name) {
    const p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function phoneDigits(phone) { return String(phone || '').replace(/\D/g, ''); }
  function waLink(phone, text) {
    const d = phoneDigits(phone);
    if (!d) return '#';
    const num = d.length <= 11 ? '55' + d : d;
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CATEGORY_ORDER = ['Sobrancelhas', 'Estética facial', 'Massagens'];

  // Catálogo e valores importados de valores.xlsx.
  // A planilha não traz duração: os minutos abaixo são estimativas editáveis em Serviços.
  // Hidra Gloss: R$ 120,00 vale só na 1ª sessão; repeatPrice é o valor das sessões seguintes.
  const SERVICE_SEED = [
    { id: 's1', name: 'Massagem Relaxante', category: 'Massagens', duration: 60, price: 10000, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's2', name: 'Drenagem Linfática', category: 'Massagens', duration: 60, price: 10000, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's3', name: 'Drenagem Linfática Facial', category: 'Estética facial', duration: 45, price: 5000, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's4', name: 'Limpeza de Pele', category: 'Estética facial', duration: 75, price: 12000, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's5', name: 'Design', category: 'Sobrancelhas', duration: 45, price: 4000, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's6', name: 'Design com henna', category: 'Sobrancelhas', duration: 60, price: 4500, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's7', name: 'Design com tintura', category: 'Sobrancelhas', duration: 45, price: 5000, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's8', name: 'Buço na linha', category: 'Sobrancelhas', duration: 15, price: 1500, repeatPrice: null, firstSessionRule: false, active: true },
    { id: 's9', name: 'Hidra Gloss', category: 'Estética facial', duration: 60, price: 12000, repeatPrice: null, firstSessionRule: true, active: true }
  ];

  const GEOVANA = { id: 'p1', name: 'Geovana Amorim', role: 'Administradora', color: 'rose', phone: '', active: true,
    hours: { 1: ['09:00', '19:00'], 2: ['09:00', '19:00'], 3: ['09:00', '19:00'], 4: ['09:00', '19:00'], 5: ['09:00', '19:00'], 6: ['09:00', '15:00'], 0: null } };

  const DEMO_SLOT_TIMES = ['09:00', '11:00', '14:00', '16:00'];

  function seedData() {
    const services = SERVICE_SEED.map((s) => Object.assign({}, s));
    const professionals = [Object.assign({}, GEOVANA)];
    const data = { clients: [], services: services, professionals: professionals, appointments: [] };
    data.slots = seedSlots();
    return data;
  }

  // Apenas horários liberados para demonstração — nenhuma pessoa ou atendimento fictício.
  function seedSlots() {
    const out = [];
    let seq = 1;
    const now = Date.now();
    for (let off = 0; off <= 13; off++) {
      const day = new Date();
      day.setDate(day.getDate() + off);
      const hrs = GEOVANA.hours[day.getDay()];
      if (!hrs || !hrs[0]) continue;
      const iso = isoDate(day);
      DEMO_SLOT_TIMES.forEach((start) => {
        if (toMin(start) < toMin(hrs[0]) || toMin(start) + SLOT_WINDOW > toMin(hrs[1])) return;
        if (new Date(iso + 'T' + start + ':00').getTime() <= now) return;
        out.push({ id: 'v' + seq++, date: iso, start: start, duration: SLOT_WINDOW,
          professionalId: GEOVANA.id, status: 'livre', appointmentId: null,
          createdAt: new Date().toISOString() });
      });
    }
    return out;
  }

  // O preview embarcado roda em origem opaca: localStorage/sessionStorage/cookie
  // lançam SecurityError. Encadeamos fallbacks para os dados de teste sobreviverem.
  const WN_PREFIX = 'AB2|';
  const MEM = {};

  function wnRead() {
    try {
      const raw = window.name || '';
      if (raw.indexOf(WN_PREFIX) !== 0) return {};
      return JSON.parse(raw.slice(WN_PREFIX.length)) || {};
    } catch (e) { return {}; }
  }

  function storageGet(key) {
    const sources = [
      () => localStorage.getItem(key),
      () => sessionStorage.getItem(key),
      () => wnRead()[key] || null,
      () => MEM[key] || null
    ];
    for (const get of sources) {
      try { const v = get(); if (v) return v; } catch (e) { /* tenta o próximo */ }
    }
    return null;
  }

  function storageSet(key, value) {
    let label = 'Dados temporários nesta sessão';
    try { localStorage.setItem(key, value); label = 'Dados salvos no navegador'; } catch (e) { /* ignora */ }
    try {
      sessionStorage.setItem(key, value);
      if (label !== 'Dados salvos no navegador') label = 'Dados nesta aba';
    } catch (e) { /* ignora */ }
    try {
      const m = wnRead();
      m[key] = value;
      window.name = WN_PREFIX + JSON.stringify(m);
      if (label !== 'Dados salvos no navegador') label = 'Dados nesta aba (preview)';
    } catch (e) { /* ignora */ }
    MEM[key] = value;
    state.storageNote = label;
  }

  function storageDel(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignora */ }
    try { sessionStorage.removeItem(key); } catch (e) { /* ignora */ }
    try { const m = wnRead(); delete m[key]; window.name = WN_PREFIX + JSON.stringify(m); } catch (e) { /* ignora */ }
    delete MEM[key];
  }

  function persist() {
    if (state.mode !== 'demo') return;
    storageSet(LS_KEY, JSON.stringify({
      seededOn: state.seededOn,
      touched: state.touched,
      data: {
        clients: state.clients,
        services: state.services,
        professionals: state.professionals,
        appointments: state.appointments,
        slots: state.slots
      }
    }));
  }

  function hydrateDemo() {
    let saved = null;
    try { saved = JSON.parse(storageGet(LS_KEY) || 'null'); } catch (e) { saved = null; }
    const today = todayISO();
    if (saved && saved.data && Array.isArray(saved.data.professionals) && (saved.touched || saved.seededOn === today)) {
      Object.assign(state, saved.data);
      state.seededOn = saved.seededOn;
      state.touched = !!saved.touched;
      // Dados salvos por versões anteriores podem ter datas em outro formato.
      // Normalizamos na entrada para que nada renderize NaN/undefined.
      state.clients = Array.isArray(state.clients) ? state.clients : [];
      state.services = Array.isArray(state.services) ? state.services : [];
      state.professionals = state.professionals.filter((p) => p && p.id);
      state.appointments = (Array.isArray(state.appointments) ? state.appointments : [])
        .map(normAppt).filter((a) => a && isISO(a.date));
      state.slots = (Array.isArray(state.slots) ? state.slots : [])
        .map(normSlot).filter((s) => s && isISO(s.date) && s.start);
      if (!Array.isArray(saved.data.slots)) {
        state.slots = seedSlots();
        persist();
      }
      return;
    }
    const data = seedData();
    Object.assign(state, data);
    state.seededOn = today;
    state.touched = false;
    persist();
  }

  function touch() {
    state.touched = true;
    persist();
  }

  async function apiFetch(path, opts) {
    const o = opts || {};
    const headers = { 'content-type': 'application/json', accept: 'application/json' };
    if (state.authToken && state.authToken !== 'demo') headers.Authorization = 'Bearer ' + state.authToken;
    const res = await fetch(path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined
    });
    if (!res.ok) {
      let msg = 'Falha na API (' + res.status + ')';
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignora */ }
      if (res.status === 401) logout(true);
      throw new Error(msg);
    }
    return res.json();
  }

  async function publicFetch(path) {
    const res = await fetch(path, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('indisponível');
    return res.json();
  }

  function applyPublicData(data) {
    state.services = data.services || [];
    state.professionals = data.professionals || [];
    state.slots = (data.slots || []).map(normSlot).filter((s) => isISO(s.date) && s.start);
    state.clients = [];
    state.appointments = [];
    if (typeof data.needsSetup === 'boolean') state.needsSetup = data.needsSetup;
  }

  async function detectMode() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch('/api/public', { signal: ctrl.signal, headers: { accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || data.source !== 'amorim-beauty-neon' || !Array.isArray(data.services)) return;
      state.mode = 'neon';
      state.modeNote = 'Postgres na Vercel';
      applyPublicData(data);
    } catch (e) { /* segue no modo demonstração */ }
  }

  function restoreAuth() {
    try {
      const raw = storageGet(AUTH_KEY);
      if (!raw) return;
      const a = JSON.parse(raw);
      if (a && a.token) {
        state.authed = true;
        state.authToken = a.token;
        state.adminName = a.name || 'Administradora';
      }
    } catch (e) { /* sem sessão */ }
  }

  function saveAuth(token, name) {
    state.authed = true;
    state.authToken = token;
    state.adminName = name;
    storageSet(AUTH_KEY, JSON.stringify({ token: token, name: name }));
  }

  function logout(expired) {
    state.authed = false;
    state.authToken = '';
    state.loginError = expired ? 'Sua sessão expirou. Entre novamente.' : '';
    state.area = 'admin';
    storageDel(AUTH_KEY);
    if (state.mode === 'neon') applyPublicData({ services: state.services, professionals: state.professionals, slots: state.slots });
    renderAll();
  }

  async function loadAdminData() {
    const data = await apiFetch('/api/bootstrap');
    state.clients = Array.isArray(data.clients) ? data.clients : [];
    state.services = Array.isArray(data.services) ? data.services : [];
    state.professionals = Array.isArray(data.professionals) ? data.professionals : [];
    state.appointments = (Array.isArray(data.appointments) ? data.appointments : [])
      .map(normAppt).filter((a) => a && isISO(a.date));
    state.slots = (Array.isArray(data.slots) ? data.slots : [])
      .map(normSlot).filter((s) => s && isISO(s.date));
  }

  async function ensureClientData() {
    if (state.mode !== 'neon' || state.authed) return;
    try { applyPublicData(await publicFetch('/api/public')); } catch (e) { /* mantém o que já carregou */ }
  }

  async function submitLogin(email, password) {
    state.loginError = '';
    const btn = $('#loginSubmit');
    if (btn) btn.disabled = true;
    try {
      if (state.mode === 'neon') {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          if (res.status >= 500) throw new Error(j.error || 'O servidor de login não respondeu. Confira DATABASE_URL e AUTH_SECRET na Vercel.');
          throw new Error(j.error || 'E-mail ou senha incorretos.');
        }
        const data = await res.json();
        saveAuth(data.token, data.name || 'Administradora');
        await loadAdminData();
      } else {
        if (String(email).trim().toLowerCase() !== DEMO_ADMIN.email || String(password).trim() !== DEMO_ADMIN.password) {
          throw new Error('E-mail ou senha incorretos. Use o botão “Entrar com acesso de demonstração” abaixo.');
        }
        saveAuth('demo', DEMO_ADMIN.name);
      }
      state.area = 'admin';
      state.view = 'agenda';
      renderAll();
      toast('Bem-vinda, ' + state.adminName.split(' ')[0] + '!');
    } catch (err) {
      state.loginError = err && err.message ? err.message : 'Não foi possível entrar.';
      renderLogin();
      if (btn) btn.disabled = false;
    }
  }

  function renderLogin() {
    const demo = state.mode === 'demo';
    const setup = state.mode === 'neon' && state.needsSetup;
    $('#loginCard').classList.toggle('hidden', setup);
    $('#setupCard').classList.toggle('hidden', !setup);
    $('#loginDemoHint').classList.toggle('hidden', !demo);
    $('#loginDemoBtn').classList.toggle('hidden', !demo);
    if (demo) {
      $('#loginEmail').value = DEMO_ADMIN.email;
      $('#loginPassword').value = DEMO_ADMIN.password;
    }
    $('#loginError').textContent = state.loginError || '';
    $('#loginError').classList.toggle('hidden', !state.loginError);
    $('#setupError').textContent = state.setupError || '';
    $('#setupError').classList.toggle('hidden', !state.setupError);
    const btn = $('#loginSubmit');
    if (btn) btn.disabled = false;
    const sb = $('#setupSubmit');
    if (sb) sb.disabled = false;
  }

  async function submitSetup() {
    const p = $('#loginApp');
    const name = $('#setupName', p).value.trim();
    const email = $('#setupEmail', p).value.trim().toLowerCase();
    const pw = $('#setupPassword', p).value;
    const pw2 = $('#setupPassword2', p).value;
    const fail = (m) => {
      state.setupError = m;
      renderLogin();
      const b = $('#setupSubmit');
      if (b) b.disabled = false;
    };
    if (!name) return fail('Informe o nome da administradora.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Informe um e-mail válido.');
    if (pw.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.');
    if (pw !== pw2) return fail('As senhas não coincidem.');

    state.setupError = '';
    const btn = $('#setupSubmit');
    if (btn) btn.disabled = true;
    try {
      const headers = { 'content-type': 'application/json', accept: 'application/json' };
      const token = $('#setupToken', p).value.trim();
      if (token) headers['x-setup-token'] = token;
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name: name, email: email, password: pw })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Não foi possível criar a conta.');
      }
      state.needsSetup = false;
      state.setupError = '';
      $('#loginEmail').value = email;
      $('#loginPassword').value = '';
      $('#setupPassword', p).value = '';
      $('#setupPassword2', p).value = '';
      renderLogin();
      toast('Conta criada! Entre com seu e-mail e senha.');
    } catch (err) {
      fail(err && err.message ? err.message : 'Não foi possível criar a conta.');
    }
  }

  function clientById(id) { return state.clients.find((c) => c.id === id); }
  function serviceById(id) { return state.services.find((s) => s.id === id); }
  function profById(id) { return state.professionals.find((p) => p.id === id); }
  function clientName(a) { const c = clientById(a.clientId); return c ? c.name : 'Cliente'; }
  function serviceLabel(a) { const s = a.serviceName || (serviceById(a.serviceId) || {}).name; return s || 'Serviço removido'; }
  function profClass(color) { return 'pc-' + (color || 'rose'); }

  function activePros() { return state.professionals.filter((p) => p.active !== false); }
  function visiblePros() {
    const list = activePros();
    if (state.profFilter === 'all') return list;
    const one = list.find((p) => p.id === state.profFilter);
    return one ? [one] : list;
  }

  function appointmentsOn(iso) { return state.appointments.filter((a) => a.date === iso); }

  function occupancy(iso) {
    const pros = visiblePros();
    const day = fromISO(iso).getDay();
    let avail = 0;
    pros.forEach((p) => {
      const h = p.hours && p.hours[day];
      if (h && h[0] && h[1]) avail += toMin(h[1]) - toMin(h[0]);
    });
    const booked = appointmentsOn(iso).filter((a) => a.status !== 'cancelado').reduce((s, a) => s + Number(a.duration || 0), 0);
    return avail ? Math.min(100, Math.round((booked / avail) * 100)) : 0;
  }

  function weekOccupancy() {
    const start = weekStart(state.date);
    const end = addDays(start, 6);
    const pros = visiblePros();
    let avail = 0;
    for (let i = 0; i < 7; i++) {
      const dow = fromISO(addDays(start, i)).getDay();
      pros.forEach((p) => {
        const h = p.hours && p.hours[dow];
        if (h && h[0] && h[1]) avail += toMin(h[1]) - toMin(h[0]);
      });
    }
    const booked = state.appointments
      .filter((a) => a.status !== 'cancelado' && a.date >= start && a.date <= end)
      .reduce((s, a) => s + Number(a.duration || 0), 0);
    return avail ? Math.min(100, Math.round((booked / avail) * 100)) : 0;
  }

  function findConflict(profId, date, start, duration, ignoreId) {
    const s = toMin(start);
    const e = s + Number(duration);
    return state.appointments.find((a) => a.id !== ignoreId && a.professionalId === profId && a.date === date &&
      a.status !== 'cancelado' && s < toMin(a.start) + Number(a.duration) && e > toMin(a.start));
  }

  function slotById(id) { return state.slots.find((s) => s.id === id); }
  function upcomingSlots() {
    const t = todayISO();
    return state.slots.filter((s) => isISO(s.date) && normTime(s.start) && s.date >= t)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }
  function slotBookable(v) {
    return !findConflict(v.professionalId, v.date, v.start, 15, null);
  }
  function freeUpcomingSlots() { return upcomingSlots().filter((s) => s.status === 'livre' && slotBookable(s)); }
  function slotOverlap(profId, date, start, duration) {
    const s = toMin(start);
    const e = s + Number(duration);
    return state.slots.some((v) => v.date === date && v.professionalId === profId &&
      s < toMin(v.start) + Number(v.duration) && e > toMin(v.start));
  }
  function freeSlotLocal(appointmentId) {
    const v = state.slots.find((s) => s.appointmentId === appointmentId);
    if (v) { v.status = 'livre'; v.appointmentId = null; }
    return v;
  }
  function findClientByPhone(phone) {
    const digits = phoneDigits(phone);
    if (!digits) return null;
    return state.clients.find((c) => phoneDigits(c.phone) === digits);
  }
  function activeServices() { return state.services.filter((s) => s.active !== false); }
  function hasPreviousService(clientId, serviceId) {
    return state.appointments.some((a) => a.clientId === clientId && a.serviceId === serviceId && a.status !== 'cancelado');
  }
  function priceFor(service, clientId) {
    if (service.firstSessionRule && clientId && hasPreviousService(clientId, service.id)) {
      if (service.repeatPrice != null) return { cents: Number(service.repeatPrice), label: 'A partir da 2ª sessão' };
      return { cents: Number(service.price), label: 'Valor a confirmar' };
    }
    return { cents: Number(service.price), label: service.firstSessionRule ? '1ª sessão' : '' };
  }
  function repeatPending(service) {
    return !!service.firstSessionRule && service.repeatPrice == null;
  }

  function emptyState(title, text, actionLabel, action) {
    return '<div class="empty"><div class="empty-icon">' + ICON_CAL + '</div><strong>' + esc(title) + '</strong><p>' + esc(text) + '</p>' +
      (actionLabel ? '<button class="btn btn-secondary btn-sm" data-action="' + action + '">' + esc(actionLabel) + '</button>' : '') + '</div>';
  }

  function toast(message) {
    const root = $('#toastRoot');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = ICON_CHECK + '<span>' + esc(message) + '</span>';
    root.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toast-out 0.2s ease forwards';
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  function renderChrome() {
    const isClient = state.area === 'cliente';
    const showLogin = state.area === 'admin' && !state.authed;
    $('#app').classList.toggle('hidden', isClient || showLogin);
    $('#tabbar').classList.toggle('hidden', isClient || showLogin);
    $('#clientApp').classList.toggle('hidden', !isClient);
    $('#loginApp').classList.toggle('hidden', !showLogin);
    document.body.classList.toggle('is-client-area', isClient);
    if (showLogin) renderLogin();

    $('#userName').textContent = state.adminName;
    $('#userInitials').textContent = initials(state.adminName);

    const titles = { agenda: 'Agenda', disponibilidade: 'Disponibilidade', clientes: 'Clientes', servicos: 'Serviços', profissionais: 'Profissionais' };
    const primary = {
      agenda: ['new-appt', 'Novo agendamento'],
      disponibilidade: ['release-slots', 'Liberar horários'],
      clientes: ['new-client', 'Novo cliente'],
      servicos: ['new-service', 'Novo serviço'],
      profissionais: ['new-prof', 'Novo profissional']
    };

    $('#pageTitle').textContent = titles[state.view];
    $('#topEyebrow').textContent = 'Painel do salão · ' + shortToday();

    const btn = $('#btnPrimary');
    btn.dataset.action = primary[state.view][0];
    btn.querySelector('span').textContent = primary[state.view][1];
    btn.setAttribute('aria-label', primary[state.view][1]);

    $$('.nav-item').forEach((n) => n.classList.toggle('is-active', n.dataset.view === state.view));
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === state.view));

    const todayCount = appointmentsOn(todayISO()).filter((a) => a.status !== 'cancelado').length;
    $('#navAgendaCount').textContent = todayCount;
    $('#navSlotsCount').textContent = freeUpcomingSlots().length;
    $('#navClientsCount').textContent = state.clients.length;
    $('#navServicesCount').textContent = state.services.filter((s) => s.active !== false).length;
    $('#navProsCount').textContent = activePros().length;

    const neon = state.mode === 'neon';
    $('#modeCard').dataset.mode = neon ? 'neon' : 'demo';
    $('#modeTitle').textContent = neon ? 'Neon conectado' : 'Modo demonstração';
    $('#modeNote').textContent = neon ? state.modeNote : state.storageNote;
    $('#modeBadge').dataset.mode = neon ? 'neon' : 'demo';
    $('#modeBadgeText').textContent = neon ? 'Neon' : 'Demonstração';

    VIEWS.forEach((v) => {
      const sec = $('#view-' + v);
      if (sec) sec.classList.toggle('hidden', v !== state.view);
    });

    $('#publicLinkText').textContent = bookingLink() || 'Publique o app e abra a URL terminando em #cliente';

    const contact = activePros()[0];
    $('#clientContact').innerHTML = contact && contact.phone
      ? 'Precisa remarcar? <a href="' + waLink(contact.phone, 'Oi! Gostaria de falar sobre meu agendamento no Amorim Beauty.') + '" target="_blank" rel="noopener">Fale com a gente no WhatsApp</a>'
      : 'Precisa remarcar? Fale com a equipe do salão.';
  }

  function renderAgenda() {
    if (!isISO(state.date)) state.date = todayISO();
    const isWeek = state.calView === 'week';
    $('#agendaTitle').textContent = isWeek ? cap(weekLabel(state.date)) : cap(longDate(state.date));

    const pros = visiblePros();
    const list = appointmentsOn(state.date).filter((a) => a.status !== 'cancelado');

    if (isWeek) {
      let total = 0;
      for (let i = 0; i < 7; i++) total += appointmentsOn(addDays(weekStart(state.date), i)).filter((a) => a.status !== 'cancelado').length;
      $('#agendaSub').textContent = total + (total === 1 ? ' atendimento na semana' : ' atendimentos na semana');
    } else {
      $('#agendaSub').textContent = pros.length + (pros.length === 1 ? ' profissional · ' : ' profissionais · ') + list.length + (list.length === 1 ? ' atendimento' : ' atendimentos');
    }

    $$('.seg').forEach((s) => s.classList.toggle('is-active', s.dataset.id === state.calView));

    renderProfChips();
    if (isWeek) renderWeek(); else renderDay();
    renderRail();
  }

  function renderProfChips() {
    const list = activePros();
    if (state.profFilter !== 'all' && !list.some((p) => p.id === state.profFilter)) state.profFilter = 'all';
    const isWeek = state.calView === 'week';
    const start = weekStart(state.date);
    const end = addDays(start, 6);
    const countFor = (pred) => {
      if (!isWeek) return appointmentsOn(state.date).filter((a) => a.status !== 'cancelado' && pred(a)).length;
      return state.appointments.filter((a) => a.status !== 'cancelado' && a.date >= start && a.date <= end && pred(a)).length;
    };
    const total = countFor(() => true);
    let html = '<button class="chip' + (state.profFilter === 'all' ? ' is-active' : '') + '" data-action="filter-prof" data-id="all">Todas<span class="chip-count">' + total + '</span></button>';
    list.forEach((p) => {
      const n = countFor((a) => a.professionalId === p.id);
      html += '<button class="chip ' + profClass(p.color) + (state.profFilter === p.id ? ' is-active' : '') + '" data-action="filter-prof" data-id="' + p.id + '"><span class="dot"></span>' + esc(p.name.split(' ')[0]) + '<span class="chip-count">' + n + '</span></button>';
    });
    $('#profChips').innerHTML = html;
  }

  function apptBlock(a, prof) {
    const top = Math.max(0, toMin(a.start) - DAY_START);
    const maxH = (DAY_END - DAY_START) - top;
    const h = Math.max(14, Math.min(Number(a.duration) - 3, maxH - 2));
    const dur = Number(a.duration);
    const tiny = dur < 40;
    const compact = !tiny && dur < 56;
    const extra = (tiny || compact) ? '' :
      '<span class="appt-svc">' + esc(serviceLabel(a)) + '</span>' + (a.isFitIn ? '<span class="appt-tag">Encaixe</span>' : '');
    return '<button class="appt" data-action="edit-appt" data-id="' + a.id + '" data-status="' + a.status + '" data-tiny="' + tiny + '" style="top:' + top + 'px;height:' + h + 'px">' +
      '<span class="appt-time">' + a.start + '</span>' +
      '<span class="appt-name">' + esc(clientName(a)) + '</span>' +
      extra +
      '</button>';
  }

  function slotBlock(v) {
    const top = Math.max(0, toMin(v.start) - DAY_START);
    const maxH = (DAY_END - DAY_START) - top;
    const h = Math.max(14, Math.min(Number(v.duration) - 3, maxH - 2));
    const dur = Number(v.duration);
    const tiny = dur < 40;
    const compact = !tiny && dur < 56;
    return '<button class="appt-slot" data-action="open-slot" data-id="' + v.id + '" data-tiny="' + tiny + '" title="Vaga liberada para as clientes" style="top:' + top + 'px;height:' + h + 'px">' +
      '<span class="appt-time">' + v.start + '</span>' +
      '<span class="appt-name">Horário livre</span>' +
      ((tiny || compact) ? '' : '<span class="appt-svc">Qualquer serviço</span>') +
      '</button>';
  }

  function renderDay() {
    const pros = visiblePros();
    const board = $('#agendaBoard');

    if (!pros.length) {
      board.innerHTML = emptyState('Nenhuma profissional ativa', 'Ative ou cadastre uma profissional para montar a agenda.', 'Nova profissional', 'new-prof');
      return;
    }

    const hours = (DAY_END - DAY_START) / 60;
    let html = '<div class="cal" style="--cols:' + pros.length + ';--hours:' + hours + '">';

    html += '<div class="cal-head"><div class="cal-gutter"></div><div class="cal-heads">';
    pros.forEach((p) => {
      html += '<div class="cal-head-cell ' + profClass(p.color) + '"><span class="prof-dot">' + esc(initials(p.name)) + '</span>' +
        '<div class="cal-head-copy"><strong>' + esc(p.name) + '</strong><small>' + esc(p.role) + '</small></div></div>';
    });
    html += '</div></div>';

    html += '<div class="cal-body"><div class="cal-times">';
    for (let m = DAY_START; m <= DAY_END; m += 60) {
      html += '<span class="cal-time" style="top:' + (m - DAY_START) + 'px">' + fromMin(m) + '</span>';
    }
    html += '</div><div class="cal-cols">';
    pros.forEach((p) => {
      const items = appointmentsOn(state.date).filter((a) => a.professionalId === p.id).sort((x, y) => toMin(x.start) - toMin(y.start));
      const vagas = state.slots.filter((v) => v.professionalId === p.id && v.date === state.date && v.status === 'livre');
      html += '<div class="cal-col ' + profClass(p.color) + '" data-prof="' + p.id + '"><div class="slot-ghost"></div>';
      items.forEach((a) => { html += apptBlock(a, p); });
      vagas.forEach((v) => { html += slotBlock(v); });
      html += '</div>';
    });
    if (state.date === todayISO()) {
      const n = nowMin();
      if (n > DAY_START && n < DAY_END) html += '<div class="now-line" style="top:' + (n - DAY_START) + 'px"><span></span></div>';
    }
    html += '</div></div></div>';

    const list = appointmentsOn(state.date).slice().sort((x, y) => toMin(x.start) - toMin(y.start));
    html += '<div class="mobile-agenda">';
    if (!list.length) {
      html += emptyState('Dia livre', 'Nenhum atendimento marcado para esta data. Toque em novo agendamento para começar.', 'Novo agendamento', 'new-appt');
    } else {
      list.forEach((a) => {
        const p = profById(a.professionalId);
        html += '<button class="ma-item ' + profClass(p ? p.color : 'rose') + '" data-action="edit-appt" data-id="' + a.id + '" data-status="' + a.status + '">' +
          '<span class="ma-time">' + a.start + '</span><span class="ma-bar"></span>' +
          '<span class="ma-body"><strong>' + esc(clientName(a)) + '</strong><span>' + esc(serviceLabel(a)) + (p ? ' · ' + esc(p.name.split(' ')[0]) : '') + '</span></span>' +
          '<span class="status-dot" data-s="' + a.status + '"></span></button>';
      });
    }
    html += '</div>';

    board.innerHTML = html;

    $$('.cal-col', board).forEach((col) => {
      const ghost = col.querySelector('.slot-ghost');
      const snap = (e) => {
        const rect = col.getBoundingClientRect();
        let mins = DAY_START + Math.floor((e.clientY - rect.top) / 30) * 30;
        mins = Math.max(DAY_START, Math.min(mins, DAY_END - 30));
        return mins;
      };
      col.addEventListener('mousemove', (e) => {
        if (!ghost) return;
        const mins = snap(e);
        ghost.style.top = (mins - DAY_START) + 'px';
        ghost.textContent = '+ ' + fromMin(mins);
      });
      col.addEventListener('click', (e) => {
        if (e.target.closest('.appt') || e.target.closest('.appt-slot')) return;
        const mins = snap(e);
        openApptForm(null, { professionalId: col.dataset.prof, date: state.date, start: fromMin(mins) });
      });
    });
  }

  function renderWeek() {
    const start = weekStart(state.date);
    if (!start) { $('#agendaBoard').innerHTML = ''; return; }
    const pros = visiblePros();
    let html = '<div class="week">';
    for (let i = 0; i < 7; i++) {
      const iso = addDays(start, i);
      const d = fromISO(iso);
      const items = appointmentsOn(iso).filter((a) => pros.some((p) => p.id === a.professionalId)).sort((x, y) => toMin(x.start) - toMin(y.start));
      html += '<div class="week-day' + (iso === todayISO() ? ' is-today' : '') + '">' +
        '<button class="week-head" data-action="goto-day" data-date="' + iso + '"><span class="wd">' + WD_S[d.getDay()] + '</span><span class="wn">' + d.getDate() + '</span></button>' +
        '<div class="week-list">';
      if (!items.length) html += '<p class="week-empty">Livre</p>';
      items.forEach((a) => {
        const p = profById(a.professionalId);
        html += '<button class="wappt ' + profClass(p ? p.color : 'rose') + '" data-action="edit-appt" data-id="' + a.id + '" data-status="' + a.status + '">' +
          '<span class="wt">' + a.start + '</span><span class="wname">' + esc(clientName(a)) + '</span><span class="wsvc">' + esc(serviceLabel(a)) + '</span></button>';
      });
      html += '</div></div>';
    }
    html += '</div>';
    $('#agendaBoard').innerHTML = html;
  }

  function renderWeekRail() {
    const start = weekStart(state.date);
    const end = addDays(start, 6);
    const inWeek = (iso) => iso >= start && iso <= end;
    const appts = state.appointments.filter((a) => a.status !== 'cancelado' && inWeek(a.date));
    const revenue = appts.reduce((s, a) => s + Number(a.price || 0), 0);
    const occ = weekOccupancy();

    let html = '<div class="rail-card" data-od-id="week-summary-card">' +
      '<div class="rail-head"><h3>Resumo da semana</h3><span>' + shortDate(start) + ' – ' + shortDate(end) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Atendimentos</span><span class="stat-value">' + appts.length + '</span></div>' +
      '<div class="stat"><span class="stat-label">Receita prevista</span><span class="stat-value">' + brl(revenue) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Ocupação</span><span class="stat-value">' + occ + '<small>%</small></span></div>' +
      '<div class="progress"><span style="width:' + occ + '%"></span></div>' +
      '<p class="wk-caption">Atendimentos por dia</p><div class="wk-days">';

    const perDay = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDays(start, i);
      perDay.push({ iso: iso, n: appts.filter((a) => a.date === iso).length });
    }
    const max = Math.max(1, ...perDay.map((x) => x.n));
    perDay.forEach((x) => {
      const d = fromISO(x.iso);
      const pct = Math.round((x.n / max) * 100);
      html += '<div class="wk-row' + (x.iso === todayISO() ? ' is-today' : '') + '">' +
        '<span class="wk-label">' + WD_S[d.getDay()] + ' ' + d.getDate() + '</span>' +
        '<span class="wk-track"><i style="width:' + pct + '%"></i></span>' +
        '<span class="wk-n">' + x.n + '</span></div>';
    });
    html += '</div></div>';

    const agenda = appts.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 5);
    html += '<div class="rail-card" data-od-id="week-agenda-card"><div class="rail-head"><h3>Agenda da semana</h3><span>' + appts.length + (appts.length === 1 ? ' item' : ' itens') + '</span></div>';
    if (!agenda.length) {
      html += '<p class="rail-empty">Nenhum atendimento nesta semana.</p>';
    } else {
      html += '<div class="next-list">';
      agenda.forEach((a) => {
        const d = fromISO(a.date);
        const p = profById(a.professionalId);
        html += '<button class="next-item" data-action="edit-appt" data-id="' + a.id + '">' +
          '<span class="next-time">' + WD_S[d.getDay()] + ' ' + d.getDate() + '</span>' +
          '<span class="next-copy"><strong>' + esc(a.start) + ' · ' + esc(clientName(a)) + '</strong><small>' + esc(serviceLabel(a)) + (p ? ' · ' + esc(p.name.split(' ')[0]) : '') + '</small></span></button>';
      });
      html += '</div>';
      if (appts.length > agenda.length) html += '<p class="rail-empty">+ ' + (appts.length - agenda.length) + ' outros atendimentos na semana.</p>';
    }
    html += '</div>';

    const vagas = state.slots.filter((v) => v.status === 'livre' && inWeek(v.date));
    const dias = [];
    vagas.forEach((v) => { if (!dias.includes(v.date)) dias.push(v.date); });
    html += '<div class="rail-card" data-od-id="week-free-slots-card"><div class="rail-head"><h3>Horários liberados</h3><span>semana</span></div>' +
      '<div class="stat"><span class="stat-label">Vagas livres</span><span class="stat-value">' + vagas.length + '</span></div>' +
      '<div class="stat"><span class="stat-label">Dias com vagas</span><span class="stat-value">' + dias.length + '</span></div>';
    if (!vagas.length) html += '<p class="rail-empty">Nenhum horário liberado nesta semana. Libere em <strong>Disponibilidade</strong>.</p>';
    html += '</div>';

    $('#dayRail').innerHTML = html;
  }

  function renderRail() {
    if (state.calView === 'week') { renderWeekRail(); return; }
    const appts = appointmentsOn(state.date).filter((a) => a.status !== 'cancelado');
    const revenue = appts.reduce((s, a) => s + Number(a.price || 0), 0);
    const occ = occupancy(state.date);
    const isToday = state.date === todayISO();

    let next = appts.slice().sort((a, b) => toMin(a.start) - toMin(b.start));
    if (isToday) next = next.filter((a) => toMin(a.start) >= nowMin());
    next = next.slice(0, 3);

    let html = '<div class="rail-card" data-od-id="summary-card">' +
      '<div class="rail-head"><h3>Resumo do dia</h3><span>' + shortDate(state.date) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Atendimentos</span><span class="stat-value">' + appts.length + '</span></div>' +
      '<div class="stat"><span class="stat-label">Receita prevista</span><span class="stat-value">' + brl(revenue) + '</span></div>' +
      '<div class="stat"><span class="stat-label">Ocupação</span><span class="stat-value">' + occ + '<small>%</small></span></div>' +
      '<div class="progress"><span style="width:' + occ + '%"></span></div>' +
      '</div>';

    html += '<div class="rail-card" data-od-id="next-card"><div class="rail-head"><h3>' + (isToday ? 'Próximos' : 'Agenda do dia') + '</h3></div>';
    if (!next.length) {
      html += '<p class="rail-empty">' + (isToday ? 'Nenhum atendimento restante hoje.' : 'Nenhum atendimento nesta data.') + '</p>';
    } else {
      html += '<div class="next-list">';
      next.forEach((a) => {
        const p = profById(a.professionalId);
        html += '<button class="next-item" data-action="edit-appt" data-id="' + a.id + '"><span class="next-time">' + a.start + '</span>' +
          '<span class="next-copy"><strong>' + esc(clientName(a)) + '</strong><small>' + esc(serviceLabel(a)) + (p ? ' · ' + esc(p.name.split(' ')[0]) : '') + '</small></span></button>';
      });
      html += '</div>';
    }
    html += '</div>';

    const vagas = state.slots.filter((v) => v.date === state.date && v.status === 'livre')
      .sort((a, b) => toMin(a.start) - toMin(b.start));
    html += '<div class="rail-card" data-od-id="free-slots-card"><div class="rail-head"><h3>Horários liberados</h3><span>' + shortDate(state.date) + '</span></div>';
    if (!vagas.length) {
      html += '<p class="rail-empty">Nenhum horário liberado para as clientes neste dia. Libere em <strong>Disponibilidade</strong>.</p>';
    } else {
      html += '<div class="bd-list">';
      vagas.slice(0, 4).forEach((v) => {
        const prof = profById(v.professionalId);
        html += '<div class="bd-item"><span class="bd-day">' + esc(v.start.slice(0, 2)) + '</span><span class="bd-copy"><strong>Qualquer serviço</strong><small>' + esc(v.start) + ' · ' + esc(prof ? prof.name.split(' ')[0] : '—') + ' · aguardando reserva</small></span></div>';
      });
      if (vagas.length > 4) html += '<p class="rail-empty">+ ' + (vagas.length - 4) + ' outros horários livres.</p>';
      html += '</div>';
    }
    html += '</div>';

    $('#dayRail').innerHTML = html;
  }

  function clientStats() {
    const out = {};
    const now = new Date();
    const nowKey = isoDate(now) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    state.appointments.forEach((a) => {
      const s = out[a.clientId] || (out[a.clientId] = { visits: 0, spent: 0, last: null, next: null, lastKey: '', nextKey: '' });
      if (a.status === 'concluido') { s.visits++; s.spent += Number(a.price || 0); }
      if (a.status !== 'cancelado') {
        const key = a.date + 'T' + a.start;
        if (key <= nowKey && key > s.lastKey) { s.last = a.date; s.lastKey = key; }
        if (key > nowKey && (!s.nextKey || key < s.nextKey)) { s.next = a.date; s.nextKey = key; }
      }
    });
    return out;
  }

  function renderClients() {
    const q = state.clientQuery.trim().toLowerCase();
    const list = state.clients
      .filter((c) => !q || [c.name, c.phone, c.email].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));

    $('#clientCount').textContent = list.length + (list.length === 1 ? ' cliente' : ' clientes');

    const stats = clientStats();
    const body = $('#clientsBody');
    const cards = $('#clientsCards');

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty" style="border:0;padding:40px 20px"><strong>Nada encontrado</strong><p>Nenhum cliente corresponde a “' + esc(state.clientQuery) + '”.</p></div></td></tr>';
      cards.innerHTML = emptyState('Nada encontrado', 'Nenhum cliente corresponde à busca.', 'Novo cliente', 'new-client');
      return;
    }

    let rows = '';
    let cardHtml = '';
    list.forEach((c) => {
      const s = stats[c.id] || { visits: 0, spent: 0, last: null, next: null };
      rows += '<tr data-action="client-detail" data-id="' + c.id + '">' +
        '<td><div class="cell-person"><span class="avatar">' + esc(initials(c.name)) + '</span><div><strong>' + esc(c.name) + '</strong><small>' + esc(c.email || '—') + '</small></div></div></td>' +
        '<td><span class="cell-muted">' + esc(c.phone || '—') + '</span></td>' +
        '<td><span class="cell-muted">' + shortDate(s.last) + '</span></td>' +
        '<td><span class="cell-muted">' + shortDate(s.next) + '</span></td>' +
        '<td class="ta-right"><span class="cell-money">' + brl(s.spent) + '</span></td>' +
        '<td class="cell-actions"><button class="row-btn" data-action="edit-client" data-id="' + c.id + '" aria-label="Editar ' + esc(c.name) + '">' + ICON_EDIT + '</button></td>' +
        '</tr>';

      cardHtml += '<div class="client-card" data-action="client-detail" data-id="' + c.id + '">' +
        '<span class="avatar">' + esc(initials(c.name)) + '</span>' +
        '<div class="client-card-body"><strong>' + esc(c.name) + '</strong><small>' + esc(c.phone || 'sem telefone') + ' · ' + (s.visits || 0) + (s.visits === 1 ? ' visita' : ' visitas') + '</small></div>' +
        '<span class="cell-muted">' + shortDate(s.next) + '</span></div>';
    });

    body.innerHTML = rows;
    cards.innerHTML = cardHtml;
  }

  function renderServices() {
    const present = [];
    state.services.forEach((s) => { if (!present.includes(s.category)) present.push(s.category); });
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c)).concat(present.filter((c) => !CATEGORY_ORDER.includes(c)));

    if (state.serviceFilter !== 'all' && !present.includes(state.serviceFilter)) state.serviceFilter = 'all';

    let chips = '<button class="chip' + (state.serviceFilter === 'all' ? ' is-active' : '') + '" data-action="filter-service" data-id="all">Todos</button>';
    ordered.forEach((cat) => {
      chips += '<button class="chip' + (state.serviceFilter === cat ? ' is-active' : '') + '" data-action="filter-service" data-id="' + esc(cat) + '">' + esc(cat) + '</button>';
    });
    $('#serviceChips').innerHTML = chips;

    const active = state.services.filter((s) => s.active !== false).length;
    $('#serviceCount').textContent = active + (active === 1 ? ' serviço ativo' : ' serviços ativos');

    const pending = state.services.filter((s) => s.active !== false && repeatPending(s));
    let banner = '';
    if (pending.length) {
      banner = '<div class="price-alert" data-od-id="repeat-price-alert">' + ICON_ALERT +
        '<div><strong>Defina o valor das sessões seguintes</strong><p>' +
        pending.map((s) => esc(s.name) + ' custa ' + brl(s.price) + ' só na 1ª sessão. A partir da 2ª sessão o valor diminui: abra o serviço e preencha “Valor a partir da 2ª sessão”. Enquanto o campo estiver vazio, nenhum desconto é aplicado — o sistema não inventa um número.').join(' ') +
        '</p></div></div>';
    }

    const cats = state.serviceFilter === 'all' ? ordered : [state.serviceFilter];
    let sections = '';
    cats.forEach((cat) => {
      const items = state.services.filter((s) => s.category === cat);
      if (!items.length) return;
      sections += '<section class="svc-section" data-od-id="service-category-' + esc(cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '">' +
        '<div class="svc-head"><h3>' + esc(cat) + '</h3><span>' + items.length + (items.length === 1 ? ' serviço' : ' serviços') + '</span></div><div class="svc-grid">';
      items.forEach((s) => {
        const rule = s.firstSessionRule
          ? '<p class="svc-rule">1ª sessão ' + brl(s.price) + (s.repeatPrice != null ? ' · seguintes ' + brl(s.repeatPrice) : ' · seguintes a definir') + '</p>'
          : '';
        sections += '<article class="svc-card' + (s.active === false ? ' is-inactive' : '') + '" data-od-id="service-' + s.id + '">' +
          '<div class="svc-top"><span class="svc-cat">' + esc(s.category) + '</span>' + (s.active === false ? '<span class="badge-inactive">Inativo</span>' : '') + '</div>' +
          '<h4>' + esc(s.name) + '</h4>' +
          rule +
          '<div class="svc-meta"><span class="svc-duration">' + s.duration + ' min</span><span class="svc-price">' + brl(s.price) + '</span></div>' +
          '<div class="svc-actions"><button class="link-btn" data-action="edit-service" data-id="' + s.id + '">Editar</button>' +
          '<button class="link-btn" data-action="toggle-service" data-id="' + s.id + '">' + (s.active === false ? 'Ativar' : 'Desativar') + '</button></div>' +
          '</article>';
      });
      sections += '</div></section>';
    });

    if (!sections) sections = emptyState('Nenhum serviço', 'Cadastre o primeiro procedimento do salão com duração e preço.', 'Novo serviço', 'new-service');
    $('#servicesGrid').innerHTML = banner + sections;
  }

  function hoursSummary(p) {
    const groups = {};
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      const h = p.hours && p.hours[d];
      if (!h || !h[0]) return;
      const key = h[0] + '–' + h[1];
      (groups[key] || (groups[key] = [])).push(WD_S[d]);
    });
    const parts = Object.keys(groups).map((k) => groups[k].join(', ') + ' · ' + k);
    return parts.length ? parts.join('; ') : 'Sem horário definido';
  }

  function renderProfessionals() {
    const list = state.professionals.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    $('#prosCount').textContent = activePros().length + (activePros().length === 1 ? ' profissional' : ' profissionais');

    if (!list.length) {
      $('#prosGrid').innerHTML = emptyState('Nenhuma profissional', 'Cadastre quem atende no salão e defina os horários de trabalho.', 'Nova profissional', 'new-prof');
      return;
    }

    let html = '';
    list.forEach((p) => {
      const count = state.appointments.filter((a) => a.professionalId === p.id).length;
      html += '<article class="prof-card ' + profClass(p.color) + '" data-od-id="professional-' + p.id + '">' +
        '<div class="prof-top"><span class="prof-avatar">' + esc(initials(p.name)) + '</span>' +
        '<div class="prof-id"><h4>' + esc(p.name) + '</h4><small>' + esc(p.role) + '</small></div>' +
        (p.active === false ? '<span class="badge-inactive">Inativa</span>' : '') + '</div>' +
        '<div class="prof-info"><div><strong>Telefone</strong><span>' + esc(p.phone || '—') + '</span></div>' +
        '<div><strong>Horários</strong><span>' + esc(hoursSummary(p)) + '</span></div>' +
        '<div><strong>Histórico</strong><span>' + count + (count === 1 ? ' atendimento registrado' : ' atendimentos registrados') + '</span></div></div>' +
        '<div class="prof-foot"><span class="prof-hours">' + (p.active === false ? 'Fora da agenda' : 'Disponível na agenda') + '</span>' +
        '<div><button class="link-btn" data-action="edit-prof" data-id="' + p.id + '">Editar</button>' +
        '<button class="link-btn" data-action="toggle-prof" data-id="' + p.id + '">' + (p.active === false ? 'Ativar' : 'Desativar') + '</button></div></div>' +
        '</article>';
    });
    $('#prosGrid').innerHTML = html;
  }

  function renderDisponibilidade() {
    const up = upcomingSlots();
    const free = up.filter((s) => s.status === 'livre').length;
    const booked = up.length - free;
    $('#dispCount').textContent = up.length + (up.length === 1 ? ' vaga futura' : ' vagas futuras');

    $('#dispSummary').innerHTML =
      '<div class="disp-stat"><small>Vagas liberadas</small><strong>' + up.length + '</strong><span class="hint">Nos próximos dias</span></div>' +
      '<div class="disp-stat is-free"><small>Livres para agendar</small><strong>' + free + '</strong><span class="hint">Visíveis para as clientes</span></div>' +
      '<div class="disp-stat is-booked"><small>Já reservadas</small><strong>' + booked + '</strong><span class="hint">Viraram agendamento</span></div>';

    if (!up.length) {
      $('#dispBody').innerHTML = emptyState('Nenhum horário liberado', 'Libere os dias e horários para que as clientes possam agendar. Nada aparece para elas até você liberar.', 'Liberar horários', 'release-slots');
      return;
    }

    const groups = {};
    up.forEach((s) => { (groups[s.date] || (groups[s.date] = [])).push(s); });
    let html = '';
    Object.keys(groups).sort().forEach((date) => {
      const list = groups[date].slice().sort((a, b) => toMin(a.start) - toMin(b.start));
      const livreN = list.filter((s) => s.status === 'livre').length;
      html += '<section class="disp-day" data-od-id="availability-day-' + date + '">' +
        '<div class="disp-day-head"><h3>' + esc(cap(longDate(date))) + '</h3><span>' + livreN + (livreN === 1 ? ' livre' : ' livres') + ' · ' + list.length + (list.length === 1 ? ' vaga' : ' vagas') + '</span></div>' +
        '<div class="slot-list">';
      list.forEach((v) => {
        const prof = profById(v.professionalId);
        const appt = v.appointmentId ? state.appointments.find((a) => a.id === v.appointmentId) : null;
        const reserved = v.status === 'reservado';
        html += '<div class="slot-row' + (reserved ? ' is-booked' : '') + '" data-od-id="slot-' + v.id + '">' +
          '<span class="slot-time">' + esc(v.start) + '</span>' +
          '<span class="slot-info"><strong>' + (reserved && appt ? esc(serviceLabel(appt)) : 'Qualquer serviço') + '</strong><small>' + esc(prof ? prof.name : 'Equipe') + ' · ' + (reserved && appt ? appt.duration + ' min' : 'aceita qualquer serviço') + '</small></span>' +
          '<span class="slot-state" data-state="' + v.status + '">' + (reserved ? 'Reservada · ' + esc(appt ? clientName(appt).split(' ')[0] : 'cliente') : 'Livre') + '</span>' +
          (reserved ? '<span></span>' : '<button class="row-btn" data-action="remove-slot" data-id="' + v.id + '" aria-label="Remover vaga">' + ICON_X + '</button>') +
          '</div>';
      });
      html += '</div></section>';
    });
    $('#dispBody').innerHTML = html;
  }

  function clientSteps(active) {
    const labels = ['Horário', 'Serviço', 'Seus dados', 'Confirmado'];
    let html = '<div class="booking-steps" aria-label="Etapas do agendamento">';
    labels.forEach((l, i) => {
      const n = i + 1;
      const cls = n === active ? 'is-current' : (n < active ? 'is-done' : '');
      html += '<span class="book-step ' + cls + '"><b>' + n + '</b>' + esc(l) + '</span>';
      if (n < 4) html += '<span class="book-step-sep" aria-hidden="true"></span>';
    });
    return html + '</div>';
  }

  function renderClient() {
    $$('.ctab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === state.clientTab));
    if (state.clientTab === 'consultar') renderLookup(); else renderClientBody();
  }

  function lookupAppointments(phone) {
    const digits = phoneDigits(phone);
    if (!digits) return [];
    const ids = state.clients.filter((c) => phoneDigits(c.phone) === digits).map((c) => c.id);
    return state.appointments.filter((a) => ids.indexOf(a.clientId) >= 0);
  }

  async function doLookup(phone) {
    state.lookupPhone = phone;
    const digits = phoneDigits(phone);
    if (digits.length < 10) {
      state.lookupError = 'Informe o telefone com DDD, o mesmo usado no agendamento.';
      state.lookupResult = null;
      renderLookup();
      return;
    }
    state.lookupError = '';
    try {
      if (state.mode === 'neon') {
        const res = await publicFetch('/api/lookup?phone=' + encodeURIComponent(digits));
        state.lookupResult = { phone: phone, name: res.name || '', appointments: (res.appointments || []).map(normAppt) };
      } else {
        const c = state.clients.find((x) => phoneDigits(x.phone) === digits);
        state.lookupResult = { phone: phone, name: c ? c.name : '', appointments: lookupAppointments(digits) };
      }
    } catch (e) {
      state.lookupError = 'Não foi possível consultar agora. Tente novamente.';
      state.lookupResult = null;
    }
    renderLookup();
  }

  function lookupItem(a) {
    const prof = profById(a.professionalId);
    return '<div class="lookup-item" data-od-id="lookup-appt-' + a.id + '">' +
      '<div class="lookup-when"><strong>' + esc(shortDate(a.date)) + '</strong><span>' + esc(a.start) + '</span></div>' +
      '<div class="lookup-info"><strong>' + esc(serviceLabel(a)) + '</strong><small>' + esc(cap(longDate(a.date))) + ' · ' + esc(prof ? prof.name : 'Amorim Beauty') + ' · ' + a.duration + ' min · ' + brl(a.price) + '</small></div>' +
      '<span class="status-pill" data-status="' + a.status + '">' + STATUS[a.status] + '</span>' +
      '</div>';
  }

  function renderLookup() {
    const root = $('#clientBody');
    const r = state.lookupResult;
    let results = '';
    if (r) {
      if (!r.appointments.length) {
        results = emptyState('Nenhum agendamento encontrado', 'Não achamos horários para ' + r.phone + '. Confira o número ou faça uma nova reserva.', '', '');
      } else {
        const now = new Date();
        const nowKey = isoDate(now) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        const all = r.appointments.slice();
        const proximos = all.filter((a) => (a.date + 'T' + a.start) >= nowKey && a.status !== 'cancelado')
          .sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
        const outros = all.filter((a) => proximos.indexOf(a) < 0)
          .sort((x, y) => (y.date + y.start).localeCompare(x.date + x.start));
        if (proximos.length) {
          results += '<span class="book-label">Próximos horários · ' + proximos.length + '</span><div class="lookup-list">' + proximos.map(lookupItem).join('') + '</div>';
        }
        if (outros.length) {
          results += '<span class="book-label" style="margin-top:16px">Histórico e cancelados · ' + outros.length + '</span><div class="lookup-list">' + outros.map(lookupItem).join('') + '</div>';
        }
      }
    }

    root.innerHTML = '<div class="booking-panel" data-od-id="lookup-panel">' +
      '<div class="booking-panel-head"><h2>Meus horários</h2><p>Consulte seus agendamentos só com o telefone — sem login.</p></div>' +
      (r && r.name ? '<p class="lookup-hello">Olá, <strong>' + esc(r.name.split(' ')[0]) + '</strong>! Encontramos seus horários.</p>' : '') +
      '<form id="lookupForm" class="lookup-form" novalidate>' +
        '<div class="field"><label for="lookupPhone">Telefone usado no agendamento</label>' +
        '<input id="lookupPhone" type="tel" class="input" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-0000" value="' + esc(state.lookupPhone) + '"></div>' +
        '<p class="field-error' + (state.lookupError ? ' show' : '') + '" data-for="phone">' + esc(state.lookupError || 'Informe o telefone com DDD.') + '</p>' +
        '<button type="button" data-action="submit-form" data-form="lookupForm" class="btn btn-primary" data-od-id="lookup-submit">Buscar meus horários</button>' +
      '</form>' +
      (results ? '<div class="lookup-results">' + results + '</div>' : '') +
      '<div class="book-actions"><button class="btn btn-secondary" data-action="client-tab" data-tab="agendar">Fazer uma nova reserva</button></div>' +
      '<p class="book-note">Mostramos apenas os agendamentos ligados a este número de telefone.</p>' +
      '</div>';
  }

  function chosenSlot() { return booking.slotId ? slotById(booking.slotId) : null; }
  function chosenService() { return booking.serviceId ? serviceById(booking.serviceId) : null; }

  function bookingSlotSummary(v, detail) {
    return '<div class="book-summary">' +
      '<span class="book-summary-time">' + esc(v.start) + '</span>' +
      '<span class="book-summary-copy"><strong>' + esc(cap(longDate(v.date))) + '</strong><small>' + esc(detail || '') + '</small></span>' +
      '</div>';
  }

  function renderClientBody() {
    const root = $('#clientBody');
    const free = freeUpcomingSlots();

    if (booking.step === 'ok' && booking.confirmed) {
      const c = booking.confirmed;
      root.innerHTML = clientSteps(4) + '<div class="booking-panel"><div class="book-success" data-od-id="booking-success">' +
        '<div class="book-success-icon">' + ICON_CHECK + '</div>' +
        '<h2>Tudo certo, ' + esc(String(c.clientName).split(' ')[0]) + '!</h2>' +
        '<p>Seu horário está reservado. A equipe do Amorim Beauty entra em contato pelo telefone informado para confirmar.</p>' +
        '<div class="book-receipt">' +
          '<div><small>Serviço</small><strong>' + esc(c.serviceName) + '</strong></div>' +
          '<div><small>Data</small><strong>' + esc(cap(longDate(c.date))) + '</strong></div>' +
          '<div><small>Horário</small><strong>' + esc(c.start) + ' · ' + c.duration + ' min</strong></div>' +
          '<div><small>Profissional</small><strong>' + esc(c.profName) + '</strong></div>' +
          '<div><small>Valor</small><strong>' + brl(c.price) + (c.priceLabel ? ' <small>' + esc(c.priceLabel) + '</small>' : '') + '</strong></div>' +
        '</div>' +
        '<div class="book-actions book-success-actions">' +
          '<button class="btn btn-primary" data-action="book-reset" data-od-id="book-another">Agendar outro horário</button>' +
          '<button class="btn btn-secondary" data-action="lookup-mine" data-phone="' + esc(c.phone || '') + '" data-od-id="lookup-after-booking">Consultar meus horários</button>' +
        '</div>' +
        '</div></div>';
      return;
    }

    if (!free.length) {
      root.innerHTML = clientSteps(1) + '<div class="booking-panel">' +
        emptyState('Ainda não há horários liberados', 'A equipe do Amorim Beauty está preparando a agenda. Volte em instantes para escolher seu horário.', '', '') +
        '</div>';
      return;
    }

    const v = chosenSlot();
    if (booking.step !== 'browse' && (!v || v.status !== 'livre' || !slotBookable(v))) {
      booking.step = 'browse';
      booking.slotId = null;
      booking.serviceId = null;
      booking.error = 'Esse horário não está mais disponível. Escolha outro.';
      renderClientBody();
      return;
    }

    if (booking.step === 'servico') {
      const prof = profById(v.professionalId);
      const services = activeServices();
      let cards = '';
      services.forEach((s) => {
        const q = priceFor(s, null);
        const rule = s.firstSessionRule
          ? '<p class="pick-rule">1ª sessão ' + brl(s.price) + (s.repeatPrice != null ? ' · a partir da 2ª ' + brl(s.repeatPrice) : ' · valor das seguintes a definir') + '</p>'
          : '';
        cards += '<article class="pick-card" data-od-id="pick-service-' + s.id + '">' +
          '<h4>' + esc(s.name) + '</h4>' +
          '<p class="pick-meta">' + s.duration + ' min · ' + esc(s.category) + '</p>' +
          rule +
          '<div class="pick-foot"><span class="pick-price">' + brl(q.cents) + '</span>' +
          '<button class="btn btn-secondary" data-action="pick-service" data-id="' + s.id + '">Escolher</button></div>' +
          '</article>';
      });
      root.innerHTML = clientSteps(2) +
        '<div class="booking-panel" data-od-id="booking-service">' +
          '<div class="booking-panel-head"><h2>Qual serviço você quer?</h2><p>Qualquer serviço cabe em qualquer horário liberado.</p></div>' +
          bookingSlotSummary(v, 'com ' + (prof ? prof.name : 'Amorim Beauty')) +
          '<span class="book-label">Escolha o procedimento</span>' +
          (cards ? '<div class="pick-grid">' + cards + '</div>' : '<p class="rail-empty">Nenhum serviço ativo no catálogo.</p>') +
          '<div class="book-actions"><button class="btn btn-secondary" data-action="book-back-slot">Trocar horário</button></div>' +
        '</div>';
      return;
    }

    if (booking.step === 'dados') {
      const s = chosenService();
      if (!s) { booking.step = 'servico'; booking.serviceId = null; renderClientBody(); return; }
      const q = priceFor(s, null);
      root.innerHTML = clientSteps(3) +
        '<div class="booking-panel" data-od-id="booking-details">' +
          '<div class="booking-panel-head"><h2>Seus dados</h2><p>Falta pouco para garantir o horário.</p></div>' +
          '<div class="book-summary">' +
            '<span class="book-summary-time">' + esc(v.start) + '</span>' +
            '<span class="book-summary-copy"><strong>' + esc(s.name) + '</strong><small>' + esc(cap(longDate(v.date))) + ' · ' + s.duration + ' min</small></span>' +
            '<span class="book-summary-price">' + brl(q.cents) + '</span>' +
          '</div>' +
          (s.firstSessionRule ? '<p class="pick-rule" style="margin:0 0 14px">1ª sessão ' + brl(s.price) + (s.repeatPrice != null ? ' · a partir da 2ª sessão ' + brl(s.repeatPrice) : ' · valor das sessões seguintes a confirmar') + '</p>' : '') +
          '<form id="bookForm" class="book-form" novalidate><div class="form-grid">' +
            '<div class="field span-2"><label for="b-name">Nome completo</label><input id="b-name" class="input" value="' + esc(booking.draft.name) + '" placeholder="Como podemos te chamar?" autocomplete="name"><p class="field-error" data-for="name">Informe seu nome.</p></div>' +
            '<div class="field span-2"><label for="b-phone">Telefone / WhatsApp</label><input id="b-phone" class="input" value="' + esc(booking.draft.phone) + '" placeholder="(11) 99999-0000" inputmode="tel" autocomplete="tel"><p class="field-error" data-for="phone">Informe um telefone para confirmação.</p></div>' +
          '</div>' +
          (booking.error ? '<p class="field-error show" style="margin-top:12px">' + esc(booking.error) + '</p>' : '') +
          '<div class="book-actions">' +
            '<button type="button" class="btn btn-secondary" data-action="book-back-service">Trocar serviço</button>' +
            '<button type="button" data-action="submit-form" data-form="bookForm" class="btn btn-primary" data-od-id="confirm-booking">Confirmar agendamento</button>' +
          '</div>' +
          '<p class="book-note">Para reservar, basta nome e telefone — sem login. Ao confirmar, a vaga sai da lista e vira um agendamento na agenda.</p>' +
          '</form>' +
        '</div>';
      return;
    }

    const dates = [];
    free.forEach((x) => { if (isISO(x.date) && !dates.includes(x.date)) dates.push(x.date); });
    dates.sort();
    if (!dates.length) booking.date = null;
    else if (!dates.includes(booking.date)) booking.date = dates[0];
    const chosen = dates.length ? free.filter((x) => x.date === booking.date).slice().sort((a, b) => toMin(a.start) - toMin(b.start)) : [];

    let strip = '';
    dates.forEach((date) => {
      const d = fromISO(date);
      if (isNaN(d.getTime())) return;
      const n = free.filter((x) => x.date === date).length;
      strip += '<button class="date-pill' + (booking.date === date ? ' is-active' : '') + '" data-action="book-date" data-date="' + date + '">' +
        '<span class="dp-wd">' + WD_S[d.getDay()] + '</span><span class="dp-day">' + d.getDate() + '</span>' +
        '<span class="dp-count">' + n + (n === 1 ? ' horário' : ' horários') + '</span></button>';
    });

    let cards = '';
    chosen.forEach((x) => {
      const prof = profById(x.professionalId);
      cards += '<article class="slot-card" data-od-id="book-slot-' + x.id + '">' +
        '<div class="slot-card-time">' + esc(x.start) + '</div>' +
        '<div class="slot-card-svc">Qualquer serviço</div>' +
        '<div class="slot-card-meta">' + esc(prof ? prof.name : 'Amorim Beauty') + ' · escolha o procedimento na próxima etapa</div>' +
        '<div class="slot-card-foot"><span class="slot-card-free">Horário livre</span>' +
        '<button class="btn btn-secondary" data-action="pick-slot" data-id="' + x.id + '">Escolher</button></div>' +
        '</article>';
    });

    root.innerHTML = clientSteps(1) +
      '<div class="booking-panel" data-od-id="booking-browse">' +
        '<div class="booking-panel-head"><h2>Horários disponíveis</h2><p>' + esc(cap(longDate(booking.date))) + '</p></div>' +
        '<span class="book-label">1 · Escolha o dia</span>' +
        '<div class="date-strip">' + strip + '</div>' +
        '<span class="book-label" style="margin-top:14px">2 · Clique em “Escolher” no horário que preferir</span>' +
        (cards ? '<div class="slot-grid">' + cards + '</div>' : '<p class="rail-empty">Nenhum horário livre nesta data.</p>') +
        '<p class="book-note">Qualquer serviço do catálogo pode ser agendado em qualquer horário disponível.</p>' +
      '</div>';
  }

  function openReleasePanel() {
    const pros = activePros();
    if (!pros.length) { toast('Cadastre uma profissional antes de liberar horários.'); return; }

    const today = todayISO();
    const until = addDays(today, 13);

    let dayHtml = '';
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      const on = d !== 0;
      dayHtml += '<label class="weekday-pick' + (on ? ' is-on' : '') + '"><input type="checkbox" data-weekday="' + d + '"' + (on ? ' checked' : '') + '><span>' + WD_S[d] + '</span></label>';
    });

    const body = '<form id="releaseForm" novalidate><div class="form-grid">' +
      '<div class="field"><label for="r-from">Liberar de</label><input id="r-from" type="date" class="input" value="' + today + '"></div>' +
      '<div class="field"><label for="r-to">Até</label><input id="r-to" type="date" class="input" value="' + until + '"></div>' +
      '<div class="field span-2"><span class="field-label">Dias da semana</span><div class="weekday-picks">' + dayHtml + '</div></div>' +
      '<div class="field span-2"><label for="r-prof">Profissional</label><select id="r-prof" class="select">' + pros.map((p) => '<option value="' + p.id + '">' + esc(p.name) + ' · ' + esc(p.role) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="r-start">Primeiro horário</label><input id="r-start" type="time" class="input" step="900" value="09:00"></div>' +
      '<div class="field"><label for="r-end">Último horário possível</label><input id="r-end" type="time" class="input" step="900" value="18:00"></div>' +
      '<div class="field span-2"><label for="r-step">Intervalo entre vagas</label><select id="r-step" class="select"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>60 min</option><option value="90">90 min</option></select></div>' +
      '</div>' +
      '<div class="release-preview" id="releasePreview"></div>' +
      '<p class="hint" style="margin-top:10px">Cada vaga aceita qualquer serviço do catálogo. O expediente da profissional é respeitado; vagas já liberadas, horários ocupados e datas passadas são ignorados.</p>' +
      '</form>';

    const footer = '<div class="spacer"></div><button type="button" class="btn btn-ghost" data-action="close-panel">Cancelar</button>' +
      '<button type="button" data-action="submit-form" data-form="releaseForm" class="btn btn-primary">Liberar horários</button>';

    openPanel({ title: 'Liberar dias e horários', subtitle: 'Só o que você liberar aparece para as clientes.', body: body, footer: footer, wide: true });

    const p = $('#panelRoot');
    $$('.weekday-pick input', p).forEach((cb) => cb.addEventListener('change', () => {
      cb.closest('.weekday-pick').classList.toggle('is-on', cb.checked);
      updatePreview();
    }));

    function compute() {
      const from = $('#r-from', p).value;
      const to = $('#r-to', p).value;
      const days = $$('.weekday-pick input:checked', p).map((cb) => Number(cb.dataset.weekday));
      const profId = $('#r-prof', p).value;
      const startMin = toMin($('#r-start', p).value);
      const endMin = toMin($('#r-end', p).value);
      const step = Number($('#r-step', p).value) || SLOT_WINDOW;
      const out = [];
      if (!from || !to || !profId || !days.length || to < from) return out;
      const times = [];
      for (let m = startMin; m + step <= endMin; m += step) times.push(fromMin(m));
      if (!times.length) return out;
      const now = Date.now();
      let cursor = from;
      let guard = 0;
      while (cursor <= to && guard++ < 70) {
        const d = fromISO(cursor);
        if (days.includes(d.getDay())) {
          const prof = profById(profId);
          const hrs = prof && prof.hours[d.getDay()];
          times.forEach((t) => {
            if (!hrs || !hrs[0] || toMin(t) < toMin(hrs[0]) || toMin(t) + step > toMin(hrs[1])) return;
            if (new Date(cursor + 'T' + t + ':00').getTime() <= now) return;
            if (findConflict(profId, cursor, t, step)) return;
            if (slotOverlap(profId, cursor, t, step)) return;
            if (out.some((v) => v.date === cursor && v.start === t)) return;
            out.push({ date: cursor, start: t, duration: step, professionalId: profId });
          });
        }
        cursor = addDays(cursor, 1);
      }
      return out;
    }

    function updatePreview() {
      const n = compute().length;
      const el = $('#releasePreview', p);
      if (!el) return;
      el.classList.toggle('is-empty', n === 0);
      el.innerHTML = n
        ? 'Serão liberadas <strong>' + n + (n === 1 ? ' vaga' : ' vagas') + '</strong> para as clientes. Você pode remover cada uma depois em Disponibilidade.'
        : 'Nenhuma vaga nova com esses ajustes. Amplie o período, troque os dias ou os horários.';
    }

    ['r-from', 'r-to', 'r-prof', 'r-start', 'r-end', 'r-step'].forEach((id) => {
      const el = $('#' + id, p);
      el.addEventListener('change', updatePreview);
      el.addEventListener('input', updatePreview);
    });
    updatePreview();

    $('#releaseForm', p).addEventListener('submit', async (e) => {
      e.preventDefault();
      const list = compute();
      if (!list.length) { toast('Nenhuma vaga nova para liberar.'); return; }
      try {
        if (state.mode === 'neon') {
          const created = await apiFetch('/api/slots', { method: 'POST', body: { slots: list } });
          created.forEach((v) => state.slots.push(v));
        } else {
          list.forEach((v) => state.slots.push(Object.assign({ id: uid('v'), status: 'livre', appointmentId: null, createdAt: new Date().toISOString() }, v)));
        }
        touch();
        closePanel();
        setView('disponibilidade');
        toast(list.length + (list.length === 1 ? ' vaga liberada' : ' vagas liberadas'));
      } catch (err) { toast(err && err.message ? err.message : 'Não foi possível liberar os horários.'); }
    });
  }

  function openSlotDetail(id) {
    const v = slotById(id);
    if (!v) return;
    const prof = profById(v.professionalId);
    const isFree = v.status === 'livre';
    const appt = v.appointmentId ? state.appointments.find((a) => a.id === v.appointmentId) : null;
    const body = '<div class="detail-block">' +
      '<span class="status-pill">' + (isFree ? 'Vaga livre' : 'Reservada') + '</span>' +
      '<div class="detail-meta">' +
        '<div><small>Serviço</small><strong>' + (isFree ? 'Qualquer serviço' : esc(appt ? serviceLabel(appt) : '—')) + '</strong></div>' +
        '<div><small>Profissional</small><strong>' + esc(prof ? prof.name : '—') + '</strong></div>' +
        '<div><small>Data</small><strong>' + esc(cap(longDate(v.date))) + '</strong></div>' +
        '<div><small>Horário</small><strong>' + esc(v.start) + '</strong></div>' +
        '<div><small>Valor</small><strong class="money">' + (isFree ? 'Conforme o serviço' : brl(appt ? appt.price : 0)) + '</strong></div>' +
        '<div><small>Situação</small><strong>' + (isFree ? 'Aguardando cliente' : esc(appt ? clientName(appt) : 'Reservada')) + '</strong></div>' +
      '</div>' +
      '<p class="hint">Este é um horário que a administração liberou. ' + (isFree ? 'A cliente escolhe qualquer serviço do catálogo ao reservar.' : 'A cliente já reservou e escolheu o serviço.') + '</p>' +
      '</div>';
    const footer = (isFree ? '<button class="btn btn-ghost-danger btn-sm" data-action="remove-slot" data-id="' + v.id + '">Remover vaga</button>' : '') +
      '<div class="spacer"></div>' +
      '<button class="btn btn-secondary" data-action="goto-client-date" data-date="' + v.date + '">Ver como cliente</button>' +
      '<button class="btn btn-primary" data-action="close-panel">Fechar</button>';
    openPanel({ title: isFree ? 'Horário liberado' : 'Horário reservado', subtitle: 'Vaga · ' + esc(cap(longDate(v.date))), body: body, footer: footer });
  }

  function requestRemoveSlot(id) {
    const v = slotById(id);
    if (!v) return;
    if (v.status !== 'livre') { toast('Esta vaga já foi reservada — cancele o agendamento primeiro.'); return; }
    confirmAction({
      title: 'Remover vaga',
      message: 'O horário de <strong>' + esc(v.start) + '</strong> em ' + shortDate(v.date) + ' deixará de aparecer para as clientes. Nenhum agendamento será perdido.',
      onConfirm: async () => {
        await deleteSlot(id);
        renderAll();
        toast('Vaga removida');
      }
    });
  }

  function setArea(area) {
    const target = area === 'cliente' ? 'cliente' : 'admin';
    if (target === 'admin' && !state.authed) {
      state.area = 'admin';
      state.loginError = '';
      try { history.replaceState(null, '', '#login'); } catch (e) { /* ignora */ }
      closePanel();
      renderAll();
      return;
    }
    state.area = target;
    try { history.replaceState(null, '', target === 'cliente' ? '#cliente' : '#' + state.view); } catch (e) { /* ignora */ }
    closePanel();
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('open');
    try { window.scrollTo(0, 0); } catch (e) { /* ignora */ }
    renderAll();
    if (target === 'cliente') {
      (async () => { await ensureClientData(); renderAll(); })();
    } else if (target === 'admin' && state.authed && state.mode === 'neon') {
      (async () => { try { await loadAdminData(); } catch (e) { /* mantém os dados atuais */ } renderAll(); })();
    }
  }

  function gotoClientDate(date) {
    booking.date = date;
    booking.step = 'browse';
    booking.slotId = null;
    booking.serviceId = null;
    setArea('cliente');
  }

  function bookingLink() {
    if (!/^https?:$/.test(location.protocol)) return '';
    return location.href.split('#')[0] + '#cliente';
  }

  function copyBookingLink() {
    const link = bookingLink();
    if (!link) { toast('Publique o app e use a URL terminando em #cliente'); return; }
    const done = () => toast('Link de agendamento copiado');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => fallbackCopy(link, done));
    } else fallbackCopy(link, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copie este link: ' + text); }
    ta.remove();
  }

  function resetBooking() {
    booking.date = null;
    booking.slotId = null;
    booking.serviceId = null;
    booking.step = 'browse';
    booking.confirmed = null;
    booking.error = '';
    booking.draft = { name: '', phone: '' };
    renderClientBody();
  }

  function requestResetDemo() {
    confirmAction({
      title: 'Reiniciar demonstração',
      message: 'Todos os clientes, serviços, profissionais, agendamentos e horários liberados feitos nesta demonstração serão apagados. A base volta ao estado inicial: limpa, só com Geovana Amorim e alguns horários livres.',
      label: 'Reiniciar',
      onConfirm: async () => {
        Object.assign(state, seedData());
        state.seededOn = todayISO();
        state.touched = false;
        persist();
        renderAll();
        toast('Demonstração reiniciada');
      }
    });
  }

  async function confirmBooking() {
    const p = $('#clientBody');
    const nameEl = $('#b-name', p);
    const phoneEl = $('#b-phone', p);
    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    booking.draft = { name: name, phone: phone };
    const badName = !name;
    const badPhone = phoneDigits(phone).length < 10;
    p.querySelector('[data-for="name"]').classList.toggle('show', badName);
    p.querySelector('[data-for="phone"]').classList.toggle('show', badPhone);
    nameEl.setAttribute('aria-invalid', badName ? 'true' : 'false');
    phoneEl.setAttribute('aria-invalid', badPhone ? 'true' : 'false');
    if (badName || badPhone) return;

    const v = chosenSlot();
    const s = chosenService();
    if (!v || v.status !== 'livre' || !slotBookable(v) || !s) {
      booking.step = 'browse';
      booking.slotId = null;
      booking.serviceId = null;
      booking.error = 'Esse horário não está mais disponível. Escolha outro.';
      renderClientBody();
      return;
    }

    const prof = profById(v.professionalId);
    const hrs = prof && prof.hours[fromISO(v.date).getDay()];
    if (findConflict(v.professionalId, v.date, v.start, s.duration, null)) {
      booking.error = 'Este serviço não cabe neste horário — há outro atendimento em andamento. Escolha outro horário.';
      renderClientBody();
      return;
    }
    if (hrs && hrs[1] && toMin(v.start) + Number(s.duration) > toMin(hrs[1])) {
      booking.error = 'Este serviço termina depois do horário de atendimento. Escolha outro horário.';
      renderClientBody();
      return;
    }

    const btn = p.querySelector('[data-od-id="confirm-booking"]');
    if (btn) btn.disabled = true;

    try {
      let clientNameOut = name;
      let priceCents;
      let priceLabel;
      if (state.mode === 'neon') {
        const res = await apiFetch('/api/book', { method: 'POST', body: { slotId: v.id, serviceId: s.id, name: name, phone: phone } });
        state.appointments.push(res.appointment);
        const si = state.slots.findIndex((x) => x.id === res.slot.id);
        if (si >= 0) state.slots[si] = res.slot; else state.slots.push(res.slot);
        if (!state.clients.some((c) => c.id === res.client.id)) state.clients.push(res.client);
        clientNameOut = res.client.name;
        priceCents = Number(res.appointment.price);
        priceLabel = res.priceLabel || '';
      } else {
        let client = findClientByPhone(phone);
        if (!client) {
          client = { id: uid('c'), name: name, phone: phone, email: '',
            notes: 'Cadastro feito pelo agendamento online.', createdAt: new Date().toISOString() };
          state.clients.push(client);
        }
        clientNameOut = client.name;
        const q = priceFor(s, client.id);
        priceCents = q.cents;
        priceLabel = q.label;
        const appt = {
          id: uid('a'), clientId: client.id, serviceId: s.id, serviceName: s.name,
          professionalId: v.professionalId, date: v.date, start: v.start, duration: Number(s.duration),
          price: priceCents, status: 'agendado', isFitIn: false,
          notes: 'Reserva feita pela cliente pelo agendamento online.', slotId: v.id,
          createdAt: new Date().toISOString()
        };
        state.appointments.push(appt);
        v.status = 'reservado';
        v.appointmentId = appt.id;
        touch();
      }
      booking.confirmed = {
        clientName: clientNameOut, serviceName: s.name, date: v.date, start: v.start,
        duration: Number(s.duration), profName: prof ? prof.name : 'Amorim Beauty',
        price: priceCents, priceLabel: priceLabel, phone: phone
      };
      booking.step = 'ok';
      booking.error = '';
      renderClientBody();
    } catch (err) {
      booking.error = err && err.message ? err.message : 'Não foi possível confirmar. Tente novamente.';
      renderClientBody();
    }
  }

  function renderAll() {
    renderChrome();
    renderAgenda();
    renderDisponibilidade();
    renderClients();
    renderServices();
    renderProfessionals();
    renderClient();
  }

  function openPanel(opts) {
    closePanel();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = '<div class="panel' + (opts.wide ? ' panel-wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="panelTitle">' +
      '<div class="panel-head"><div><h2 id="panelTitle">' + opts.title + '</h2>' + (opts.subtitle ? '<p class="panel-sub">' + opts.subtitle + '</p>' : '') + '</div>' +
      '<button class="icon-btn" data-action="close-panel" aria-label="Fechar">' + ICON_X + '</button></div>' +
      '<div class="panel-body">' + opts.body + '</div>' +
      (opts.footer ? '<div class="panel-foot">' + opts.footer + '</div>' : '') + '</div>';
    $('#panelRoot').appendChild(overlay);
    void overlay.offsetWidth;
    overlay.classList.add('in');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = overlay.querySelector('input:not([type="hidden"]), select, textarea, .panel-foot .btn');
      if (first) first.focus();
    }, 70);
    return overlay;
  }

  function closePanel() {
    $('#panelRoot').innerHTML = '';
    document.body.style.overflow = '';
  }

  function statusOptions(current) {
    return Object.keys(STATUS).map((k) => '<option value="' + k + '"' + (k === current ? ' selected' : '') + '>' + STATUS[k] + '</option>').join('');
  }

  function openApptForm(id, prefill) {
    const appt = id ? state.appointments.find((a) => a.id === id) : null;
    const pre = prefill || {};
    const model = appt ? Object.assign({}, appt) : {
      clientId: pre.clientId || '',
      serviceId: pre.serviceId || '',
      professionalId: pre.professionalId || (activePros()[0] || {}).id || '',
      date: pre.date || state.date,
      start: pre.start || '09:00',
      duration: pre.duration || 60,
      price: pre.price || 0,
      status: 'agendado',
      isFitIn: false,
      notes: ''
    };
    if (!appt) Object.assign(model, pre);

    const clientsSorted = state.clients.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const clientOpts = '<option value="">Selecione a cliente</option>' + clientsSorted.map((c) =>
      '<option value="' + c.id + '"' + (model.clientId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');

    const groups = {};
    state.services.filter((s) => s.active !== false || s.id === model.serviceId).forEach((s) => {
      (groups[s.category] || (groups[s.category] = [])).push(s);
    });
    let serviceOpts = '<option value="">Selecione o serviço</option>';
    Object.keys(groups).forEach((cat) => {
      serviceOpts += '<optgroup label="' + esc(cat) + '">' + groups[cat].map((s) =>
        '<option value="' + s.id + '"' + (model.serviceId === s.id ? ' selected' : '') + '>' + esc(s.name) + ' · ' + s.duration + ' min</option>').join('') + '</optgroup>';
    });

    const profOpts = activePros().concat(state.professionals.filter((p) => p.active === false && p.id === model.professionalId))
      .map((p) => '<option value="' + p.id + '"' + (model.professionalId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');

    const body = '<form id="apptForm" novalidate><div class="form-grid">' +
      '<div class="field span-2"><label for="f-client">Cliente</label><select id="f-client" class="select">' + clientOpts + '</select><p class="field-error" data-for="client">Selecione a cliente ou cadastre uma nova abaixo.</p>' +
      (state.clients.length ? '' : '<p class="hint">A base está limpa — cadastre a primeira cliente aqui mesmo:</p>') + '</div>' +
      (state.clients.length ? '' :
        '<div class="field span-2 quick-add"><span class="field-label">Nova cliente</span><div class="form-grid">' +
          '<div class="field"><label for="f-newname">Nome</label><input id="f-newname" class="input" placeholder="Nome completo"></div>' +
          '<div class="field"><label for="f-newphone">Telefone</label><input id="f-newphone" class="input" inputmode="tel" placeholder="(11) 99999-0000"></div>' +
        '</div></div>') +
      '<div class="field span-2"><label for="f-service">Serviço</label><select id="f-service" class="select">' + serviceOpts + '</select><p class="field-error" data-for="service">Selecione o serviço.</p></div>' +
      '<div class="field"><label for="f-prof">Profissional</label><select id="f-prof" class="select">' + profOpts + '</select><p class="field-error" data-for="prof">Selecione a profissional.</p></div>' +
      '<div class="field"><label for="f-date">Data</label><input id="f-date" type="date" class="input" value="' + esc(model.date) + '"><p class="field-error" data-for="date">Informe a data.</p></div>' +
      '<div class="field"><label for="f-time">Horário</label><input id="f-time" type="time" class="input" step="900" value="' + esc(model.start) + '"><p class="field-error" data-for="time">Informe o horário.</p></div>' +
      '<div class="field"><label for="f-dur">Duração (min)</label><input id="f-dur" type="number" class="input" min="15" step="15" value="' + (model.duration || '') + '"><p class="field-error" data-for="dur">Informe a duração.</p></div>' +
      '<div class="field"><label for="f-price">Valor (R$)</label><input id="f-price" type="number" class="input" min="0" step="0.01" value="' + (model.price ? (Number(model.price) / 100).toFixed(2) : '') + '"></div>' +
      '<div class="field"><label for="f-status">Situação</label><select id="f-status" class="select">' + statusOptions(model.status) + '</select></div>' +
      '<div class="field span-2"><label class="switch"><input type="checkbox" id="f-fitin"' + (model.isFitIn ? ' checked' : '') + '><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-label">Encaixe — atendimento sem horário fixo</span></label></div>' +
      '<div class="field span-2"><label for="f-notes">Observações</label><textarea id="f-notes" class="textarea" placeholder="Preferências, alergias, detalhes do atendimento">' + esc(model.notes || '') + '</textarea></div>' +
      '</div><div class="conflict-note" id="conflictNote">' + ICON_ALERT + '<span></span></div></form>';

    const footer = (appt ? '<button type="button" class="btn btn-ghost-danger btn-sm" data-action="delete-appt" data-id="' + appt.id + '">Excluir</button>' : '') +
      '<div class="spacer"></div>' +
      '<button type="button" class="btn btn-ghost" data-action="close-panel">Cancelar</button>' +
      '<button type="button" data-action="submit-form" data-form="apptForm" class="btn btn-primary">' + (appt ? 'Salvar alterações' : 'Agendar') + '</button>';

    openPanel({
      title: appt ? 'Editar agendamento' : 'Novo agendamento',
      subtitle: appt ? esc(clientName(appt)) : 'Escolha cliente, serviço e horário.',
      body: body,
      footer: footer
    });

    const p = $('#panelRoot');
    const form = $('#apptForm', p);
    const selClient = $('#f-client', p);
    const selService = $('#f-service', p);
    const selProf = $('#f-prof', p);
    const inpDate = $('#f-date', p);
    const inpTime = $('#f-time', p);
    const inpDur = $('#f-dur', p);
    const inpPrice = $('#f-price', p);
    const note = $('#conflictNote', p);

    const checkConflict = () => {
      const dur = Number(inpDur.value || 0);
      const c = (selProf.value && inpDate.value && inpTime.value && dur > 0)
        ? findConflict(selProf.value, inpDate.value, inpTime.value, dur, appt ? appt.id : null) : null;
      if (c) {
        note.classList.add('show');
        note.querySelector('span').textContent = 'Conflito com ' + clientName(c) + ' às ' + c.start + ' (' + serviceLabel(c) + '). Ajuste o horário ou registre como encaixe.';
      } else {
        note.classList.remove('show');
      }
    };

    selService.addEventListener('change', () => {
      const s = serviceById(selService.value);
      if (s) {
        inpDur.value = s.duration;
        inpPrice.value = (Number(s.price) / 100).toFixed(2);
      }
      checkConflict();
    });

    [selProf, inpDate, inpTime, inpDur].forEach((el) => {
      el.addEventListener('change', checkConflict);
      el.addEventListener('input', checkConflict);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const setErr = (key, on) => {
        const el = p.querySelector('[data-for="' + key + '"]');
        if (el) el.classList.toggle('show', on);
      };
      const dur = Number(inpDur.value || 0);
      const newNameEl = $('#f-newname', p);
      const newPhoneEl = $('#f-newphone', p);
      const newName = newNameEl ? newNameEl.value.trim() : '';
      const errors = {
        client: !selClient.value && !newName,
        service: !selService.value,
        prof: !selProf.value,
        date: !inpDate.value,
        time: !inpTime.value,
        dur: !(dur > 0)
      };
      let bad = false;
      Object.keys(errors).forEach((k) => {
        setErr(k, errors[k]);
        if (errors[k]) bad = true;
      });
      [selClient, selService, selProf, inpDate, inpTime, inpDur].forEach((el) => {
        el.setAttribute('aria-invalid', el === selClient && errors.client ? 'true' :
          el === selService && errors.service ? 'true' :
          el === selProf && errors.prof ? 'true' :
          el === inpDate && errors.date ? 'true' :
          el === inpTime && errors.time ? 'true' :
          el === inpDur && errors.dur ? 'true' : 'false');
      });
      if (bad) return;

      const svc = serviceById(selService.value);

      try {
        let clientId = selClient.value;
        if (!clientId) {
          const nc = await createClient({
            name: newName,
            phone: newPhoneEl ? newPhoneEl.value.trim() : '',
            email: '',
            notes: 'Cadastro feito junto com o agendamento.'
          });
          clientId = nc.id;
        }
        const payload = {
          clientId: clientId,
          serviceId: selService.value,
          serviceName: svc ? svc.name : serviceLabel(model),
          professionalId: selProf.value,
          date: inpDate.value,
          start: inpTime.value,
          duration: dur,
          price: Math.round((parseFloat(inpPrice.value) || 0) * 100),
          status: $('#f-status', p).value,
          isFitIn: $('#f-fitin', p).checked,
          notes: $('#f-notes', p).value.trim()
        };
        if (appt) await updateAppointment(appt.id, payload);
        else await createAppointment(payload);
        closePanel();
        renderAll();
        toast(appt ? 'Agendamento atualizado' : 'Agendamento criado');
      } catch (err) {
        toast('Não foi possível salvar. Tente novamente.');
      }
    });
  }

  function openApptDetail(id) {
    const a = state.appointments.find((x) => x.id === id);
    if (!a) return;
    const c = clientById(a.clientId);
    const p = profById(a.professionalId);
    const msg = 'Oi' + (c ? ' ' + c.name.split(' ')[0] : '') + '! Passando para confirmar seu horário no Amorim Beauty: ' +
      cap(longDate(a.date)) + ' às ' + a.start + ', ' + serviceLabel(a) + '. Até lá!';

    const body = '<div class="detail-block">' +
      '<span class="status-pill" data-status="' + a.status + '">' + STATUS[a.status] + '</span>' +
      '<div class="detail-meta">' +
      '<div><small>Cliente</small><strong>' + esc(c ? c.name : '—') + '</strong></div>' +
      '<div><small>Profissional</small><strong>' + esc(p ? p.name : '—') + '</strong></div>' +
      '<div><small>Data</small><strong>' + esc(cap(longDate(a.date))) + '</strong></div>' +
      '<div><small>Horário</small><strong>' + a.start + ' · ' + a.duration + ' min</strong></div>' +
      '<div><small>Serviço</small><strong>' + esc(serviceLabel(a)) + '</strong></div>' +
      '<div><small>Valor</small><strong class="money">' + brl(a.price) + '</strong></div>' +
      '</div>' +
      (a.isFitIn ? '<span class="badge-inactive" style="width:fit-content">Encaixe</span>' : '') +
      (a.notes ? '<div><p class="field-label">Observações</p><div class="notes-box">' + esc(a.notes) + '</div></div>' : '') +
      '<div><p class="field-label">Atualizar situação</p><div class="status-actions">' +
      Object.keys(STATUS).map((k) => '<button class="mini-btn' + (k === a.status ? ' is-on' : '') + '" data-action="set-status" data-id="' + a.id + '" data-status="' + k + '">' + STATUS[k] + '</button>').join('') +
      '</div></div></div>';

    const footer = '<a class="btn btn-secondary btn-sm" href="' + waLink(c ? c.phone : '', msg) + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<button class="btn btn-ghost-danger btn-sm" data-action="delete-appt" data-id="' + a.id + '">Excluir</button>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-secondary" data-action="edit-appt-form" data-id="' + a.id + '">Editar</button>' +
      '<button class="btn btn-primary" data-action="close-panel">Fechar</button>';

    openPanel({ title: esc(c ? c.name : 'Agendamento'), subtitle: esc(serviceLabel(a)) + ' · ' + esc(cap(longDate(a.date))), body: body, footer: footer });
  }

  function openClientForm(id) {
    const c = id ? clientById(id) : null;
    const model = c || { name: '', phone: '', email: '', notes: '' };
    const body = '<form id="clientForm" novalidate><div class="form-grid">' +
      '<div class="field span-2"><label for="c-name">Nome completo</label><input id="c-name" class="input" value="' + esc(model.name) + '" placeholder="Ex.: Nome da cliente"><p class="field-error" data-for="name">Informe o nome.</p></div>' +
      '<div class="field"><label for="c-phone">Telefone</label><input id="c-phone" class="input" value="' + esc(model.phone) + '" placeholder="(11) 99999-0000" inputmode="tel"></div>' +
      '<div class="field"><label for="c-email">E-mail</label><input id="c-email" type="email" class="input" value="' + esc(model.email) + '" placeholder="nome@email.com"></div>' +
      '<div class="field span-2"><label for="c-notes">Observações</label><textarea id="c-notes" class="textarea" placeholder="Alergias, preferências, histórico de pele">' + esc(model.notes || '') + '</textarea></div>' +
      '</div></form>';
    const footer = (c ? '<button type="button" class="btn btn-ghost-danger btn-sm" data-action="delete-client" data-id="' + c.id + '">Excluir</button>' : '') +
      '<div class="spacer"></div><button type="button" class="btn btn-ghost" data-action="close-panel">Cancelar</button>' +
      '<button type="button" data-action="submit-form" data-form="clientForm" class="btn btn-primary">' + (c ? 'Salvar' : 'Cadastrar cliente') + '</button>';

    openPanel({ title: c ? 'Editar cliente' : 'Novo cliente', subtitle: 'Dados de contato e observações do atendimento.', body: body, footer: footer });

    const p = $('#panelRoot');
    $('#clientForm', p).addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#c-name', p).value.trim();
      const err = p.querySelector('[data-for="name"]');
      if (!name) { err.classList.add('show'); $('#c-name', p).setAttribute('aria-invalid', 'true'); return; }
      err.classList.remove('show');
      const payload = {
        name: name,
        phone: $('#c-phone', p).value.trim(),
        email: $('#c-email', p).value.trim(),
        notes: $('#c-notes', p).value.trim()
      };
      try {
        if (c) await updateClient(c.id, payload); else await createClient(payload);
        closePanel(); renderAll(); toast(c ? 'Cliente atualizado' : 'Cliente cadastrado');
      } catch (err2) { toast('Não foi possível salvar. Tente novamente.'); }
    });
  }

  function openClientDetail(id) {
    const c = clientById(id);
    if (!c) return;
    const stats = clientStats()[c.id] || { visits: 0, spent: 0, last: null, next: null };
    const history = state.appointments.filter((a) => a.clientId === c.id)
      .sort((x, y) => (y.date + y.start).localeCompare(x.date + x.start)).slice(0, 10);

    let body = '<div class="detail-block">' +
      '<div class="detail-meta">' +
      '<div><small>Telefone</small><strong>' + esc(c.phone || '—') + '</strong></div>' +
       '<div><small>E-mail</small><strong>' + esc(c.email || '—') + '</strong></div>' +
       '<div><small>Visitas</small><strong>' + stats.visits + '</strong></div>' +
       '<div><small>Total gasto</small><strong class="money">' + brl(stats.spent) + '</strong></div>' +
      '</div>' +
      '<div class="status-actions">' +
      '<button class="mini-btn" data-action="new-appt-for" data-id="' + c.id + '">Novo agendamento</button>' +
      '<a class="mini-btn" href="' + waLink(c.phone, 'Oi ' + c.name.split(' ')[0] + '! Tudo bem? Aqui é do Amorim Beauty.') + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<button class="mini-btn" data-action="edit-client" data-id="' + c.id + '">Editar cadastro</button>' +
      '</div>' +
      (c.notes ? '<div><p class="field-label">Observações</p><div class="notes-box">' + esc(c.notes) + '</div></div>' : '') +
      '<div><div class="rail-head"><h3>Histórico</h3><span>' + stats.visits + (stats.visits === 1 ? ' visita' : ' visitas') + '</span></div>';

    if (!history.length) {
      body += '<p class="rail-empty">Nenhum atendimento registrado ainda.</p>';
    } else {
      body += '<div class="history">';
      history.forEach((a) => {
        const pr = profById(a.professionalId);
        body += '<div class="history-item"><span class="history-date">' + shortDate(a.date) + ' · ' + a.start + '</span>' +
          '<span class="history-copy"><strong>' + esc(serviceLabel(a)) + '</strong><small>' + esc(pr ? pr.name : '—') + ' · ' + STATUS[a.status] + '</small></span>' +
          '<span class="history-price">' + brl(a.price) + '</span></div>';
      });
      body += '</div>';
    }
    body += '</div></div>';

    openPanel({ title: esc(c.name), subtitle: 'Cliente desde ' + shortDate(String(c.createdAt || '').slice(0, 10)), body: body, wide: true });
  }

  function openServiceForm(id) {
    const s = id ? serviceById(id) : null;
    const model = s || { name: '', category: CATEGORY_ORDER[0], duration: 60, price: 0, repeatPrice: null, firstSessionRule: false, active: true };
    const cats = Array.from(new Set(state.services.map((x) => x.category)));
    const body = '<form id="serviceForm" novalidate><div class="form-grid">' +
      '<div class="field span-2"><label for="s-name">Nome do serviço</label><input id="s-name" class="input" value="' + esc(model.name) + '" placeholder="Ex.: Limpeza de Pele"><p class="field-error" data-for="name">Informe o nome.</p></div>' +
      '<div class="field"><label for="s-cat">Categoria</label><input id="s-cat" class="input" list="catList" value="' + esc(model.category) + '"><datalist id="catList">' + cats.map((c2) => '<option value="' + esc(c2) + '"></option>').join('') + '</datalist></div>' +
      '<div class="field"><label for="s-dur">Duração (min)</label><input id="s-dur" type="number" class="input" min="15" step="15" value="' + model.duration + '"><p class="field-error" data-for="dur">Informe a duração.</p></div>' +
      '<div class="field"><label for="s-price">Preço da 1ª sessão (R$)</label><input id="s-price" type="number" class="input" min="0" step="0.01" value="' + (Number(model.price) / 100).toFixed(2) + '"><p class="field-error" data-for="price">Informe o preço.</p></div>' +
      '<div class="field span-2"><label for="s-repeat">Valor a partir da 2ª sessão (R$)</label><input id="s-repeat" type="number" class="input" min="0" step="0.01" value="' + (model.repeatPrice != null ? (Number(model.repeatPrice) / 100).toFixed(2) : '') + '" placeholder="Deixe em branco se não houver desconto"><p class="field-error" data-for="repeat">O valor das sessões seguintes deve ser menor que o da 1ª sessão.</p><p class="hint">Use para serviços como Hidra Gloss: R$ 120,00 só na 1ª sessão.</p></div>' +
      '<div class="field span-2"><label class="switch"><input type="checkbox" id="s-first"' + (model.firstSessionRule ? ' checked' : '') + '><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-label">Preço especial na 1ª sessão (reduzido nas seguintes)</span></label></div>' +
      '<div class="field span-2"><label class="switch"><input type="checkbox" id="s-active"' + (model.active !== false ? ' checked' : '') + '><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-label">Ativo no catálogo</span></label></div>' +
      '</div></form>';
    const footer = '<div class="spacer"></div><button type="button" class="btn btn-ghost" data-action="close-panel">Cancelar</button>' +
      '<button type="button" data-action="submit-form" data-form="serviceForm" class="btn btn-primary">' + (s ? 'Salvar' : 'Cadastrar serviço') + '</button>';

    openPanel({ title: s ? 'Editar serviço' : 'Novo serviço', subtitle: 'Valores importados de valores.xlsx; duração é estimativa editável.', body: body, footer: footer });

    const p = $('#panelRoot');
    $('#serviceForm', p).addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#s-name', p).value.trim();
      const dur = Number($('#s-dur', p).value || 0);
      const price = parseFloat($('#s-price', p).value || 0);
      const priceCents = Math.round(price * 100);
      const rawRepeat = $('#s-repeat', p).value;
      const repeatPrice = rawRepeat === '' ? null : Math.round((parseFloat(rawRepeat) || 0) * 100);
      const repeatInvalid = repeatPrice != null && repeatPrice >= priceCents;
      const showErr = (key, on) => { const el = p.querySelector('[data-for="' + key + '"]'); if (el) el.classList.toggle('show', on); };
      showErr('name', !name); showErr('dur', !(dur > 0)); showErr('price', !(price >= 0)); showErr('repeat', repeatInvalid);
      if (!name || !(dur > 0) || repeatInvalid) return;
      const payload = {
        name: name,
        category: $('#s-cat', p).value.trim() || 'Outros',
        duration: dur,
        price: priceCents,
        repeatPrice: repeatPrice,
        firstSessionRule: $('#s-first', p).checked,
        active: $('#s-active', p).checked
      };
      try {
        if (s) await updateService(s.id, payload); else await createService(payload);
        closePanel(); renderAll(); toast(s ? 'Serviço atualizado' : 'Serviço cadastrado');
      } catch (err) { toast('Não foi possível salvar. Tente novamente.'); }
    });
  }

  function openProfForm(id) {
    const prof = id ? profById(id) : null;
    const model = prof || { name: '', role: '', phone: '', color: 'rose', active: true, hours: { 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'], 6: null, 0: null } };
    const colors = ['rose', 'sage', 'clay', 'plum', 'sand'];

    let hours = '';
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      const h = model.hours && model.hours[d];
      const on = !!(h && h[0]);
      hours += '<div class="hours-row"><label class="hours-day"><input type="checkbox" data-day="' + d + '"' + (on ? ' checked' : '') + '><span>' + WD_S[d] + '</span></label>' +
        '<input class="input" type="time" data-start="' + d + '" value="' + (on ? h[0] : '09:00') + '"' + (on ? '' : ' disabled') + '>' +
        '<span class="hours-sep">–</span>' +
        '<input class="input" type="time" data-end="' + d + '" value="' + (on ? h[1] : '18:00') + '"' + (on ? '' : ' disabled') + '></div>';
    });

    const body = '<form id="profForm" novalidate><div class="form-grid">' +
      '<div class="field span-2"><label for="p-name">Nome</label><input id="p-name" class="input" value="' + esc(model.name) + '" placeholder="Ex.: Nome da profissional"><p class="field-error" data-for="name">Informe o nome.</p></div>' +
      '<div class="field"><label for="p-role">Função</label><input id="p-role" class="input" value="' + esc(model.role) + '" placeholder="Ex.: Esteticista"></div>' +
      '<div class="field"><label for="p-phone">Telefone</label><input id="p-phone" class="input" value="' + esc(model.phone) + '" inputmode="tel"></div>' +
      '<div class="field span-2"><span class="field-label">Cor na agenda</span><div class="swatches">' +
      colors.map((col) => '<label class="swatch ' + profClass(col) + '"><input type="radio" name="prof-color" value="' + col + '"' + (model.color === col ? ' checked' : '') + '><span></span></label>').join('') +
      '</div></div>' +
      '<div class="field span-2"><label class="switch"><input type="checkbox" id="p-active"' + (model.active !== false ? ' checked' : '') + '><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-label">Ativa na agenda</span></label></div>' +
      '<div class="field span-2"><span class="field-label">Horário de trabalho</span><div class="hours-list">' + hours + '</div></div>' +
      '</div></form>';
    const footer = '<div class="spacer"></div><button type="button" class="btn btn-ghost" data-action="close-panel">Cancelar</button>' +
      '<button type="button" data-action="submit-form" data-form="profForm" class="btn btn-primary">' + (prof ? 'Salvar' : 'Cadastrar profissional') + '</button>';

    openPanel({ title: prof ? 'Editar profissional' : 'Nova profissional', subtitle: 'Defina a cor de identificação e os dias de atendimento.', body: body, footer: footer, wide: true });

    const p = $('#panelRoot');
    $$('.hours-day input', p).forEach((cb) => {
      cb.addEventListener('change', () => {
        const d = cb.dataset.day;
        p.querySelector('[data-start="' + d + '"]').disabled = !cb.checked;
        p.querySelector('[data-end="' + d + '"]').disabled = !cb.checked;
      });
    });

    $('#profForm', p).addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#p-name', p).value.trim();
      const err = p.querySelector('[data-for="name"]');
      if (!name) { err.classList.add('show'); return; }
      err.classList.remove('show');

      const hoursObj = {};
      [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
        const cb = p.querySelector('[data-day="' + d + '"]');
        if (cb && cb.checked) {
          const s = p.querySelector('[data-start="' + d + '"]').value;
          const en = p.querySelector('[data-end="' + d + '"]').value;
          hoursObj[d] = [s || '09:00', en || '18:00'];
        } else {
          hoursObj[d] = null;
        }
      });

      const payload = {
        name: name,
        role: $('#p-role', p).value.trim() || 'Profissional',
        phone: $('#p-phone', p).value.trim(),
        color: (p.querySelector('input[name="prof-color"]:checked') || {}).value || 'rose',
        active: $('#p-active', p).checked,
        hours: hoursObj
      };

      try {
        if (prof) await updateProfessional(prof.id, payload); else await createProfessional(payload);
        closePanel(); renderAll(); toast(prof ? 'Profissional atualizada' : 'Profissional cadastrada');
      } catch (err2) { toast('Não foi possível salvar. Tente novamente.'); }
    });
  }

  function confirmAction(opts) {
    openPanel({
      title: opts.title,
      body: '<p class="hint" style="font-size:13px;line-height:1.65">' + opts.message + '</p>',
      footer: '<div class="spacer"></div><button type="button" class="btn btn-ghost" data-action="close-panel">Cancelar</button>' +
        '<button type="button" class="btn btn-danger" id="confirmBtn">' + (opts.label || 'Excluir') + '</button>'
    });
    const btn = $('#confirmBtn');
    if (btn) btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await opts.onConfirm(); } catch (e) { toast('Não foi possível concluir a ação.'); }
      closePanel();
    });
  }

  async function createAppointment(payload) {
    if (state.mode === 'neon') {
      const row = await apiFetch('/api/appointments', { method: 'POST', body: payload });
      state.appointments.push(row);
    } else {
      state.appointments.push(Object.assign({ id: uid('a'), createdAt: new Date().toISOString() }, payload));
    }
    touch();
  }
  async function updateAppointment(id, patch) {
    if (state.mode === 'neon') {
      const row = await apiFetch('/api/appointments', { method: 'PATCH', body: Object.assign({ id: id }, patch) });
      const i = state.appointments.findIndex((a) => a.id === id);
      if (i >= 0) state.appointments[i] = row;
    } else {
      const a = state.appointments.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    }
    if (patch.status === 'cancelado') freeSlotLocal(id);
    touch();
  }
  async function deleteAppointment(id) {
    if (state.mode === 'neon') await apiFetch('/api/appointments?id=' + encodeURIComponent(id), { method: 'DELETE' });
    freeSlotLocal(id);
    state.appointments = state.appointments.filter((a) => a.id !== id);
    touch();
  }
  async function deleteSlot(id) {
    if (state.mode === 'neon') await apiFetch('/api/slots?id=' + encodeURIComponent(id), { method: 'DELETE' });
    state.slots = state.slots.filter((s) => s.id !== id);
    touch();
  }
  async function createClient(payload) {
    let c;
    if (state.mode === 'neon') c = await apiFetch('/api/clients', { method: 'POST', body: payload });
    else c = Object.assign({ id: uid('c'), createdAt: new Date().toISOString() }, payload);
    state.clients.push(c);
    touch();
    return c;
  }
  async function updateClient(id, patch) {
    if (state.mode === 'neon') {
      const row = await apiFetch('/api/clients', { method: 'PATCH', body: Object.assign({ id: id }, patch) });
      const i = state.clients.findIndex((c) => c.id === id);
      if (i >= 0) state.clients[i] = row;
    } else {
      const c = state.clients.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    }
    touch();
  }
  async function deleteClient(id) {
    if (state.mode === 'neon') await apiFetch('/api/clients?id=' + encodeURIComponent(id), { method: 'DELETE' });
    state.clients = state.clients.filter((c) => c.id !== id);
    touch();
  }
  async function createService(payload) {
    if (state.mode === 'neon') state.services.push(await apiFetch('/api/services', { method: 'POST', body: payload }));
    else state.services.push(Object.assign({ id: uid('s') }, payload));
    touch();
  }
  async function updateService(id, patch) {
    if (state.mode === 'neon') {
      const row = await apiFetch('/api/services', { method: 'PATCH', body: Object.assign({ id: id }, patch) });
      const i = state.services.findIndex((s) => s.id === id);
      if (i >= 0) state.services[i] = row;
    } else {
      const s = state.services.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    }
    touch();
  }
  async function createProfessional(payload) {
    if (state.mode === 'neon') state.professionals.push(await apiFetch('/api/professionals', { method: 'POST', body: payload }));
    else state.professionals.push(Object.assign({ id: uid('p') }, payload));
    touch();
  }
  async function updateProfessional(id, patch) {
    if (state.mode === 'neon') {
      const row = await apiFetch('/api/professionals', { method: 'PATCH', body: Object.assign({ id: id }, patch) });
      const i = state.professionals.findIndex((p) => p.id === id);
      if (i >= 0) state.professionals[i] = row;
    } else {
      const p = state.professionals.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    }
    touch();
  }

  function setView(view) {
    if (!VIEWS.includes(view)) return;
    state.view = view;
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignora */ }
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('open');
    renderAll();
  }

  function moveDate(dir) {
    state.date = addDays(state.date, state.calView === 'week' ? dir * 7 : dir);
    renderAgenda();
  }

  function requestDeleteAppt(id) {
    const a = state.appointments.find((x) => x.id === id);
    if (!a) return;
    confirmAction({
      title: 'Excluir agendamento',
      message: 'O agendamento de <strong>' + esc(clientName(a)) + '</strong> em ' + shortDate(a.date) + ' às ' + a.start + ' será removido da agenda. Essa ação não pode ser desfeita.',
      onConfirm: async () => {
        await deleteAppointment(id);
        renderAll();
        toast('Agendamento excluído');
      }
    });
  }

  function requestDeleteClient(id) {
    const c = clientById(id);
    if (!c) return;
    const used = state.appointments.some((a) => a.clientId === id);
    if (used) { toast('Esta cliente tem histórico de atendimentos — não pode ser excluída.'); return; }
    confirmAction({
      title: 'Excluir cliente',
      message: 'O cadastro de <strong>' + esc(c.name) + '</strong> será removido. Como não há atendimentos vinculados, nada do histórico será perdido.',
      onConfirm: async () => {
        await deleteClient(id);
        renderAll();
        toast('Cliente excluída');
      }
    });
  }

  function onAction(action, ds, el) {
    switch (action) {
      case 'set-view': if (state.area === 'admin' && !state.authed) break; setView(ds.view); break;
      case 'set-area': setArea(ds.area); break;
      case 'logout': logout(false); break;
      case 'reset-demo': requestResetDemo(); break;
      case 'client-tab':
        state.clientTab = ds.tab === 'consultar' ? 'consultar' : 'agendar';
        renderClient();
        break;
      case 'lookup-mine':
        state.clientTab = 'consultar';
        state.lookupPhone = ds.phone || state.lookupPhone;
        state.lookupResult = null;
        state.lookupError = '';
        renderClient();
        doLookup(state.lookupPhone);
        break;
      case 'login-goto-client': setArea('cliente'); break;
      case 'login-demo':
        $('#loginEmail').value = DEMO_ADMIN.email;
        $('#loginPassword').value = DEMO_ADMIN.password;
        submitLogin(DEMO_ADMIN.email, DEMO_ADMIN.password);
        break;
      case 'release-slots': openReleasePanel(); break;
      case 'remove-slot': requestRemoveSlot(ds.id); break;
      case 'open-slot': openSlotDetail(ds.id); break;
      case 'copy-link': copyBookingLink(); break;
      case 'goto-client-date': gotoClientDate(ds.date); break;
      case 'book-date': booking.date = ds.date; renderClientBody(); break;
      case 'pick-slot': booking.slotId = ds.id; booking.step = 'servico'; booking.serviceId = null; booking.error = ''; renderClientBody(); break;
      case 'pick-service': booking.serviceId = ds.id; booking.step = 'dados'; booking.error = ''; renderClientBody(); break;
      case 'book-back-slot': booking.step = 'browse'; booking.slotId = null; booking.serviceId = null; booking.error = ''; renderClientBody(); break;
      case 'book-back-service': booking.step = 'servico'; booking.serviceId = null; booking.error = ''; renderClientBody(); break;
      case 'book-reset': resetBooking(); break;
      case 'cal-view': state.calView = ds.id; renderAgenda(); break;
      case 'prev': moveDate(-1); break;
      case 'next': moveDate(1); break;
      case 'today': state.date = todayISO(); renderAgenda(); break;
      case 'goto-day': state.date = ds.date; state.calView = 'day'; renderAgenda(); break;
      case 'filter-prof': state.profFilter = ds.id; renderAgenda(); break;
      case 'filter-service': state.serviceFilter = ds.id; renderServices(); break;
      case 'new-appt': openApptForm(null, { date: state.view === 'agenda' ? state.date : todayISO() }); break;
      case 'edit-appt': openApptDetail(ds.id); break;
      case 'edit-appt-form': openApptForm(ds.id); break;
      case 'delete-appt': requestDeleteAppt(ds.id); break;
      case 'set-status':
        (async () => {
          try {
            await updateAppointment(ds.id, { status: ds.status });
            closePanel(); renderAll(); toast('Situação atualizada');
          } catch (e) { toast('Não foi possível atualizar.'); }
        })();
        break;
      case 'new-client': openClientForm(null); break;
      case 'edit-client': openClientForm(ds.id); break;
      case 'client-detail': openClientDetail(ds.id); break;
      case 'delete-client': requestDeleteClient(ds.id); break;
      case 'new-appt-for': openApptForm(null, { clientId: ds.id, date: todayISO() }); break;
      case 'new-service': openServiceForm(null); break;
      case 'edit-service': openServiceForm(ds.id); break;
      case 'toggle-service':
        (async () => {
          const s = serviceById(ds.id);
          if (!s) return;
          try {
            await updateService(ds.id, { active: s.active === false });
            renderAll(); toast(s.active === false ? 'Serviço reativado' : 'Serviço desativado');
          } catch (e) { toast('Não foi possível atualizar.'); }
        })();
        break;
      case 'new-prof': openProfForm(null); break;
      case 'edit-prof': openProfForm(ds.id); break;
      case 'toggle-prof':
        (async () => {
          const p = profById(ds.id);
          if (!p) return;
          try {
            await updateProfessional(ds.id, { active: p.active === false });
            renderAll(); toast(p.active === false ? 'Profissional ativada' : 'Profissional desativada');
          } catch (e) { toast('Não foi possível atualizar.'); }
        })();
        break;
      case 'submit-form': {
        const f = document.getElementById(ds.form);
        if (f) f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        break;
      }
      case 'close-panel': closePanel(); break;
      case 'open-menu':
        $('#sidebar').classList.add('open');
        $('#scrim').classList.add('open');
        break;
      case 'close-menu':
        $('#sidebar').classList.remove('open');
        $('#scrim').classList.remove('open');
        break;
      default: break;
    }
  }

  const FORM_IDS = ['apptForm', 'clientForm', 'serviceForm', 'profForm', 'releaseForm', 'bookForm', 'lookupForm', 'loginForm', 'setupForm'];

  function fireFormSubmit(form) {
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }

  function bind() {
    // Nenhum formulário faz submit nativo: em preview com origem opaca isso recarrega a página.
    document.addEventListener('submit', (e) => {
      if (e.target && FORM_IDS.indexOf(e.target.id) >= 0) e.preventDefault();
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target || e.target.tagName === 'TEXTAREA') return;
      const f = e.target.closest ? e.target.closest('form') : null;
      if (f && FORM_IDS.indexOf(f.id) >= 0) { e.preventDefault(); fireFormSubmit(f); }
    });

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      onAction(el.dataset.action, el.dataset, el);
    });

    $('#panelRoot').addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('overlay')) closePanel();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if ($('#panelRoot').querySelector('.overlay')) closePanel();
        else {
          $('#sidebar').classList.remove('open');
          $('#scrim').classList.remove('open');
        }
      }
    });

    $('#clientSearch').addEventListener('input', (e) => {
      state.clientQuery = e.target.value;
      renderClients();
    });

    $('#clientBody').addEventListener('submit', (e) => {
      if (!e.target) return;
      if (e.target.id === 'bookForm') { e.preventDefault(); confirmBooking(); }
      else if (e.target.id === 'lookupForm') { e.preventDefault(); doLookup($('#lookupPhone').value); }
    });

    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      submitLogin($('#loginEmail').value, $('#loginPassword').value);
    });

    $('#setupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      submitSetup();
    });
  }

  async function boot() {
    const hash = (location.hash || '').replace('#', '');
    if (hash === 'cliente') state.area = 'cliente';
    else if (VIEWS.includes(hash)) state.view = hash;
    hydrateDemo();
    bind();
    await detectMode();
    restoreAuth();
    if (state.mode === 'neon' && state.authed) {
      try {
        await loadAdminData();
      } catch (e) {
        state.authed = false;
        state.authToken = '';
        state.loginError = 'Sua sessão expirou. Entre novamente.';
        try { sessionStorage.removeItem(AUTH_KEY); } catch (e2) { /* ignora */ }
      }
    }
    window.__amorimBooted = true;
    renderAll();
  }

  boot();
})();
