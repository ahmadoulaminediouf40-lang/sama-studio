-- Enable self-service publication during an active trial/subscription.
-- Existing organizations keep their current account status; new organizations start in their
-- 14-day trial without waiting for a manual account activation.
begin;
alter table public.organizations alter column account_status set default 'active';
alter table public.organizations alter column activated_at set default now();
commit;
