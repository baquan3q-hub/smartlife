-- Add new columns for enhanced event details
alter table "calendar_events" 
add column if not exists "time" time,
add column if not exists "location" text;

-- Update RLS if necessary (already covers all rows for user, so 'select *' handles new columns automatically)
