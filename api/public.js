import { db, handler, send, mapService, mapProfessional, mapSlot } from './_db.js';

// Endpoint público: só o necessário para a cliente agendar.
// Não devolve clientes, agendamentos nem qualquer dado pessoal.
export default handler(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });

  const sql = db();
  const [services, professionals, slots] = await Promise.all([
    sql`select * from services where active = true order by category, name`,
    sql`select id, name, role, color, active, hours from professionals where active = true order by name`,
    sql`select * from slots where status = 'livre' and appt_date >= current_date order by appt_date, start_time`
  ]);

  let needsSetup = false;
  try {
    const r = await sql`select count(*)::int as n from admins`;
    needsSetup = r[0].n === 0;
  } catch (e) { /* tabela ainda não criada: segue com login normal */ }

  send(res, 200, {
    source: 'amorim-beauty-neon',
    needsSetup: needsSetup,
    services: services.map(mapService),
    professionals: professionals.map(mapProfessional),
    slots: slots.map(mapSlot)
  });
});
