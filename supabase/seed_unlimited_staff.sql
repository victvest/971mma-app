-- Seed script for 29 Unlimited Access VIP Staff / Coaches / Owners
do $$
declare
  v_staff record;
  v_user_id uuid;
  v_expires_at timestamptz := '2099-12-31 23:59:59+00'::timestamptz;
  v_admin_id uuid;
begin
  select id into v_admin_id from public.profiles where role = 'admin' limit 1;

  create temp table temp_seed_staff (
    full_name text,
    role_title text,
    phone text,
    email text
  ) on commit drop;

  insert into temp_seed_staff (full_name, role_title, phone, email) values
    ('Wellington Pereira', 'MMA Coach', '+971547997215', 'wellingtonlobokm21@gmail.com'),
    ('Carl Booth', 'Muay Thai Coach', '+971555811970', 'carlbomberbooth@gmail.com'),
    ('Mohammadali Geraei', 'Wrestling Coach', '+971561576667', 'mohammadali.geraei@gmail.com'),
    ('Amin Ebrahim Ghaffaryan', 'Wrestling Coach', '+971585532141', 'amin.ghaffarii92@gmail.com'),
    ('Ahmad Bouti', 'MMA Teens Coach', '+971558009724', 'ahmadboouti@gmail.com'),
    ('SeyedMilad Hosseini', '971 Freelancer coach', '+971567594223', 'miladhoseini695@gmail.com'),
    ('SeyedMilad Hosseini', '971 Freelancer coach', '+971567594223', 'milad.hoseini1@icloud.com'),
    ('Wagner Gabriel Silva', 'BJJ Coach', '+971553950989', 'wagnergabriel038@gmail.com'),
    ('Rogerio Alves Filho', 'BJJ Coach', '+971521660291', 'rogerioalvezdaluz@gmail.com'),
    ('Shanika Perera', 'Accountant', '+971558726449', 'Shanikaperera913@gmail.com'),
    ('Sarah Areeb', 'Customer Service', '+971543026601', 'sarahq_18@hotmail.com'),
    ('Joanna Blanas', 'Front Desk', '+971506634733', 'jhoblanas@gmail.com'),
    ('Bhen Parado', 'Front Desk', '+971502141459', 'paradobhen@gmail.com'),
    ('Bhen Parado', 'Front Desk', '+971502141459', 'bhen@971mma.com'),
    ('Imesh Indira', 'Maintenance', '+971524936940', 'indiraimesh@gmail.com'),
    ('Imesh Indira', 'Maintenance', '+971524936940', 'imeshindirathrimana@gmail.com'),
    ('Ishan Chamara', 'Maintenance', '+94554695225', 'ishanchamara303@gmail.com'),
    ('Gayuth Nethmira', 'Maintenance', '+94743361226', 'gayuthgayuth702@gmail.com'),
    ('Satisha Kavindi Gamage', 'Maintenance', '+971541629769', 'sathishakavindi7@gmail.com'),
    ('Bhim Bahdur Panday', 'Barista', '+971545885723', 'bhimbpanday69@gmail.com'),
    ('Bhim Bahdur Panday', 'Barista', '+971545885723', 'bhimbpandey69@gmail.com'),
    ('Raj Kumar Khatri', 'Barista', '+9770545618004', 'raazxhetri800@icloud.com'),
    ('Franzelle Mae Landicho', 'Barista', '+971561400817', 'franzellemae25@gmail.com'),
    ('Armin Bahrami', '971 Manager', '+971507343313', 'armin.eric68@gmail.com'),
    ('Wajid Khan', 'Valet Driver', '+971505573251', 'wajidkhan_2002@gmail.com'),
    ('Wajid Khan', 'Valet Driver', '+971505573251', 'itswajid728@gmail.com'),
    ('Muhammad Asad Qureshi', 'Valet Driver', '+971556044940', 'chotaasad11@gmail.com'),
    ('Muhammad Asad Qureshi', 'Valet Driver', '+971556044940', 'chotaasadkhan11@gmail.com'),
    ('Karim Ullah', 'Valet Driver', '+971547071316', 'ukarim0123@gmail.com'),
    ('Roshan Madusanka', 'HO', '+971528081740', 'roshan.msnk@gmail.com'),
    ('Ruwan Tharanga Perera', 'HO', '+971581124190', 'Ruwantharanga2oilve@gmail.com'),
    ('Ruwan Tharanga Perera', 'HO', '+971581124190', 'ruwantharanga20live@gmail.com'),
    ('Dilshan Mandal', 'HO', '+971521636449', 'Guvindudilshan2@gmail.com'),
    ('Roza Yagoub Pour', 'Owner', '+971505281642', 'rozamlaw@gmail.com'),
    ('Reza Pour', 'Owner', '+971508599188', 'rezap@gmail.com'),
    ('Rawan Youssef', 'HR Manager', '+971565207927', 'rowansalah1@gmail.com');

  for v_staff in select * from temp_seed_staff loop
    select id into v_user_id from auth.users where lower(email) = lower(v_staff.email);

    if v_user_id is null then
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        lower(v_staff.email),
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_staff.full_name, 'email', lower(v_staff.email)),
        now(),
        now()
      ) returning id into v_user_id;
    end if;

    insert into public.profiles (
      id,
      full_name,
      phone,
      role,
      membership_status,
      membership_name,
      membership_source,
      membership_expires_at,
      membership_last_synced_at
    ) values (
      v_user_id,
      v_staff.full_name,
      v_staff.phone,
      'member',
      'active',
      v_staff.role_title,
      'unlimited',
      v_expires_at,
      now()
    )
    on conflict (id) do update set
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      phone = coalesce(public.profiles.phone, excluded.phone),
      membership_status = 'active',
      membership_name = excluded.membership_name,
      membership_source = 'unlimited',
      membership_expires_at = v_expires_at,
      membership_last_synced_at = now();

    insert into public.unlimited_access_members (
      user_id,
      reason,
      is_active,
      granted_by,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_staff.role_title,
      true,
      v_admin_id,
      now(),
      now()
    )
    on conflict (user_id) do update set
      reason = excluded.reason,
      is_active = true,
      updated_at = now();

    insert into public.member_memberships (
      user_id,
      record_kind,
      mindbody_record_id,
      name,
      status,
      start_date,
      end_date,
      auto_renew,
      source,
      last_synced_at
    ) values (
      v_user_id,
      'membership',
      'vip-' || v_user_id::text,
      v_staff.role_title,
      'active',
      now(),
      v_expires_at,
      true,
      'mindbody',
      now()
    )
    on conflict (user_id, record_kind, mindbody_record_id) do update set
      name = excluded.name,
      status = 'active',
      end_date = v_expires_at,
      auto_renew = true,
      last_synced_at = now();

  end loop;

  for v_user_id in
    select id from auth.users where email = 'fps84z54dj@privaterelay.appleid.com'
  loop
    insert into public.unlimited_access_members (user_id, reason, is_active, granted_by, created_at, updated_at)
    values (v_user_id, 'Accountant', true, v_admin_id, now(), now())
    on conflict (user_id) do update set reason = 'Accountant', is_active = true, updated_at = now();

    update public.profiles
    set
      membership_status = 'active',
      membership_name = 'Accountant',
      membership_source = 'unlimited',
      membership_expires_at = v_expires_at
    where id = v_user_id;

    insert into public.member_memberships (
      user_id,
      record_kind,
      mindbody_record_id,
      name,
      status,
      start_date,
      end_date,
      auto_renew,
      source,
      last_synced_at
    ) values (
      v_user_id,
      'membership',
      'vip-' || v_user_id::text,
      'Accountant',
      'active',
      now(),
      v_expires_at,
      true,
      'mindbody',
      now()
    )
    on conflict (user_id, record_kind, mindbody_record_id) do update set
      status = 'active',
      end_date = v_expires_at,
      auto_renew = true;
  end loop;

end;
$$;
