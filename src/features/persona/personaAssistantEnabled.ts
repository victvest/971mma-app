import { ENV } from '@/core/config/env';

/** Member AI assistant bubble — opt-out via EXPO_PUBLIC_PERSONA_ASSISTANT_ENABLED=false. */
export function isPersonaAssistantEnabled(): boolean {
  const flag = ENV.PERSONA_ASSISTANT_ENABLED?.trim().toLowerCase();
  if (!flag) return true;
  return flag === 'true' || flag === '1' || flag === 'on';
}
