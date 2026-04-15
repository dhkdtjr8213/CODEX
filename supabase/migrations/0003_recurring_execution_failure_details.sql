alter table public.recurring_transaction_executions
  add column if not exists status text,
  add column if not exists error_message text;

update public.recurring_transaction_executions
set status = case when transaction_id is null then 'failed' else 'success' end
where status is null;

alter table public.recurring_transaction_executions
  alter column status set default 'success';

alter table public.recurring_transaction_executions
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recurring_exec_status_check'
  ) then
    alter table public.recurring_transaction_executions
      add constraint recurring_exec_status_check
      check (status in ('pending', 'success', 'failed'));
  end if;
end;
$$;

create index if not exists idx_recurring_exec_status
  on public.recurring_transaction_executions (status);

create or replace function public.run_due_recurring_transactions(p_limit integer default 100)
returns table (
  processed_count integer,
  created_count integer,
  advanced_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  execution_id uuid;
  created_transaction_id uuid;
  next_run timestamptz;
  v_processed integer := 0;
  v_created integer := 0;
  v_advanced integer := 0;
begin
  for item in
    select
      rt.id,
      rt.user_id,
      rt.type,
      rt.amount,
      rt.currency,
      rt.account_id,
      rt.category_id,
      rt.transfer_account_id,
      rt.description,
      rt.next_run_at
    from public.recurring_transactions rt
    where rt.is_active = true
      and rt.next_run_at <= timezone('utc', now())
    order by rt.next_run_at asc
    limit greatest(coalesce(p_limit, 100), 1)
  loop
    v_processed := v_processed + 1;

    insert into public.recurring_transaction_executions (
      recurring_transaction_id,
      user_id,
      scheduled_for,
      status
    )
    values (
      item.id,
      item.user_id,
      item.next_run_at,
      'pending'
    )
    on conflict (recurring_transaction_id, scheduled_for) do nothing
    returning id into execution_id;

    if execution_id is null then
      continue;
    end if;

    begin
      insert into public.transactions (
        user_id,
        type,
        amount,
        currency,
        occurred_at,
        description,
        account_id,
        category_id,
        transfer_account_id
      )
      values (
        item.user_id,
        item.type,
        item.amount,
        item.currency,
        item.next_run_at,
        coalesce(item.description, '반복거래 자동 생성'),
        item.account_id,
        case when item.type = 'transfer' then null else item.category_id end,
        case when item.type = 'transfer' then item.transfer_account_id else null end
      )
      returning id into created_transaction_id;

      v_created := v_created + 1;

      next_run := item.next_run_at + interval '1 month';

      update public.recurring_transactions
      set next_run_at = next_run
      where id = item.id;

      v_advanced := v_advanced + 1;

      update public.recurring_transaction_executions
      set
        transaction_id = created_transaction_id,
        status = 'success',
        error_message = null
      where id = execution_id;
    exception
      when others then
        update public.recurring_transaction_executions
        set
          status = 'failed',
          error_message = left(sqlerrm, 500)
        where id = execution_id;
    end;
  end loop;

  return query
  select v_processed, v_created, v_advanced;
end;
$$;

revoke all on function public.run_due_recurring_transactions(integer) from public;
revoke all on function public.run_due_recurring_transactions(integer) from anon;
revoke all on function public.run_due_recurring_transactions(integer) from authenticated;
grant execute on function public.run_due_recurring_transactions(integer) to service_role;
