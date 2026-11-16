-- Amorim Beauty · dados iniciais para PRODUÇÃO (idempotente)
-- Rode depois do schema.sql no SQL Editor do Neon. Pode repetir sem duplicar.

-- Profissional: apenas a administradora. Sem funcionários de exemplo.
-- A CONTA DE LOGIN não é criada aqui: cadastre na tela "Primeiro acesso" do site.
insert into professionals (id, name, role, color, phone, active, hours) values
('a0000000-0000-4000-8000-000000000001', 'Geovana Amorim', 'Administradora', 'rose', '', true,
 '{"0":null,"1":["09:00","19:00"],"2":["09:00","19:00"],"3":["09:00","19:00"],"4":["09:00","19:00"],"5":["09:00","19:00"],"6":["09:00","15:00"]}'::jsonb)
on conflict (id) do nothing;

-- Catálogo e valores importados de valores.xlsx (em centavos).
-- A planilha não traz duração: os minutos são estimativa operacional, editável em Serviços.
-- Hidra Gloss: R$ 120,00 vale só na 1ª sessão. repeat_price_cents fica NULL até
-- a administração definir o valor reduzido das sessões seguintes em Serviços.
insert into services (id, name, category, duration_min, price_cents, repeat_price_cents, first_session_rule, active) values
('b0000000-0000-4000-8000-000000000001', 'Massagem Relaxante', 'Massagens', 60, 10000, null, false, true),
('b0000000-0000-4000-8000-000000000002', 'Drenagem Linfática', 'Massagens', 60, 10000, null, false, true),
('b0000000-0000-4000-8000-000000000003', 'Drenagem Linfática Facial', 'Estética facial', 45, 5000, null, false, true),
('b0000000-0000-4000-8000-000000000004', 'Limpeza de Pele', 'Estética facial', 75, 12000, null, false, true),
('b0000000-0000-4000-8000-000000000005', 'Design', 'Sobrancelhas', 45, 4000, null, false, true),
('b0000000-0000-4000-8000-000000000006', 'Design com henna', 'Sobrancelhas', 60, 4500, null, false, true),
('b0000000-0000-4000-8000-000000000007', 'Design com tintura', 'Sobrancelhas', 45, 5000, null, false, true),
('b0000000-0000-4000-8000-000000000008', 'Buço na linha', 'Sobrancelhas', 15, 1500, null, false, true),
('b0000000-0000-4000-8000-000000000009', 'Hidra Gloss', 'Estética facial', 60, 12000, null, true, true)
on conflict (id) do nothing;

-- Base de produção começa limpa:
--   nenhum cliente, nenhum agendamento e NENHUM horário liberado de exemplo.
-- Libere os horários reais em Administração → Disponibilidade → "Liberar horários".
