-- Update expense_date column to timestamptz to support time selection
-- This allows expenses to be recorded with specific times, not just dates

-- Update the expense_date column to timestamptz
ALTER TABLE expenses 
ALTER COLUMN expense_date TYPE timestamptz USING expense_date::timestamptz;

-- Update the index to reflect the new column type
DROP INDEX IF EXISTS idx_expenses_expense_date;
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);

-- Add comment to document the change
COMMENT ON COLUMN expenses.expense_date IS 'Date and time when the expense occurred (timestamptz)';