-- Gamification production readiness:
-- 1. Restore multi-discipline belt recompute on check-in (fix 0063 regression)
-- 2. Member in-app notifications for milestones and promotions
-- 3. Ship-ready milestone copy + bonus points; hide placeholder rewards
-- 4. Admin can edit milestone points_award and description

-- ---------------------------------------------------------------------------
-- Member engagement notifications
-- ---------------------------------------------------------------------------

create or replace function public.notify_member_milestone(
  p_user uuid,
  p_milestone_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_name text;
  v_points_award int;
  v_key text;
begin
  if p_user is null or p_milestone_id is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_user, 'milestone'), true) then
    return;
  end if;

  v_key := 'member_milestone:' || p_user::text || ':' || p_milestone_id::text;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_user
      and n.type = 'milestone'
      and n.payload->>'idempotencyKey' = v_key
  ) then
    return;
  end if;

  select m.name, m.points_award
    into v_milestone_name, v_points_award
  from public.milestones m
  where m.id = p_milestone_id;

  if not found then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user,
    'milestone',
    jsonb_build_object(
      'title', 'Milestone unlocked',
      'body', coalesce(v_milestone_name, 'New milestone')
        || case
          when coalesce(v_points_award, 0) > 0
            then ' · +' || v_points_award::text || ' points'
          else ''
        end,
      'milestoneId', p_milestone_id,
      'milestoneName', v_milestone_name,
      'pointsAward', coalesce(v_points_award, 0),
      'url', '/(tabs)/rewards',
      'idempotencyKey', v_key
    )
  );
end;
$$;

create or replace function public.notify_member_promotion(
  p_user uuid,
  p_promotion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank_name text;
  v_discipline text;
  v_to_stripe int;
  v_key text;
begin
  if p_user is null or p_promotion_id is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_user, 'promotion'), true) then
    return;
  end if;

  v_key := 'member_promotion:' || p_promotion_id::text;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_user
      and n.type = 'promotion'
      and n.payload->>'idempotencyKey' = v_key
  ) then
    return;
  end if;

  select rl.name, d.display_name, rp.to_stripe
    into v_rank_name, v_discipline, v_to_stripe
  from public.rank_promotions rp
  join public.rank_levels rl on rl.id = rp.to_rank_level_id
  join public.disciplines d on d.id = rp.discipline_id
  where rp.id = p_promotion_id
    and rp.user_id = p_user;

  if not found then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user,
    'promotion',
    jsonb_build_object(
      'title', 'Promotion earned',
      'body', coalesce(v_rank_name, 'New rank')
        || ' · ' || coalesce(v_discipline, 'BJJ')
        || case
          when coalesce(v_to_stripe, 0) > 0 then ' · Stripe ' || v_to_stripe::text
          else ''
        end
        || ' · +50 points',
      'promotionId', p_promotion_id,
      'rankName', v_rank_name,
      'discipline', v_discipline,
      'url', '/(tabs)/belt-path',
      'idempotencyKey', v_key
    )
  );
end;
$$;

