import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, send } from './_db.js';

// Em produção NÃO há credenciais padrão: a conta é criada em /api/setup
// e a senha é validada contra o hash bcrypt gravado na tabela admins.
const SECRET = process.env.AUTH_SECRET || '';
const TTL = 7 * 24 * 60 * 60 * 1000;

function hmac(payload) {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function equal(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function authConfigured() { return !!SECRET; }

export async function checkCredentials(email, password) {
  if (!SECRET) return null;
  const e = String(email || '').trim().toLowerCase();
  if (!e || typeof password !== 'string' || !password) return null;
  const sql = db();
  const rows = await sql`
    select name, email, password_hash from admins
    where lower(email) = ${e}
      and password_hash = crypt(${password}, password_hash)
    limit 1`;
  return rows[0] || null;
}

export function makeToken(email) {
  const payload = Buffer.from(JSON.stringify({ sub: String(email).toLowerCase(), exp: Date.now() + TTL })).toString('base64url');
  return payload + '.' + hmac(payload);
}

export function verifyToken(token) {
  if (!token || !SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2 || !equal(parts[1], hmac(parts[0]))) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Date.now() || !p.sub) return null;
    return p;
  } catch (e) { return null; }
}

export function bearer(req) {
  const h = req.headers && (req.headers.authorization || req.headers.Authorization);
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function requireAdmin(req, res) {
  if (!verifyToken(bearer(req))) {
    send(res, 401, { error: 'Sessão expirada. Entre novamente.' });
    return false;
  }
  return true;
}
