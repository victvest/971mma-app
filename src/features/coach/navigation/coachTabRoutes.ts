import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type CoachTabRouteName = 'index' | 'classes' | 'feed' | 'promotions';

export type CoachTabRoute = {
  name: CoachTabRouteName;
  href: Href;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
};

export const COACH_TAB_ROUTES = [
  {
    name: 'index',
    href: '/(coach)/(main)',
    label: 'Class',
    icon: 'people-outline',
    activeIcon: 'people',
  },
  {
    name: 'classes',
    href: '/(coach)/(main)/classes',
    label: 'Classes',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    name: 'feed',
    href: '/(coach)/(main)/feed',
    label: 'Feed',
    icon: 'newspaper-outline',
    activeIcon: 'newspaper',
  },
  {
    name: 'promotions',
    href: '/(coach)/(main)/promotions',
    label: 'Review',
    icon: 'ribbon-outline',
    activeIcon: 'ribbon',
  },
] as const satisfies readonly CoachTabRoute[];

export const COACH_MAIN_TAB_NAMES = COACH_TAB_ROUTES.map((route) => route.name);
