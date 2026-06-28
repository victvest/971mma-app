import React, { memo } from 'react';
import { LayoutGrid } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import type { ScheduleCategory } from '@/features/schedule/utils/scheduleCategory';

/** Icon paths sourced from Material Design Icons / Material Symbols (Apache-2.0). */
const CATEGORY_ICON_PATHS: Record<ScheduleCategory, string> = {
  bjj: 'm10 22l-.5-9l-3.175-1.825l-.35 1.3L8 16l-1.725 1L3.8 12.75L5 8.45l5.75-3.3L8 2.4L9.4 1L14 5.575L10.4 7.65l1.2 1.05L19.8 2L21 3.4L12.5 12L12 22zM5 7q-.825 0-1.412-.587T3 5t.588-1.412T5 3t1.413.588T7 5t-.587 1.413T5 7',
  wrestling:
    'M11.2 10.6q1.5 1.5 3.6 1.5l.1 2.1q-2.85 0-5.1-2.1l-.7-.7l-2.3 2.4L9 15.9v6H7v-5.2l-1.3-1.2v2.2L1.5 22L.1 20.6L3.7 17l-1.2-3.5c-.2-.6.1-1.1.6-1.5l3.3-3.3c.4-.5.9-.7 1.4-.7s.8.1 1.1.3zM24 11.9h-2V8.5l-1.8-.7l.9 4.4l1 5.2l.9 4.4h-2.1l-1.8-8l-2.1 2v6h-2v-7.5l2.1-2l-.6-3c-.6.6-1.3 1.2-2.1 1.6c-.9-.1-1.8-.5-2.5-1.2c1.6-.3 2.7-1.1 3.4-2.3l1-1.6c.6-1 1.5-1.3 2.6-.8L24 7.2zM11.4 4.4c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2M16.5.3c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2',
  'muay-thai':
    'm19.8 2l-8.2 6.7l-1.21-1.04L14 5.58L9.41 1L8 2.41l2.74 2.74L5 8.46l-1.19 4.29L6.27 17L8 16l-2.03-3.5l.35-1.32L9.5 13l.5 9h2l.5-10L21 3.4zM5 3a2 2 0 1 1 0 4c-1.11 0-2-.89-2-2s.9-2 2-2',
  mma: 'M15 10V7H7v3zm3-3c.28 0 .5.09.7.29c.19.21.3.44.3.71v2.78c0 .19-.03.33-.06.42l-.8 3.99c-.14.53-.44.81-.94.81H6.8c-.53 0-.85-.28-.94-.81l-.8-3.99c-.03-.09-.06-.23-.06-.42V5c0-.5.21-1 .6-1.39C6 3.2 6.45 3 7 3h8c.53 0 1 .2 1.41.61c.4.39.59.89.59 1.39v3c0-.27.11-.5.3-.71c.2-.2.42-.29.7-.29M7 20v-3h10v3c0 .3-.09.53-.29.72c-.21.19-.44.28-.71.28H8c-.27 0-.5-.09-.71-.28c-.2-.19-.29-.42-.29-.72',
  boxing:
    'M19 16V6h3v10zM12 4H7S2 4 2 8v6c0 1.77 1 2.76 2.07 3.31A3.996 3.996 0 0 1 8 14h3v2H8a2 2 0 0 0-2 2a2 2 0 0 0 2 2h5c4 0 4-4 4-4V6s-1-2-5-2',
  fitness:
    'M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22l1.43-1.43L16.29 22l2.14-2.14l1.43 1.43l1.43-1.43l-1.43-1.43L22 16.29z',
};

const ICON_SIZE = 16;

type Props = {
  category: ScheduleCategory | 'all';
  color: string;
};

function CategorySvgIcon({ path, color }: { path: string; color: string }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill={color}>
      <Path d={path} />
    </Svg>
  );
}

export const ScheduleCategoryIcon = memo(function ScheduleCategoryIcon({
  category,
  color,
}: Props) {
  if (category === 'all') {
    return <LayoutGrid size={ICON_SIZE} color={color} strokeWidth={2.25} />;
  }

  return <CategorySvgIcon path={CATEGORY_ICON_PATHS[category]} color={color} />;
});
