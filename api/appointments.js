import { db, handler, send, readBody, getId, mapAppointment } from './_db.js';
import { requireAdmin } from './_auth.js';

const STATUSES = ['agendado', 'confirmado', 'concluido', 'faltou', 'cancelado'];

export default handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sql = db();

  if (req.method === 'GET') {
    const rows = await sql`select * from appointments order by appt_date, start_time`;
    return send(res, 200, rows.map(mapAppointment));
  }

  if (req.method === 'POST') {
    const b = await readBody(req);
    if (!b.clientId || !b.professionalId || !b.date || !b.start) {
      return send(res, 400, { error: 'Cliente, profissional, data e horário são obrigatórios' });
    }
    const rows = await sql`
      insert into appointments
        (client_id, service_id, service_name, professional_id, appt_date, start_time, duration_min, price_cents, status, is_fit_in, notes, slot_id)
      values (
        ${b.clientId}, ${b.serviceId || null}, ${b.serviceName || null}, ${b.professionalId},
        ${b.date}, ${b.start}, ${Number(b.duration) || 60}, ${Number(b.price) || 0},
        ${STATUSES.includes(b.status) ? b.status : 'agendado'}, ${!!b.isFitIn}, ${b.notes || ''}, ${b.slotId || null}
      )
      returning *`;
    return send(res, 201, mapAppointment(rows[0]));
  }

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    if (!b.id) return send(res, 400, { error: 'id é obrigatório' });
    const current = (await sql`select * from appointments where id = ${b.id}`)[0];
    if (!current) return send(res, 404, { error: 'Agendamento não encontrado' });
    const m = Object.assign(mapAppointment(current), b);
    const rows = await sql`
      update appointments set
        client_id = ${m.clientId},
        service_id = ${m.serviceId || null},
        service_name = ${m.serviceName || null},
        professional_id = ${m.professionalId},
        appt_date = ${m.date},
        start_time = ${m.start},
        duration_min = ${Number(m.duration) || 60},
        price_cents = ${Number(m.price) || 0},
        status = ${STATUSES.includes(m.status) ? m.status : 'agendado'},
        is_fit_in = ${!!m.isFitIn},
        notes = ${m.notes || ''},
        slot_id = ${m.slotId || null}
      where id = ${b.id}
      returning *`;
    if (STATUSES.includes(m.status) && m.status === 'cancelado') {
      await sql`update slots set status = 'livre', appointment_id = null where appointment_id = ${b.id}`;
    }
    return send(res, 200, mapAppointment(rows[0]));
  }

  if (req.method === 'DELETE') {
    const id = getId(req);
    if (!id) return send(res, 400, { error: 'id é obrigatório' });
    await sql`update slots set status = 'livre', appointment_id = null where appointment_id = ${id}`;
    await sql`delete from appointments where id = ${id}`;
    return send(res, 200, { ok: true });
  }

  send(res, 405, { error: 'Método não permitido' });
});
