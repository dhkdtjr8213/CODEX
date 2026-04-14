create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_currency text not null default 'KRW' check (default_currency = 'KRW'),
  locale text not null default 'ko-KR' check (locale = 'ko-KR'),
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'card', 'investment', 'other')),
  currency text not null default 'KRW' check (currency = 'KRW'),
  balance numeric(14, 0) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#1c7c54',
  icon text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(14, 0) not null check (amount >= 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  occurred_at timestamptz not null,
  description text,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  transfer_account_id uuid references public.accounts(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transfer_account_not_same check (
    transfer_account_id is null or transfer_account_id <> account_id
  )
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(14, 0) not null check (amount >= 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  period text not null default 'monthly' check (period in ('monthly')),
  month text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, category_id, month)
);

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(14, 0) not null check (amount >= 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  frequency text not null default 'monthly' check (frequency in ('monthly')),
  next_run_at timestamptz not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  transfer_account_id uuid references public.accounts(id) on delete restrict,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_transfer_account_not_same check (
    transfer_account_id is null or transfer_account_id <> account_id
  )
);

create index if not exists idx_accounts_user_id on public.accounts (user_id);
create index if not exists idx_categories_user_id_kind on public.categories (user_id, kind);
create index if not exists idx_transactions_user_id_occurred_at on public.transactions (user_id, occurred_at desc);
create index if not exists idx_transactions_account_id on public.transactions (account_id);
create index if not exists idx_budgets_user_id_month on public.budgets (user_id, month);
create index if not exists idx_recurring_transactions_user_id_next_run_at on public.recurring_transactions (user_id, next_run_at);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

drop trigger if exists set_recurring_transactions_updated_at on public.recurring_transactions;
create trigger set_recurring_transactions_updated_at
before update on public.recurring_transactions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_transactions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
for select using (auth.uid() = user_id);

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts
for insert with check (auth.uid() = user_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts
for delete using (auth.uid() = user_id);

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
for delete using (auth.uid() = user_id);

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
for insert with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
for delete using (auth.uid() = user_id);

drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
for select using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
for insert with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
for delete using (auth.uid() = user_id);

drop policy if exists "recurring_transactions_select_own" on public.recurring_transactions;
create policy "recurring_transactions_select_own" on public.recurring_transactions
for select using (auth.uid() = user_id);

drop policy if exists "recurring_transactions_insert_own" on public.recurring_transactions;
create policy "recurring_transactions_insert_own" on public.recurring_transactions
for insert with check (auth.uid() = user_id);

drop policy if exists "recurring_transactions_update_own" on public.recurring_transactions;
create policy "recurring_transactions_update_own" on public.recurring_transactions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurring_transactions_delete_own" on public.recurring_transactions;
create policy "recurring_transactions_delete_own" on public.recurring_transactions
for delete using (auth.uid() = user_id);
