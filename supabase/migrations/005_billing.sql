-- subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  plan text not null default 'free',
  stripe_customer_id text,
  razorpay_customer_id text,
  stripe_subscription_id text,
  razorpay_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;

-- usage table
create table public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  period_month text not null,
  audio_minutes_used numeric(10,2) not null default 0,
  bonus_minutes numeric(10,2) not null default 0,
  updated_at timestamptz default now(),
  unique(user_id, period_month)
);
create index on public.usage (user_id, period_month);
alter table public.usage enable row level security;
