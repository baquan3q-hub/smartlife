-- Remove the old constraint restricting priority to HIGH/MEDIUM/LOW
ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_priority_check;

-- Add new constraint with the 4 requested levels
ALTER TABLE public.todos ADD CONSTRAINT todos_priority_check 
CHECK (priority IN ('URGENT', 'FOCUS', 'CHILL', 'TEMP'));

-- Optional: Update existing rows to a default valid value to avoid violations if any
UPDATE public.todos SET priority = 'FOCUS' WHERE priority NOT IN ('URGENT', 'FOCUS', 'CHILL', 'TEMP');
