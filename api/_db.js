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
  date: String(r.appt_date).slice(0, 10),
  start: String(r.start_time).slice(0, 5),
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
  date: String(r.appt_date).slice(0, 10),
  start: String(r.start_time).slice(0, 5),
  duration: r.duration_min,
  professionalId: r.professional_id,
  status: r.status,
  appointmentId: r.appointment_id || null,
  createdAt: r.created_at
});
