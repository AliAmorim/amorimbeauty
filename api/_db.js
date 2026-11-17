import { neon } from '@neondatabase/serverless';

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');
  return neon(url);
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(data));
}

export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      send(res, 500, { error: err && err.message ? err.message : 'Erro interno' });
    }
  };
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function getId(req) {
  if (req.query && req.query.id) return String(req.query.id);
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('id');
}

// O driver do Neon pode entregar DATE como objeto Date e TIME como 'HH:MM:SS'. Se isso
// escapar como Date, o JSON vira "2026-11-20T03:00:00.000Z" e clientes antigos montam
// "Invalid Date" (era o "NaN" no dia em producao). Por isso TODAS as consultas que
// devolvem slots/appointments usam appt_date::text e start_time::text, e ainda
// normalizamos aqui como segunda barreira.
export function dbDate(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function dbTime(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
  }
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? String(Number(m[1])).padStart(2, '0') + ':' + m[2] : null;
}

export const mapClient = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || '',
  email: r.email || '',
  notes: r.notes || '',
  createdAt: r.created_at
});

export const mapService = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  duration: r.duration_min,
  price: r.price_cents,
  repeatPrice: r.repeat_price_cents == null ? null : Number(r.repeat_price_cents),
  firstSessionRule: !!r.first_session_rule,
  active: r.active
});

export const mapProfessional = (r) => ({
  id: r.id,
  name: r.name,
  role: r.role,
  color: r.color,
  phone: r.phone || '',
  active: r.active,
  hours: r.hours || {}
});

export const mapAppointment = (r) => ({
  id: r.id,
  clientId: r.client_id,
  serviceId: r.service_id,
  serviceName: r.service_name,
  professionalId: r.professional_id,
  date: dbDate(r.appt_date),
  start: dbTime(r.start_time),
  duration: r.duration_min,
  price: r.price_cents,
  status: r.status,
  isFitIn: r.is_fit_in,
  notes: r.notes || '',
  slotId: r.slot_id || null,
  createdAt: r.created_at
});

export const mapSlot = (r) => ({
  id: r.id,
  date: dbDate(r.appt_date),
  start: dbTime(r.start_time),
  duration: r.duration_min,
  professionalId: r.professional_id,
  status: r.status,
  appointmentId: r.appointment_id || null,
  createdAt: r.created_at
});

// Validacao de entrada: nunca gravar data/hora fora do formato nao deixa o banco
// guardar lixo que so apareceria depois como dia invalido na interface.
export function isISODate(v) {
  const m = String(v == null ? '' : v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) return false;
  const p = m.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
}

export function isHHMM(v) {
  const m = String(v == null ? '' : v).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59;
}
