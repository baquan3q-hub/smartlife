-- 4. Create Goals Table (Mục tiêu)
create table if not exists public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  deadline date not null,
  type text check (type in ('SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM')),
  progress integer default 0,
  target_value numeric, -- Optional: target amount if financial goal
  current_value numeric,
  color text, -- For UI styling
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.goals enable row level security;

drop policy if exists "Subjective goals" on public.goals;
create policy "Users manage their goals" on public.goals
  for all using (auth.uid() = user_id);


-- 5. Create Timetable Table (Thời khóa biểu cố định)
create table if not exists public.timetable (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sun, 1=Mon...
  start_time time not null,
  end_time time,
  location text,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.timetable enable row level security;

drop policy if exists "Subjective timetable" on public.timetable;
create policy "Users manage their timetable" on public.timetable
  for all using (auth.uid() = user_id);


-- 6. Create Todos Table (Todo List hàng ngày)
create table if not exists public.todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  content text not null,
  is_completed boolean default false,
  scheduled_date date default CURRENT_DATE,
  scheduled_time time, -- Optional specific time
  priority text check (priority in ('HIGH', 'MEDIUM', 'LOW')) default 'MEDIUM',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.todos enable row level security;

drop policy if exists "Subjective todos" on public.todos;
create policy "Users manage their todos" on public.todos
  for all using (auth.uid() = user_id);
