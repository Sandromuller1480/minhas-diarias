# Minhas Diárias de Pintura

Aplicativo pessoal e privado de Sandro Müller para registrar diárias de pintura, acompanhar pagamentos, gerar relatórios e emitir demonstrativos em PDF para contratantes.

## Stack

- React + TypeScript + Vite.
- Tailwind CSS 4.
- Supabase Auth, PostgreSQL, RLS, Edge Functions e Cron.
- PWA com manifest e Service Worker.
- PDF no navegador com `jspdf` e `jspdf-autotable`.

## Rodar localmente

```bash
npm install
npm run dev
```

Sem variáveis Supabase, o app roda em modo local para validar fluxos. Esse modo é identificado na interface e não substitui a produção.

## Variáveis

Copie `.env.example` para `.env.local` e preencha:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTHORIZED_OWNER_ID`
- `VITE_VAPID_PUBLIC_KEY`

Segredos como `SUPABASE_SERVICE_ROLE_KEY`, `REMINDER_JOB_SECRET` e `VAPID_PRIVATE_KEY` ficam somente nas Edge Functions do Supabase.

## Supabase

1. Crie o projeto Supabase.
2. Aplique as migrações em `supabase/migrations`.
3. Crie a conta única de Sandro em Authentication.
4. Insira o UUID autorizado:

```sql
insert into public.app_settings (id, authorized_owner_id)
values (true, 'UUID_DA_CONTA_DO_SANDRO')
on conflict (id) do update set authorized_owner_id = excluded.authorized_owner_id;
```

5. Crie o perfil:

```sql
insert into public.profiles (owner_id, professional_name, default_daily_rate_cents, timezone)
values ('UUID_DA_CONTA_DO_SANDRO', 'Sandro Müller', 0, 'America/Cuiaba')
on conflict (owner_id) do nothing;
```

6. Desative cadastro público no painel do Supabase: Authentication > Providers > Email > Disable sign ups.

As políticas RLS exigem sessão válida e UUID autorizado. A tabela `app_settings` não tem política pública.

## Lembretes

Configure a Edge Function `send-reminders` com os segredos:

- `SUPABASE_SERVICE_ROLE_KEY`
- `REMINDER_JOB_SECRET`
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Depois publique:

```bash
supabase functions deploy send-reminders
```

Agende pelo Supabase Cron conforme o comentário em `202610050002_rpc_and_cron.sql`. O job pode rodar a cada poucos minutos; a função decide se no fuso do proprietário já são 12h ou 18h. O recebimento depende de internet, permissão do navegador, economia de bateria e suporte do aparelho.

## Vercel

Importe o repositório privado no Vercel como projeto Vite. Use:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables públicas iguais ao `.env.example`.

O fallback de rotas é tratado pelo PWA/Vite. Se necessário, adicione rewrite para `/index.html` no painel da Vercel.

## Backup

A tela Ajustes exporta JSON com perfil, contratantes, obras, lançamentos, pagamentos, alocações e inscrições push. O arquivo não inclui senhas nem segredos. A restauração valida o cabeçalho do formato e deve ser feita com cuidado para evitar duplicatas em produção.

## Validação

```bash
npm run lint
npm run test
npm run build
```

Testes cobrem divisão da diária, centavos ímpares, equivalência de diárias e saldo com pagamento atribuído. Testes de RLS, Cron e entrega Web Push precisam ser executados no Supabase real e no celular de Sandro.
