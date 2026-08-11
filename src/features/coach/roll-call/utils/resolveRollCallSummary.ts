import type {
  RollCallConfig,
  RollCallDeckMember,
  RollCallMemberMark,
  RollCallSummary,
} from '@/features/coach/roll-call/types';
import { computeRollCallSummary } from '@/features/coach/roll-call/types';

type ResolveRollCallSummaryInput = {
  deck: ReadonlyArray<RollCallDeckMember>;
  config: RollCallConfig;
};

/** Always derive summary from deck marks so UI matches the persistent roster list. */
export function resolveRollCallSummary({
  deck,
  config,
}: ResolveRollCallSummaryInput): RollCallSummary {
  const marks = deck
    .map((member) => member.mark)
    .filter((mark): mark is RollCallMemberMark => mark !== null);

  return computeRollCallSummary(marks, deck, config);
}
