import { handler, send, readBody } from './_db.js';
import { checkCredentials, makeToken, authConfigured } from './_auth.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });
  if (!authConfigured()) {
    return send(res, 503, { error: 'AUTH_SECRET não está configurada na Vercel.' });
  }
  const b = await readBody(req);
  const admin = await checkCredentials(b.email, b.password);
  if (!admin) return send(res, 401, { error: 'E-mail ou senha incorretos.' });
  send(res, 200, { token: makeToken(admin.email), name: admin.name });
});
