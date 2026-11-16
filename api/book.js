import { db, handler, send, readBody, mapClient, mapAppointment, mapSlot } from './_db.js';

function toMin(t) {
  const p = String(t || '00:00').slice(0, 5).split(':').map(Number);
  return (p[0] || 0) * 60 + (p[1] || 0);
}

async function releaseSlot(sql, id) {
  await sql`update slots set status = 'livre', appointment_id = null where id = ${id}`;
}

// Público: a cliente não tem login, mas precisa informar nome e telefone.
export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  const b = await readBody(req);
  if (!b.slotId || !b.serviceId || !b.name || !b.phone) {
    return send(res, 400, { error: 'Horário, serviço, nome e telefone são obrigatórios' });
  }
  const sql = db();

  const claimed = await sql`
    update slots set status = 'reservado'
    where id = ${b.slotId} and status = 'livre'
    returning *`;
  if (!claimed.length) {
    return send(res, 409, { error: 'Esse horário acabou de ser reservado. Escolha outro.' });
  }
  const slot = claimed[0];

  const service = (await sql`select * from services where id = ${b.serviceId} and active = true`)[0];
  if (!service) {
    await releaseSlot(sql, slot.id);
    return send(res, 400, { error: 'Serviço indisponível. Escolha outro.' });
  }

  const prof = (await sql`select * from professionals where id = ${slot.professional_id}`)[0];
  const startMin = toMin(slot.start_time);
  const endMin = startMin + Number(service.duration_min);

  if (prof && prof.hours) {
    const dow = new Date(String(slot.appt_date).slice(0, 10) + 'T12:00:00Z').getUTCDay();
    const hrs = prof.hours[dow];
    if (hrs && hrs[1] && endMin > toMin(hrs[1])) {
      await releaseSlot(sql, slot.id);
      return send(res, 409, { error: 'Este serviço termina depois do horário de atendimento. Escolha outro horário.' });
    }
  }

  const appts = await sql`
    select start_time, duration_min from appointments
    where professional_id = ${slot.professional_id} and appt_date = ${slot.appt_date} and status <> 'cancelado'`;
  const clash = appts.some((a) => {
    const as = toMin(a.start_time);
    const ae = as + Number(a.duration_min);
    return startMin < ae && endMin > as;
  });
  if (clash) {
    await releaseSlot(sql, slot.id);
    return send(res, 409, { error: 'Este serviço não cabe neste horário — há outro atendimento em andamento. Escolha outro horário.' });
  }

  let client = (await sql`select * from clients where phone = ${b.phone} order by created_at limit 1`)[0];
  if (!client) {
    const rows = await sql`
      insert into clients (name, phone, email, notes)
      values (${b.name}, ${b.phone}, '', 'Cadastro feito pelo agendamento online.')
      returning *`;
    client = rows[0];
  }

  let priceCents = Number(service.price_cents);
  let priceLabel = service.first_session_rule ? '1ª sessão' : '';
  if (service.first_session_rule) {
    const previous = (await sql`
      select 1 from appointments
      where client_id = ${client.id} and service_id = ${service.id} and status <> 'cancelado'
      limit 1`).length > 0;
    if (previous) {
      if (service.repeat_price_cents != null) {
        priceCents = Number(service.repeat_price_cents);
        priceLabel = 'A partir da 2ª sessão';
      } else {
        priceLabel = 'Valor a confirmar';
      }
    }
  }

  const apptRows = await sql`
    insert into appointments
      (client_id, service_id, service_name, professional_id, appt_date, start_time, duration_min, price_cents, status, is_fit_in, notes, slot_id)
    values (
      ${client.id}, ${service.id}, ${service.name}, ${slot.professional_id},
      ${slot.appt_date}, ${slot.start_time}, ${service.duration_min}, ${priceCents},
      'agendado', false, 'Reserva feita pela cliente pelo agendamento online.', ${slot.id}
    )
    returning *`;
  const appointment = apptRows[0];

  await sql`update slots set appointment_id = ${appointment.id} where id = ${slot.id}`;
  const slotRow = (await sql`select * from slots where id = ${slot.id}`)[0];

  send(res, 201, {
    appointment: mapAppointment(appointment),
    slot: mapSlot(slotRow),
    client: mapClient(client),
    priceLabel: priceLabel
  });
});
