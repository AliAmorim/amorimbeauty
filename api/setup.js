import { db, handler, send, readBody } from './_db.js';

// Primeiro acesso: cria a conta da administração.
// Só funciona enquanto a tabela admins estiver vazia — depois se fecha sozinho.
// Opcional: defina SETUP_TOKEN na Vercel para exigir o cabeçalho x-setup-token.
export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  const sql = db();
  const existing = await sql`select count(*)::int as n from admins`;
  if (existing[0].n > 0) {
    return send(res, 409, { error: 'A administração já foi configurada. Use a tela de login.' });
  }

  const token = process.env.SETUP_TOKEN;
  if (token) {
    const given = req.headers && (req.headers['x-setup-token'] || req.headers['X-Setup-Token']);
    if (String(given || '') !== String(token)) {
      return send(res, 403, { error: 'Token de configuração inválido.' });
    }
  }

  const b = await readBody(req);
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!name) return send(res, 400, { error: 'Informe o nome da administradora.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'Informe um e-mail válido.' });
  if (password.length < 8) return send(res, 400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });

  const rows = await sql`
    insert into admins (name, email, password_hash)
    select ${name}, ${email}, crypt(${password}, gen_salt('bf'))
    where not exists (select 1 from admins)
    on conflict (email) do nothing
    returning id, name, email`;
  if (!rows.length) {
    return send(res, 409, { error: 'A administração já foi configurada. Use a tela de login.' });
  }
  send(res, 201, { ok: true, name: rows[0].name, email: rows[0].email });
});
