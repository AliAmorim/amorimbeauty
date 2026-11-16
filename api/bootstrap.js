import { db, handler, send, mapClient, mapService, mapProfessional, mapAppointment, mapSlot } from './_db.js';
import { requireAdmin } from './_auth.js';

export default handler(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });
  if (!requireAdmin(req, res)) return;

  const sql = db();
  const [clients, services, professionals, appointments, slots] = await Promise.all([
    sql`select * from clients order by name`,
    sql`select * from services order by category, name`,
    sql`select * from professionals order by name`,
    sql`select * from appointments order by appt_date, start_time`,
    sql`select * from slots order by appt_date, start_time`
  ]);

  send(res, 200, {
    clients: clients.map(mapClient),
    services: services.map(mapService),
    professionals: professionals.map(mapProfessional),
    appointments: appointments.map(mapAppointment),
    slots: slots.map(mapSlot)
  });
});
