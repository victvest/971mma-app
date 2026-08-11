import type { PersonaAssistantContext } from './personaContext.ts';
import { sanitizePersonaActions } from './personaKnowledge.ts';

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function findCoachByName(context: PersonaAssistantContext, query: string) {
  const normalized = query.toLowerCase();
  return context.coaches.find((coach) => coach.name.toLowerCase().includes(normalized));
}

function findFaqMatch(message: string) {
  const normalized = message.toLowerCase();
  return contextFaqEntries().find((item) =>
    item.question
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.length > 4 && normalized.includes(word)),
  );
}

function contextFaqEntries() {
  return [
    {
      question: 'check in qr scan',
      answer:
        'Open Check-in and show your member QR pass to the gate reader. Coaches can scan the same pass for roll call if needed.',
    },
    {
      question: 'belt progression',
      answer:
        'Attendance updates from check-ins. Coaches mark skill requirements. See Belt Path for your checklist.',
    },
    {
      question: 'rewards points',
      answer:
        'Earn points from check-ins, milestones, streaks, and referrals. Redeem items in the Rewards tab.',
    },
    {
      question: 'freeze membership',
      answer:
        'Contact the front desk at info@971mma.com or +971 54 332 3980 for membership changes.',
    },
  ];
}

function normalizeComparable(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isDuplicateLabel(value: string | null | undefined, existing: string[]): boolean {
  const normalized = normalizeComparable(value);
  if (!normalized) return true;

  return existing.some((candidate) => {
    const current = normalizeComparable(candidate);
    return Boolean(current) && (current.includes(normalized) || normalized.includes(current));
  });
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || /^[-–—\s]+$/.test(trimmed) || /^(n\/a|na|null|undefined)$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function cleanCoachName(value: string | null | undefined): string | null {
  const cleaned = cleanOptionalText(value);
  if (!cleaned || /^(coach|tba|tbd)$/i.test(cleaned)) return null;
  return cleaned;
}

function formatClassSummary(
  item: PersonaAssistantContext['schedule']['upcomingClasses'][number],
): string {
  const parts = [cleanOptionalText(item.title) ?? 'Class'];
  const level = cleanOptionalText(item.level);
  const discipline = cleanOptionalText(item.discipline);
  const coachName = cleanCoachName(item.coachName);

  if (level && !isDuplicateLabel(level, parts)) parts.push(level);
  if (discipline && !isDuplicateLabel(discipline, parts)) parts.push(discipline);

  return `• ${item.startsAtLocal} — ${parts.join(' · ')}${coachName ? ` · ${coachName}` : ''}`;
}

export function buildPersonaFallbackReply(
  message: string,
  context: PersonaAssistantContext,
): { reply: string; actions: Array<{ label: string; route: string }> } {
  const text = message.toLowerCase();
  const name = firstName(context.member.fullName);
  const actions: Array<{ label: string; route: string }> = [];

  if (/schedule|class|today|tomorrow|train/.test(text)) {
    const classes = context.schedule.upcomingClasses.slice(0, 5);
    if (!classes.length) {
      return {
        reply: `Hi ${name} — I don't see upcoming classes in the next week. Open Schedule for the full timetable or contact the front desk for the latest times.`,
        actions: sanitizePersonaActions([{ label: 'Open Schedule', route: 'schedule' }]),
      };
    }

    const lines = classes.map(formatClassSummary);
    const firstClass = classes[0];
    if (firstClass?.id) {
      actions.push({ label: 'View class', route: `class:${firstClass.id}` });
    }
    actions.push({ label: 'Open Schedule', route: 'schedule' });

    return {
      reply: `Hi ${name} — here are your upcoming classes:\n\n${lines.join('\n')}`,
      actions: sanitizePersonaActions(actions),
    };
  }

  if (/coach|instructor|sensei|professor/.test(text)) {
    const coachMatch =
      context.coaches.find((coach) =>
        text.includes(coach.name.split(' ')[0]?.toLowerCase() ?? ''),
      ) ?? findCoachByName(context, text.replace(/coach|classes|class|about|who is/g, '').trim());

    if (coachMatch) {
      const coachClasses = context.schedule.upcomingClasses
        .filter((item) => item.coachId === coachMatch.id)
        .slice(0, 3);
      const classLine = coachClasses.length
        ? `\n\nUpcoming classes:\n${coachClasses.map(formatClassSummary).join('\n')}`
        : '\n\nNo upcoming classes listed for them this week — check Schedule for updates.';

      return {
        reply: `${coachMatch.name}${coachMatch.specialty ? ` specializes in ${coachMatch.specialty}` : ''}.${coachMatch.rank ? ` Rank: ${coachMatch.rank}.` : ''}${classLine}`,
        actions: sanitizePersonaActions([
          { label: `View ${coachMatch.name.split(' ')[0]}`, route: `coach:${coachMatch.id}` },
          { label: 'All coaches', route: 'coaches' },
        ]),
      };
    }

    const list = context.coaches
      .slice(0, 6)
      .map((coach) => `• ${coach.name}${coach.specialty ? ` — ${coach.specialty}` : ''}`)
      .join('\n');
    return {
      reply: `Our coaching team includes:\n\n${list}\n\nAsk me about a coach by name to see their upcoming classes.`,
      actions: sanitizePersonaActions([{ label: 'Browse coaches', route: 'coaches' }]),
    };
  }

  if (/belt|stripe|rank|promotion|bjj/.test(text)) {
    if (!context.belt.eligible) {
      return {
        reply: `${name}, belt progression is tracked for rank disciplines like BJJ. Your profile may not have an active rank program yet — check Belt Path or ask your coach.`,
        actions: sanitizePersonaActions([{ label: 'Open Belt Path', route: 'belt-path' }]),
      };
    }

    const reqLines = context.belt.requirements
      .filter((item) => item.status !== 'done')
      .slice(0, 4)
      .map((item) => `• ${item.title} (${item.status})`);

    return {
      reply: `You're on ${context.belt.rankName ?? 'your current rank'} with ${context.belt.stripe ?? 0} stripe(s) in ${context.belt.disciplineName ?? 'your discipline'} (${context.belt.percentComplete ?? 0}% complete).${reqLines.length ? `\n\nNext requirements:\n${reqLines.join('\n')}` : ''}`,
      actions: sanitizePersonaActions([{ label: 'View Belt Path', route: 'belt-path' }]),
    };
  }

  if (/point|reward|redeem|milestone|tier/.test(text)) {
    const affordable = context.rewards.catalog
      .filter((item) => item.costPoints <= context.engagement.pointsBalance)
      .slice(0, 3);
    const milestoneLine = context.rewards.nextMilestones.find((item) => item.status === 'next');

    let reply = `You have ${context.engagement.pointsBalance.toLocaleString('en-US')} points (${context.engagement.pointsTier} tier). Lifetime: ${context.engagement.lifetimePoints.toLocaleString('en-US')}.`;
    if (milestoneLine) {
      reply += `\n\nNext milestone: ${milestoneLine.name} at ${milestoneLine.unlockDays} training days (+${milestoneLine.pointsAward} pts).`;
    }
    if (affordable.length) {
      reply += `\n\nYou can redeem:\n${affordable.map((item) => `• ${item.name} — ${item.costPoints} pts`).join('\n')}`;
    }

    return {
      reply,
      actions: sanitizePersonaActions([{ label: 'Open Rewards', route: 'rewards' }]),
    };
  }

  if (/streak|training day|discipline score/.test(text)) {
    return {
      reply: `${name}, you're on a ${context.engagement.currentStreak}-day streak (best: ${context.engagement.bestStreak}). ${context.engagement.trainingDays} total training days, ${context.engagement.trainingDays30d} in the last 30 days.${context.member.checkedInToday ? ' You have checked in today.' : ' You have not checked in yet today.'}`,
      actions: sanitizePersonaActions([
        { label: 'Check in', route: 'checkin' },
        { label: 'Home', route: 'profile' },
      ]),
    };
  }

  if (/check.?in|qr|pass|scan/.test(text)) {
    return {
      reply: context.member.checkedInToday
        ? `You're checked in for today, ${name}. Open Check-in anytime to show your member pass.`
        : `Hi ${name} — open Check-in and show your member QR pass to the gate reader. Coaches can scan it for roll call if needed.`,
      actions: sanitizePersonaActions([{ label: 'Open Check-in', route: 'checkin' }]),
    };
  }

  if (/membership|expire|active|plan/.test(text)) {
    const status = context.member.membershipStatus ?? 'unknown';
    const plan = context.member.membershipName ?? 'your plan';
    return {
      reply: `Your membership (${plan}) is ${status}.${context.member.membershipExpiresAt ? ` Expires: ${context.member.membershipExpiresAt.slice(0, 10)}.` : ''} For billing or freeze requests, contact info@971mma.com or +971 54 332 3980.`,
      actions: sanitizePersonaActions([
        { label: 'View Profile', route: 'profile' },
        { label: 'Get help', route: 'help' },
      ]),
    };
  }

  if (/refer/.test(text)) {
    return {
      reply:
        'Share your referral code from the Rewards tab. When a friend activates their account, you both earn bonus points.',
      actions: sanitizePersonaActions([{ label: 'Referrals', route: 'referrals' }]),
    };
  }

  const faq = findFaqMatch(text);
  if (faq) {
    return {
      reply: faq.answer,
      actions: sanitizePersonaActions([{ label: 'Help & Support', route: 'help' }]),
    };
  }

  return {
    reply: `Hi ${name} — I can help with classes, coaches, belt progress, check-in, points, and rewards inside the app. Try asking "What's on the schedule?" or "How's my belt progress?"`,
    actions: sanitizePersonaActions([
      { label: 'Schedule', route: 'schedule' },
      { label: 'Belt Path', route: 'belt-path' },
      { label: 'Rewards', route: 'rewards' },
    ]),
  };
}
