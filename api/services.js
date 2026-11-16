import { db, handler, send, readBody, getId, mapService } from './_db.js';
import { requireAdmin } from './_auth.js';

export default handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sql = db();

  if (req.method === 'GET') {
    const rows = await sql`select * from services order by category, name`;
    return send(res, 200, rows.map(mapService));
  }

  if (req.method === 'POST') {
    const b = await readBody(req);
    if (!b.name) return send(res, 400, { error: 'Nome é obrigatório' });
    const rows = await sql`
      insert into services (name, category, duration_min, price_cents, repeat_price_cents, first_session_rule, active)
      values (${b.name}, ${b.category || 'Outros'}, ${Number(b.duration) || 60}, ${Number(b.price) || 0},
        ${b.repeatPrice == null ? null : Number(b.repeatPrice)}, ${!!b.firstSessionRule}, ${b.active !== false})
      returning *`;
    return send(res, 201, mapService(rows[0]));
  }

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if (!b.id) return send(res, 400, { error: 'id é obrigatório' });
    const current = (await sql`select * from services where id = ${b.id}`)[0];
    if (!current) return send(res, 404, { error: 'Serviço não encontrado' });
    const m = Object.assign(mapService(current), b);
    const rows = await sql`
      update services set
        name = ${m.name},
        category = ${m.category || 'Outros'},
        duration_min = ${Number(m.duration) || 60},
        price_cents = ${Number(m.price) || 0},
        repeat_price_cents = ${m.repeatPrice == null ? null : Number(m.repeatPrice)},
        first_session_rule = ${!!m.firstSessionRule},
        active = ${m.active !== false}
      where id = ${b.id}
      returning *`;
    return send(res, 200, mapService(rows[0]));
  }

  if (req.method === 'DELETE') {
    const id = getId(req);
    if (!id) return send(res, 400, { error: 'id é obrigatório' });
    const used = (await sql`select 1 from appointments where service_id = ${id} limit 1`).length > 0;
    if (used) return send(res, 409, { error: 'Serviço já usado em agendamentos — desative em vez de excluir' });
    await sql`delete from services where id = ${id}`;
    return send(res, 200, { ok: true });
  }

  send(res, 405, { error: 'Método não permitido' });
});
