-- Fix broken auth.users fields from raw SQL seeds (empty string password hashes, missing metadata)
update auth.users
set
  encrypted_password = case
    when encrypted_password = '' then null
    else encrypted_password
  end,
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'sub', id::text,
    'email_verified', true,
    'phone_verified', false
  )
where encrypted_password = ''
   or confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or not (raw_user_meta_data ? 'sub');

-- Fix missing auth.identities records for any auth.users
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  u.last_sign_in_at,
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
from auth.users u
where not exists (
  select 1 from auth.identities i where i.user_id = u.id
);
