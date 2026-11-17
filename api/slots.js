import { db, handler, send, readBody, getId, mapSlot, dbDate, dbTime, isISODate, isHHMM } from './_db.js';
import { requireAdmin } from './_auth.js';

const STATUSES = ['livre', 'reservado'];

export default handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sql = db();

  if (req.method === 'GET') {
    const rows = await sql`select id, appt_date::text as appt_date, start_time::text as start_time,
                                  duration_min, professional_id, status, appointment_id, created_at
                           from slots order by appt_date, start_time`;
    return send(res, 200, rows.map(mapSlot));
  }

  if (req.method === 'POST') {
    const b = await readBody(req);
    const list = Array.isArray(b.slots) ? b.slots : (b.date ? [b] : []);
    if (!list.length) return send(res, 400, { error: 'Nenhuma vaga informada' });
    const created = [];
    for (const s of list) {
      if (!isISODate(s.date) || !isHHMM(s.start) || !s.professionalId) continue;
      const scopedDate = dbDate(s.date);
      const scopedStart = dbTime(s.start);
      const dup = await sql`
        select 1 from slots
        where professional_id = ${s.professionalId} and appt_date = ${scopedDate} and start_time = ${scopedStart}
        limit 1`;
      if (dup.length) continue;
      const inserted = await sql`
        insert into slots (appt_date, start_time, duration_min, professional_id, status)
        values (${scopedDate}, ${scopedStart}, ${Number(s.duration) || 60}, ${s.professionalId}, 'livre')
        returning id`;
      const row = (await sql`
        select id, appt_date::text as appt_date, start_time::text as start_time,
               duration_min, professional_id, status, appointment_id, created_at
        from slots where id = ${inserted[0].id}`)[0];
      created.push(mapSlot(row));
    }
    return send(res, 201, created);
  }

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if (!b.id) return send(res, 400, { error: 'id é obrigatório' });
    const current = (await sql`select status, appointment_id from slots where id = ${b.id}`)[0];
    if (!current) return send(res, 404, { error: 'Vaga não encontrada' });
    const updated = await sql`
      update slots set
        status = ${STATUSES.includes(b.status) ? b.status : current.status},
        appointment_id = ${b.appointmentId === undefined ? current.appointment_id : (b.appointmentId || null)}
      where id = ${b.id}
      returning id`;
    const row = (await sql`
      select id, appt_date::text as appt_date, start_time::text as start_time,
             duration_min, professional_id, status, appointment_id, created_at
      from slots where id = ${updated[0].id}`)[0];
    return send(res, 200, mapSlot(row));
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
