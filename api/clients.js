import { db, handler, send, readBody, getId, mapClient } from './_db.js';
import { requireAdmin } from './_auth.js';

export default handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sql = db();

  if (req.method === 'GET') {
    const rows = await sql`select * from clients order by name`;
    return send(res, 200, rows.map(mapClient));
  }

  if (req.method === 'POST') {
    const b = await readBody(req);
    if (!b.name) return send(res, 400, { error: 'Nome é obrigatório' });
    const rows = await sql`
      insert into clients (name, phone, email, notes)
      values (${b.name}, ${b.phone || ''}, ${b.email || ''}, ${b.notes || ''})
      returning *`;
    return send(res, 201, mapClient(rows[0]));
  }

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if (!b.id) return send(res, 400, { error: 'id é obrigatório' });
    const current = (await sql`select * from clients where id = ${b.id}`)[0];
    if (!current) return send(res, 404, { error: 'Cliente não encontrada' });
    const m = Object.assign(mapClient(current), b);
    const rows = await sql`
      update clients set
        name = ${m.name},
        phone = ${m.phone || ''},
        email = ${m.email || ''},
        notes = ${m.notes || ''}
      where id = ${b.id}
      returning *`;
    return send(res, 200, mapClient(rows[0]));
  }

  if (req.method === 'DELETE') {
    const id = getId(req);
    if (!id) return send(res, 400, { error: 'id é obrigatório' });
    const used = (await sql`select 1 from appointments where client_id = ${id} limit 1`).length > 0;
    if (used) return send(res, 409, { error: 'Cliente possui atendimentos vinculados' });
    await sql`delete from clients where id = ${id}`;
    return send(res, 200, { ok: true });
  }

  send(res, 405, { error: 'Método não permitido' });
});
