-- Create a table for Calendar Events (Holidays, Special Occasions)
create table if not exists calendar_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  date date not null, -- Solar date for simplicity, or we can add lunar columns if needed for recurring lunar events
  type text check (type in ('HOLIDAY', 'PERSONAL', 'WORK')) default 'PERSONAL',
  is_lunar boolean default false, -- If true, the date is a lunar date (recurring every year based on lunar calendar)
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table calendar_events enable row level security;

create policy "Users can view their own events"
  on calendar_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own events"
  on calendar_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own events"
  on calendar_events for update
  using (auth.uid() = user_id);

create policy "Users can delete their own events"
  on calendar_events for delete
  using (auth.uid() = user_id);

-- Insert some default Vietnamese Public Holidays (Solar) for everyone (System level - optional)
-- You might want a separate table for system holidays or just insert them as 'HOLIDAY' with null user_id if you want them public.
-- For this simplified version, let's assume we handle global holidays in the frontend code (lunar-javascript has some built-in)
-- or we insert them per user.

-- Example: Insert a test event
-- insert into calendar_events (user_id, title, date, type) values ('<USER_ID>', 'Họp Team', '2025-01-15', 'WORK');
