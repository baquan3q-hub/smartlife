-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. behavior_logs: Traking granular actions
create table if not exists behavior_logs (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    action_type text not null, -- 'FOCUS_SESSION', 'EARLY_WAKEUP', 'IMPULSE_BUY'
    value numeric, -- duration in mins, amount, etc.
    context jsonb, -- { "mood": "TIRED", "location": "OFFICE" }
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. daily_snapshots: Aggregated daily data for analysis
create table if not exists daily_snapshots (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    date date not null,
    total_spent numeric default 0,
    total_focus_minutes numeric default 0,
    mood_score int, -- 1-10
    energy_level int, -- 1-10
    compliance_score int, -- % of tasks completed
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(user_id, date)
);

-- 3. smart_insights: Generated recommendations for the user
create table if not exists smart_insights (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    type text not null, -- 'FINANCE_WARNING', 'HABIT_KUDOS', 'SCHEDULE_OPTIMIZATION', 'NUDGE'
    message text not null,
    action_link text,
    is_read boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Policies (RLS)
alter table behavior_logs enable row level security;
alter table daily_snapshots enable row level security;
alter table smart_insights enable row level security;

-- Policy: Users can only see/edit their own data
create policy "Users can view own behavior_logs" on behavior_logs for select using (auth.uid() = user_id);
create policy "Users can insert own behavior_logs" on behavior_logs for insert with check (auth.uid() = user_id);

create policy "Users can view own daily_snapshots" on daily_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert/update own daily_snapshots" on daily_snapshots for all using (auth.uid() = user_id);

create policy "Users can view own smart_insights" on smart_insights for select using (auth.uid() = user_id);
create policy "Users can update own smart_insights" on smart_insights for update using (auth.uid() = user_id);
