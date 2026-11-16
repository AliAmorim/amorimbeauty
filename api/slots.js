import { db, handler, send, readBody, getId, mapSlot } from './_db.js';
import { requireAdmin } from './_auth.js';

const STATUSES = ['livre', 'reservado'];

export default handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sql = db();

  if (req.method === 'GET') {
    const rows = await sql`select * from slots order by appt_date, start_time`;
    return send(res, 200, rows.map(mapSlot));
  }

  if (req.method === 'POST') {
    const b = await readBody(req);
    const list = Array.isArray(b.slots) ? b.slots : (b.date ? [b] : []);
    if (!list.length) return send(res, 400, { error: 'Nenhuma vaga informada' });
    const created = [];
    for (const s of list) {
      if (!s.date || !s.start || !s.professionalId) continue;
      const dup = await sql`
        select 1 from slots
        where professional_id = ${s.professionalId} and appt_date = ${s.date} and start_time = ${s.start}
        limit 1`;
      if (dup.length) continue;
      const rows = await sql`
        insert into slots (appt_date, start_time, duration_min, professional_id, status)
        values (${s.date}, ${s.start}, ${Number(s.duration) || 60}, ${s.professionalId}, 'livre')
        returning *`;
      created.push(mapSlot(rows[0]));
    }
    return send(res, 201, created);
  }

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if (!b.id) return send(res, 400, { error: 'id é obrigatório' });
    const current = (await sql`select * from slots where id = ${b.id}`)[0];
    if (!current) return send(res, 404, { error: 'Vaga não encontrada' });
    const m = Object.assign(mapSlot(current), b);
    const rows = await sql`
      update slots set
        status = ${STATUSES.includes(m.status) ? m.status : 'livre'},
        appointment_id = ${m.appointmentId || null}
      where id = ${b.id}
      returning *`;
    return send(res, 200, mapSlot(rows[0]));
  }

  if (req.method === 'DELETE') {
    const id = getId(req);
    if (!id) return send(res, 400, { error: 'id é obrigatório' });
    const row = (await sql`select status from slots where id = ${id}`)[0];
    if (!row) return send(res, 404, { error: 'Vaga não encontrada' });
    if (row.status !== 'livre') {
      return send(res, 409, { error: 'Vaga já reservada — cancele o agendamento antes de remover' });
    }
    await sql`delete from slots where id = ${id}`;
    return send(res, 200, { ok: true });
  }

  send(res, 405, { error: 'Método não permitido' });
});
