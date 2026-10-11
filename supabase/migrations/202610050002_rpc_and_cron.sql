create or replace function public.upsert_work_periods(payload jsonb)
returns setof public.work_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid := (select auth.uid());
  work_day date := (payload->>'work_date')::date;
  period_list text[] := case when payload->>'period' = 'full' then array['morning','afternoon'] else array[payload->>'period'] end;
  project uuid := nullif(payload->>'project_id', '')::uuid;
  status_value text := payload->>'status';
  daily_rate integer;
  period_value text;
  amount integer;
begin
  if owner is null or not public.is_authorized_owner(owner) then
    raise exception 'not authorized';
  end if;

  select coalesce(p.daily_rate_cents, pr.default_daily_rate_cents)
    into daily_rate
  from public.projects p
  join public.profiles pr on pr.owner_id = p.owner_id
  where p.owner_id = owner and p.id = project;

  if status_value = 'off' then
    daily_rate := 0;
    project := null;
  end if;

  if exists (
    select 1
    from public.work_entries e
    join public.payment_allocations a on a.owner_id = e.owner_id and a.work_entry_id = e.id
    where e.owner_id = owner and e.work_date = work_day and e.period = any(period_list)
  ) then
    raise exception 'period has allocated payment';
  end if;

  delete from public.work_entries where owner_id = owner and work_date = work_day and period = any(period_list);

  foreach period_value in array period_list loop
    amount := case
      when status_value <> 'worked' then 0
      when payload ? 'manual_amount_cents' then (payload->>'manual_amount_cents')::integer
      when period_value = 'morning' then ceil(daily_rate / 2.0)::integer
      else daily_rate - ceil(daily_rate / 2.0)::integer
    end;

    insert into public.work_entries (
      owner_id, project_id, work_date, period, status, applied_daily_rate_cents, amount_cents,
      manual_amount_cents, manual_reason, private_note, shareable_description
    )
    values (
      owner, project, work_day, period_value, status_value, daily_rate, amount,
      nullif(payload->>'manual_amount_cents', '')::integer,
      payload->>'manual_reason',
      payload->>'private_note',
      payload->>'shareable_description'
    );
  end loop;

  return query select * from public.work_entries where owner_id = owner and work_date = work_day and period = any(period_list);
end;
$$;

create or replace function public.schedule_reminder_jobs(function_url text, job_secret text)
returns void
language plpgsql
security definer
as $$
begin
  perform cron.unschedule('minhas-diarias-reminders-12h');
  perform cron.unschedule('minhas-diarias-reminders-18h');
exception when others then
  null;
end;
$$;

-- Execute in Supabase SQL editor after setting secrets in Vault:
-- select cron.schedule(
--   'minhas-diarias-reminders-12h',
--   '*/5 * * * *',
--   $$ select net.http_post(
--     url := '<SUPABASE_FUNCTION_URL>/send-reminders',
--     headers := jsonb_build_object('Authorization', 'Bearer <JOB_SECRET>', 'Content-Type', 'application/json'),
--     body := jsonb_build_object('target_hours', jsonb_build_array(12))
--   ); $$
-- );
-- Repeat for 18h with target_hours [18]. The Edge Function checks each profile timezone.
