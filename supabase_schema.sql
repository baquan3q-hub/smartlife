-- SAFE SCRIPT (Có thể chạy nhiều lần không lỗi)

-- 1. Bảng Profiles (Nếu chưa có thì tạo)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

alter table public.profiles enable row level security;

-- Xóa policies cũ để tạo lại (tránh lỗi trùng tên)
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- 2. Bảng Transactions (Nếu chưa có thì tạo)
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  amount numeric not null,
  category text not null,
  date date not null,
  type text not null check (type in ('INCOME', 'EXPENSE')),
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.transactions enable row level security;

-- Xóa policies cũ
drop policy if exists "Users can view their own transactions" on public.transactions;
drop policy if exists "Users can insert their own transactions" on public.transactions;
drop policy if exists "Users can update their own transactions" on public.transactions;
drop policy if exists "Users can delete their own transactions" on public.transactions;

-- Tạo policies mới
create policy "Users can view their own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Users can insert their own transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update their own transactions" on public.transactions for update using (auth.uid() = user_id);
create policy "Users can delete their own transactions" on public.transactions for delete using (auth.uid() = user_id);

-- 3. Trigger (Nếu lỡ chạy rồi thì lệnh này sẽ đè cái cũ - OK)
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger này nếu đã có rồi thì drop đi tạo lại cho chắc
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- 4. B?ng Goals (M?c ti�u)
create table if not exists public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  target_amount numeric default 0, -- S? ti?n m?c ti�u (cho t�i ch�nh)
  current_amount numeric default 0, -- S? ti?n d� ti?t ki?m du?c
  deadline date, -- H?n ch�t
  type text default 'PERSONAL', -- Lo?i: FINANCIAL, PERSONAL
  term text check (term in ('SHORT', 'MEDIUM', 'LONG')), -- Ng?n h?n, Trung h?n, D�i h?n
  is_priority boolean default false, -- Uu ti�n
  progress integer default 0, -- % ho�n th�nh (c� th? t�nh to�n ho?c luu tr?)
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.goals enable row level security;

-- Policies cho Goals
drop policy if exists "Users can view their own goals" on public.goals;
drop policy if exists "Users can insert their own goals" on public.goals;
drop policy if exists "Users can update their own goals" on public.goals;
drop policy if exists "Users can delete their own goals" on public.goals;

create policy "Users can view their own goals" on public.goals for select using (auth.uid() = user_id);
create policy "Users can insert their own goals" on public.goals for insert with check (auth.uid() = user_id);
create policy "Users can update their own goals" on public.goals for update using (auth.uid() = user_id);
create policy "Users can delete their own goals" on public.goals for delete using (auth.uid() = user_id);
