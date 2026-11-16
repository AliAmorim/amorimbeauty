import { db, handler, send, readBody, getId, mapProfessional } from './_db.js';
import { requireAdmin } from './_auth.js';

export default handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sql = db();

  if (req.method === 'GET') {
    const rows = await sql`select * from professionals order by name`;
    return send(res, 200, rows.map(mapProfessional));
  }

  if (req.method === 'POST') {
    const b = await readBody(req);
    if (!b.name) return send(res, 400, { error: 'Nome é obrigatório' });
    const rows = await sql`
      insert into professionals (name, role, color, phone, active, hours)
      values (${b.name}, ${b.role || 'Profissional'}, ${b.color || 'rose'}, ${b.phone || ''}, ${b.active !== false}, ${JSON.stringify(b.hours || {})}::jsonb)
      returning *`;
    return send(res, 201, mapProfessional(rows[0]));
  }

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if (!b.id) return send(res, 400, { error: 'id é obrigatório' });
    const current = (await sql`select * from professionals where id = ${b.id}`)[0];
    if (!current) return send(res, 404, { error: 'Profissional não encontrada' });
    const m = Object.assign(mapProfessional(current), b);
    const rows = await sql`
      update professionals set
        name = ${m.name},
        role = ${m.role || 'Profissional'},
        color = ${m.color || 'rose'},
        phone = ${m.phone || ''},
        active = ${m.active !== false},
        hours = ${JSON.stringify(m.hours || {})}::jsonb
      where id = ${b.id}
      returning *`;
    return send(res, 200, mapProfessional(rows[0]));
  }

  if (req.method === 'DELETE') {
    const id = getId(req);
    if (!id) return send(res, 400, { error: 'id é obrigatório' });
    const used = (await sql`select 1 from appointments where professional_id = ${id} limit 1`).length > 0;
    if (used) return send(res, 409, { error: 'Profissional tem atendimentos vinculados — desative em vez de excluir' });
    await sql`delete from professionals where id = ${id}`;
    return send(res, 200, { ok: true });
  }

  send(res, 405, { error: 'Método não permitido' });
});
