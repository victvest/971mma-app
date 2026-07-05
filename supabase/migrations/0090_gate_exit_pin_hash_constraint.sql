-- Gate exit PIN must be stored as a bcrypt hash, never plaintext.

comment on column public.gate_settings.exit_pin_hash is
  'Bcrypt hash of the 4-digit exit PIN (pgcrypto crypt/gen_salt). Never store plaintext.';

alter table public.gate_settings
  drop constraint if exists gate_settings_exit_pin_hash_bcrypt;

alter table public.gate_settings
  add constraint gate_settings_exit_pin_hash_bcrypt
  check (
    exit_pin_hash is null
    or (
      exit_pin_hash ~ '^\$2[aby]\$\d{2}\$'
      and length(exit_pin_hash) >= 59
    )
  );
