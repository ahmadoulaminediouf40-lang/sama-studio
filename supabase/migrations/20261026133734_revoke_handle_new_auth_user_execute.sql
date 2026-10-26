-- Restrict direct API access to the auth.users trigger function.
-- The trigger still invokes this function when a user signs up.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
