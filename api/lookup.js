import { db, handler, send, mapAppointment } from './_db.js';

// Público: a cliente consulta os próprios agendamentos só com o telefone.
// Não devolve dados de outras clientes.
export default handler(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });

  const url = new URL(req.url || '/', 'http://localhost');
  const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
  if (phone.length < 10) return send(res, 400, { error: 'Informe o telefone com DDD.' });

  const sql = db();
  const clients = await sql`
    select id, name from clients
    where regexp_replace(phone, '[^0-9]', '', 'g') = ${phone}
    order by created_at limit 1`;
  if (!clients.length) return send(res, 200, { name: '', appointments: [] });

  const rows = await sql`
    select a.id, a.client_id, a.service_id, a.service_name, a.professional_id,
           a.appt_date::text as appt_date, a.start_time::text as start_time,
           a.duration_min, a.price_cents, a.status, a.is_fit_in, a.notes, a.slot_id, a.created_at
    from appointments a
    where a.client_id in (
      select id from clients where regexp_replace(phone, '[^0-9]', '', 'g') = ${phone}
    )
    order by a.appt_date desc, a.start_time desc`;

  send(res, 200, { name: clients[0].name, appointments: rows.map(mapAppointment) });
});
