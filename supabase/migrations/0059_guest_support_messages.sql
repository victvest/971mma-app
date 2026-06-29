-- Allow anonymous guest contact submissions from Help & support.

alter table public.support_messages
  add column if not exists contact_name text;

alter table public.support_messages
  alter column user_id drop not null;

create or replace function public.submit_guest_support_message(
  p_category text,
  p_subject text,
  p_message text,
  p_contact_email text,
  p_contact_name text
)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_subject text;
  v_message text;
  v_email text;
  v_name text;
  v_open_count int;
  v_row public.support_messages;
begin
  if auth.uid() is not null then
    raise exception using message = 'USE_MEMBER_SUBMIT', errcode = 'P0001';
  end if;

  v_category := coalesce(nullif(trim(p_category), ''), 'general');
  if v_category not in ('general', 'membership', 'billing', 'technical', 'classes', 'feedback') then
    v_category := 'general';
  end if;

  v_subject := nullif(trim(p_subject), '');
  v_message := nullif(trim(p_message), '');
  v_email := nullif(trim(p_contact_email), '');
  v_name := nullif(trim(p_contact_name), '');

  if v_name is null then
    raise exception using message = 'CONTACT_NAME_REQUIRED', errcode = 'P0001';
  end if;

  if v_email is null then
    raise exception using message = 'CONTACT_EMAIL_REQUIRED', errcode = 'P0001';
  end if;

  if v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception using message = 'CONTACT_EMAIL_INVALID', errcode = 'P0001';
  end if;

  if v_subject is null then
    raise exception using message = 'SUBJECT_REQUIRED', errcode = 'P0001';
  end if;

  if v_message is null then
    raise exception using message = 'MESSAGE_REQUIRED', errcode = 'P0001';
  end if;

  if length(v_subject) > 120 then
    v_subject := left(v_subject, 120);
  end if;

  if length(v_message) > 2000 then
    raise exception using message = 'MESSAGE_TOO_LONG', errcode = 'P0001';
  end if;

  select count(*) into v_open_count
  from public.support_messages
  where user_id is null
    and lower(contact_email) = lower(v_email)
    and status in ('open', 'in_progress');

  if v_open_count >= 5 then
    raise exception using message = 'TOO_MANY_OPEN_MESSAGES', errcode = 'P0001';
  end if;

  insert into public.support_messages (user_id, category, subject, message, contact_email, contact_name)
  values (null, v_category, v_subject, v_message, lower(v_email), v_name)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_guest_support_message(text, text, text, text, text) from public;
grant execute on function public.submit_guest_support_message(text, text, text, text, text) to anon;
