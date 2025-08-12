-- Remove the automatic profile creation trigger
-- This gives us full control over user creation in the edge function

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();