create table if not exists public.recurring_transaction_executions (
  id uuid primary key default gen_random_uuid(),
  recurring_transaction_id uuid not null references public.recurring_transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  executed_at timestamptz not null default timezone('utc', now()),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (recurring_transaction_id, scheduled_for)
);

create index if not exists idx_recurring_exec_user_id on public.recurring_transaction_executions (user_id);
create index if not exists idx_recurring_exec_scheduled_for on public.recurring_transaction_executions (scheduled_for);

alter table public.recurring_transaction_executions enable row level security;

drop policy if exists "recurring_exec_select_own" on public.recurring_transaction_executions;
create policy "recurring_exec_select_own" on public.recurring_transaction_executions
for select using (auth.uid() = user_id);

drop policy if exists "recurring_exec_insert_own" on public.recurring_transaction_executions;
create policy "recurring_exec_insert_own" on public.recurring_transaction_executions
for insert with check (auth.uid() = user_id);

drop policy if exists "recurring_exec_update_own" on public.recurring_transaction_executions;
create policy "recurring_exec_update_own" on public.recurring_transaction_executions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
      scheduled_for
    )
    values (
      item.id,
      item.user_id,
      item.next_run_at
    )
    on conflict (recurring_transaction_id, scheduled_for) do nothing
    returning id into execution_id;

    if execution_id is null then
      continue;
    end if;

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
    set transaction_id = created_transaction_id
    where id = execution_id;
  end loop;

  return query
  select v_processed, v_created, v_advanced;
end;
$$;

revoke all on function public.run_due_recurring_transactions(integer) from public;
revoke all on function public.run_due_recurring_transactions(integer) from anon;
revoke all on function public.run_due_recurring_transactions(integer) from authenticated;
grant execute on function public.run_due_recurring_transactions(integer) to service_role;
