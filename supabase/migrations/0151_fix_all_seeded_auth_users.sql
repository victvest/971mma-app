-- Fix all remaining seeded auth.users records that have empty encrypted_password or null token strings
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