revoke execute on function public.notify_member_milestone(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_member_promotion(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Milestone evaluator: member + guardian notifications
-- ---------------------------------------------------------------------------

create or replace function public.evaluate_milestones(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training_days int := 0;
  v_next_milestone uuid;
  v_milestone record;
  v_existing public.member_milestones%rowtype;
  v_newly_earned boolean;
begin
  if p_user is null then
    return;
  end if;

  v_training_days := public.count_training_days(p_user);

  for v_milestone in
    select *
    from public.milestones
    where active
    order by unlock_days asc, sort_order asc, name asc
  loop
    select *
      into v_existing
    from public.member_milestones
    where user_id = p_user
      and milestone_id = v_milestone.id;

    v_newly_earned := v_training_days >= v_milestone.unlock_days
      and (not found or v_existing.earned_at is null);

    if v_training_days >= v_milestone.unlock_days then
      insert into public.member_milestones (
        user_id,
        milestone_id,
        status,
        earned_at,
        updated_at,
        metadata
      )
      values (
        p_user,
        v_milestone.id,
        'earned',
        now(),
        now(),
        jsonb_build_object('trainingDays', v_training_days)
      )
      on conflict (user_id, milestone_id) do update
      set status = 'earned',
          earned_at = coalesce(public.member_milestones.earned_at, excluded.earned_at),
          metadata = public.member_milestones.metadata || excluded.metadata,
          updated_at = now();

      if v_newly_earned and coalesce(v_milestone.points_award, 0) > 0 then
        perform public.post_points_transaction(
          p_user,
          v_milestone.points_award,
          'milestone',
          'member_milestones',
          v_milestone.id,
          'milestone:' || p_user::text || ':' || v_milestone.id::text,
          jsonb_build_object('milestoneName', v_milestone.name)
        );
      end if;

      if v_newly_earned then
        begin
          perform public.notify_member_milestone(p_user, v_milestone.id);
        exception
          when others then
            raise warning 'Member milestone notification failed for user %: %', p_user, sqlerrm;
        end;

        begin
          perform public.notify_guardian_milestone(p_user, v_milestone.id);
        exception
          when others then
            raise warning 'Guardian milestone notification failed for user %: %', p_user, sqlerrm;
        end;
      end if;
    else
      insert into public.member_milestones (
        user_id,
        milestone_id,
        status,
        earned_at,
        updated_at,
        metadata
      )
      values (
        p_user,
        v_milestone.id,
        'locked',
        null,
        now(),
        jsonb_build_object('trainingDays', v_training_days)
      )
      on conflict (user_id, milestone_id) do update
      set status = case
            when public.member_milestones.status = 'earned' then 'earned'
            else 'locked'
          end,
          metadata = public.member_milestones.metadata || excluded.metadata,
          updated_at = now();
    end if;
  end loop;

  update public.member_milestones mm
  set status = 'locked',
      updated_at = now()
  where mm.user_id = p_user
    and mm.status <> 'earned';

  select m.id
    into v_next_milestone
  from public.milestones m
  where m.active
    and m.unlock_days > v_training_days
  order by m.unlock_days asc, m.sort_order asc, m.name asc
  limit 1;

  if v_next_milestone is not null then
    update public.member_milestones
    set status = 'next',
        updated_at = now()
    where user_id = p_user
      and milestone_id = v_next_milestone
      and status <> 'earned';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in trigger: all rank-track disciplines + guardian alerts
-- ---------------------------------------------------------------------------

create or replace function public.on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  perform public.award_check_in_points(new.user_id, new.id);

  begin
    perform public.recompute_streak(new.user_id);
    perform public.evaluate_milestones(new.user_id);
    perform public.recompute_discipline_score(new.user_id);

    for v_rec in
      select d.slug
      from public.member_disciplines md
      join public.disciplines d on d.id = md.discipline_id
      where md.user_id = new.user_id
        and md.active = true
        and d.has_rank_progression = true
    loop
      perform public.recompute_belt_progress(new.user_id, v_rec.slug);
    end loop;
  exception
    when others then
      raise warning 'Engagement recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  if coalesce(new.signed_in, true) = true
    and coalesce(new.missed, false) = false
    and coalesce(new.late_cancelled, false) = false then
    begin
      perform public.notify_guardian_check_in(new.user_id, new.id);
    exception
      when others then
        raise warning 'Guardian check-in notification failed for user %: %', new.user_id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Promotion: notify member in addition to guardian
-- ---------------------------------------------------------------------------

create or replace function public.award_promotion(
  p_user uuid,
  p_discipline text default 'bjj',
  p_to_stripe int default null,
  p_to_rank uuid default null
)
returns public.rank_promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_progress public.member_rank_progress%rowtype;
  v_from_rank_level_id uuid;
  v_from_stripe int;
  v_to_rank_level_id uuid;
  v_to_stripe int;
  v_rank_stripe_count int;
  v_promotion public.rank_promotions%rowtype;
  v_rank_name text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Discipline not found.';
  end if;

  if p_discipline not in ('bjj', 'wrestling') then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Rank progression only exists for BJJ and Wrestling.';
  end if;

  if not exists (
    select 1 from public.member_disciplines
    where user_id = p_user
      and discipline_id = v_discipline_id
      and active = true
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Member is not enrolled in this discipline.';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    if not exists (
      select 1 from public.coach_disciplines cd
      join public.coaches c on c.id = cd.coach_id
      where c.user_id = auth.uid()
        and cd.discipline_id = v_discipline_id
    ) then
      raise exception 'FORBIDDEN' using errcode = 'P0001', message = 'Coach is not assigned to this discipline.';
    end if;
  end if;

  perform public.recompute_belt_progress(p_user, p_discipline);

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and discipline_id = v_discipline_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001', message = 'Member rank progress not found.';
  end if;

  v_from_rank_level_id := v_progress.rank_level_id;
  v_from_stripe := v_progress.stripe;
  v_to_rank_level_id := coalesce(p_to_rank, v_progress.rank_level_id);
  v_to_stripe := coalesce(p_to_stripe, v_progress.stripe + 1);

  select stripe_count, name
    into v_rank_stripe_count, v_rank_name
  from public.rank_levels
  where id = v_to_rank_level_id;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe > v_rank_stripe_count then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Stripe exceeds rank maximum.';
  end if;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe <= v_progress.stripe then
    raise exception 'BAD_REQUEST' using errcode = 'P0001', message = 'Promotion must advance stripe or rank.';
  end if;

  insert into public.rank_promotions (
    user_id,
    discipline_id,
    from_rank_level_id,
    to_rank_level_id,
    from_stripe,
    to_stripe,
    awarded_by,
    awarded_at
  )
  values (
    p_user,
    v_discipline_id,
    v_from_rank_level_id,
    v_to_rank_level_id,
    v_from_stripe,
    v_to_stripe,
    auth.uid(),
    now()
  )
  returning * into v_promotion;

  update public.member_rank_progress
  set rank_level_id = v_to_rank_level_id,
      stripe = v_to_stripe,
      updated_at = now()
  where user_id = p_user
    and discipline_id = v_discipline_id;

  if p_discipline = 'bjj' then
    update public.profiles
    set belt_rank = v_rank_name,
        belt_stripes = v_to_stripe,
        updated_at = now()
    where id = p_user;
  end if;

  perform public.post_points_transaction(
    p_user,
    50,
    'promotion',
    'rank_promotions',
    v_promotion.id,
    'promotion:' || v_promotion.id::text,
    jsonb_build_object('discipline', p_discipline)
  );

  perform public.evaluate_milestones(p_user);
  perform public.recompute_belt_progress(p_user, p_discipline);

  begin
    perform public.notify_member_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Member promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  begin
    perform public.notify_guardian_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Guardian promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  return v_promotion;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ship-ready catalog and milestones (points-based; no ambiguous physical gifts)
-- ---------------------------------------------------------------------------

update public.milestones
set
  name = '10 Training Days',
  description = 'Counted attendance on 10 distinct training days.',
  unlock_days = 10,
  points_award = 25,
  category = 'attendance',
  icon = 'medal-outline',
  sort_order = 10
where name in ('971 T-shirt', '10 Training Days');

update public.milestones
set
  name = '25 Training Days',
  description = 'Counted attendance on 25 distinct training days.',
  unlock_days = 25,
  points_award = 50,
  category = 'attendance',
  icon = 'ribbon-outline',
  sort_order = 20
where name in ('Recovery credit', '25 Training Days');

update public.milestones
set
  name = '50 Training Days',
  description = 'Counted attendance on 50 distinct training days.',
  unlock_days = 50,
  points_award = 100,
  category = 'attendance',
  icon = 'fitness-outline',
  sort_order = 30
where name in ('Gloves credit', '50 Training Days');

update public.milestones
set
  name = '100 Training Days',
  description = 'Counted attendance on 100 distinct training days.',
  unlock_days = 100,
  points_award = 250,
  category = 'attendance',
  icon = 'trophy-outline',
  sort_order = 40
where name in ('Gi contribution', '100 Training Days');

insert into public.milestones (name, description, unlock_days, points_award, category, icon, active, sort_order)
values
  ('10 Training Days', 'Counted attendance on 10 distinct training days.', 10, 25, 'attendance', 'medal-outline', true, 10),
  ('25 Training Days', 'Counted attendance on 25 distinct training days.', 25, 50, 'attendance', 'ribbon-outline', true, 20),
  ('50 Training Days', 'Counted attendance on 50 distinct training days.', 50, 100, 'attendance', 'fitness-outline', true, 30),
  ('100 Training Days', 'Counted attendance on 100 distinct training days.', 100, 250, 'attendance', 'trophy-outline', true, 40)
on conflict (name) do update
set description = excluded.description,
    unlock_days = excluded.unlock_days,
    points_award = excluded.points_award,
    category = excluded.category,
    icon = excluded.icon,
    active = excluded.active,
    sort_order = excluded.sort_order;

update public.rewards_catalog
set active = false,
    unlock_rule = '{}'::jsonb,
    updated_at = now()
where name in ('Private session', 'Seminar seat');

update public.rewards_catalog
set unlock_rule = '{}'::jsonb,
    updated_at = now()
where name in ('Protein shake', '971 rashguard');

-- ---------------------------------------------------------------------------
-- Admin content editor: milestone bonus points + description
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_content_entry(
  p_table text,
  p_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  perform public.require_admin();

  if p_id is null or p_table is null or p_payload is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  case p_table
    when 'lineage_entries' then
      update public.lineage_entries
      set year_label = coalesce(p_payload ->> 'year_label', year_label),
          name = coalesce(p_payload ->> 'name', name),
          role = coalesce(p_payload ->> 'role', role),
          note = coalesce(p_payload ->> 'note', note),
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order)
      where id = p_id
      returning to_jsonb(lineage_entries.*) into v_row;

    when 'milestones' then
      update public.milestones
      set name = coalesce(p_payload ->> 'name', name),
          description = coalesce(p_payload ->> 'description', description),
          unlock_days = coalesce((p_payload ->> 'unlock_days')::int, unlock_days),
          points_award = coalesce((p_payload ->> 'points_award')::int, points_award),
          category = coalesce(p_payload ->> 'category', category),
          icon = coalesce(p_payload ->> 'icon', icon),
          active = coalesce((p_payload ->> 'active')::boolean, active),
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order)
      where id = p_id
      returning to_jsonb(milestones.*) into v_row;

    when 'rewards_catalog' then
      update public.rewards_catalog
      set name = coalesce(p_payload ->> 'name', name),
          category = coalesce(p_payload ->> 'category', category),
          cost_points = coalesce((p_payload ->> 'cost_points')::int, cost_points),
          active = coalesce((p_payload ->> 'active')::boolean, active),
          unlock_rule = coalesce(p_payload -> 'unlock_rule', unlock_rule),
          fulfillment = coalesce(p_payload ->> 'fulfillment', fulfillment),
          inventory = case
            when p_payload ? 'inventory' then (p_payload ->> 'inventory')::int
            else inventory
          end,
          sort_order = coalesce((p_payload ->> 'sort_order')::int, sort_order)
      where id = p_id
      returning to_jsonb(rewards_catalog.*) into v_row;

    when 'belt_ranks' then
      update public.belt_ranks
      set discipline = coalesce(p_payload ->> 'discipline', discipline),
          name = coalesce(p_payload ->> 'name', name),
          "order" = coalesce((p_payload ->> 'order')::int, "order"),
          stripes = coalesce((p_payload ->> 'stripes')::int, stripes)
      where id = p_id
      returning to_jsonb(belt_ranks.*) into v_row;

    when 'belt_requirements' then
      update public.belt_requirements
      set stripe = coalesce((p_payload ->> 'stripe')::int, stripe),
          title = coalesce(p_payload ->> 'title', title),
          description = coalesce(p_payload ->> 'description', description),
          type = coalesce(p_payload ->> 'type', type),
          attendance_target = case
            when p_payload ? 'attendance_target' then (p_payload ->> 'attendance_target')::int
            else attendance_target
          end,
          unlock_after_stripe = case
            when p_payload ? 'unlock_after_stripe' then (p_payload ->> 'unlock_after_stripe')::int
            else unlock_after_stripe
          end
      where id = p_id
      returning to_jsonb(belt_requirements.*) into v_row;

    when 'announcements' then
      update public.announcements
      set channel = coalesce(p_payload ->> 'channel', channel),
          title = coalesce(p_payload ->> 'title', title),
          body = coalesce(p_payload ->> 'body', body)
      where id = p_id
      returning to_jsonb(announcements.*) into v_row;

    when 'programs' then
      update public.programs
      set discipline_id = case
            when p_payload ? 'discipline_id' then nullif(p_payload ->> 'discipline_id', '')::uuid
            else discipline_id
          end,
          active = coalesce((p_payload ->> 'active')::boolean, active)
      where id = p_id
      returning to_jsonb(programs.*) into v_row;

    when 'membership_product_disciplines' then
      update public.membership_product_disciplines
      set match_type = coalesce(p_payload ->> 'match_type', match_type),
          match_value = coalesce(nullif(trim(p_payload ->> 'match_value'), ''), match_value),
          discipline_id = coalesce(nullif(p_payload ->> 'discipline_id', '')::uuid, discipline_id),
          priority = coalesce((p_payload ->> 'priority')::int, priority),
          active = coalesce((p_payload ->> 'active')::boolean, active),
          notes = case
            when p_payload ? 'notes' then nullif(p_payload ->> 'notes', '')
            else notes
          end,
          updated_at = now()
      where id = p_id
      returning to_jsonb(membership_product_disciplines.*) into v_row;

    else
      raise exception using message = 'UNSUPPORTED_TABLE', errcode = 'P0001';
  end case;

  if v_row is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_content_entry',
    p_table,
    p_id::text,
    p_payload
  );

  return v_row;
end;
$$;
