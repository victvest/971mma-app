import { ImageSourcePropType } from 'react-native';
import type { ClassItem } from '../types/models';
import type { GymClass } from './mockData';

const bjjImg = require('../../assets/images/class-bjj.jpg');
const boxingImg = require('../../assets/images/class-boxing.jpg');
const conditioningImg = require('../../assets/images/class-conditioning.jpg');

function key(discipline: string): string {
  return discipline.toLowerCase();
}

export function imageForClass(item: Pick<ClassItem, 'discipline' | 'imageUrl'>): ImageSourcePropType {
  if (item.imageUrl && /^https?:\/\//.test(item.imageUrl)) return { uri: item.imageUrl };
  const d = key(item.discipline);
  if (d.includes('jiu') || d.includes('bjj') || d.includes('grappl')) return bjjImg;
  if (d.includes('box') || d.includes('muay') || d.includes('strik')) return boxingImg;
  return conditioningImg;
}

export function accentForDiscipline(discipline: string): GymClass['accent'] {
  const d = key(discipline);
  if (d.includes('jiu') || d.includes('bjj')) return 'green';
  if (d.includes('box') || d.includes('muay') || d.includes('strik')) return 'red';
  return 'ink';
}

export function shortDiscipline(discipline: string): string {
  const d = key(discipline);
  if (d.includes('jiu') || d.includes('bjj')) return 'BJJ';
  if (d.includes('muay')) return 'Muay Thai';
  if (d.includes('box')) return 'Boxing';
  if (d.includes('wrestl')) return 'Wrestling';
  if (d.includes('mma')) return 'MMA';
  return discipline;
}

/** Filter chip values used across the Classes screen. */
export type DisciplineFilter = 'All' | 'BJJ' | 'Muay Thai' | 'MMA' | 'Boxing' | 'Wrestling';

export const disciplineFilters: { label: string; value: DisciplineFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'BJJ', value: 'BJJ' },
  { label: 'Muay Thai', value: 'Muay Thai' },
  { label: 'MMA', value: 'MMA' },
  { label: 'Boxing', value: 'Boxing' },
  { label: 'Wrestling', value: 'Wrestling' },
];

export function disciplineMatches(discipline: string, filter: DisciplineFilter): boolean {
  if (filter === 'All') return true;
  return shortDiscipline(discipline) === filter;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

export function isToday(iso: string): boolean {
  return dayLabel(iso) === 'Today';
}

/** Map a domain ClassItem to the display shape the cards render. */
export function toDisplayClass(item: ClassItem, isBooked = false): GymClass {
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + item.durationMinutes * 60000);
  // Deterministic "booked" fill for visual texture (real per-class counts are
  // not readable under member-scoped RLS); the real signal is `isBooked`.
  const pseudoBooked = Math.min(
    item.capacity,
    Math.round((item.capacity * (0.45 + ((start.getMinutes() % 5) * 0.1))) ),
  );
  return {
    id: item.id,
    title: item.title,
    discipline: shortDiscipline(item.discipline) as GymClass['discipline'],
    coach: item.coachName,
    startTime: formatTime(start.toISOString()),
    endTime: formatTime(end.toISOString()),
    day: dayLabel(item.startsAt),
    durationMin: item.durationMinutes,
    level: (item.level as GymClass['level']) ?? 'All levels',
    capacity: item.capacity,
    booked: isBooked ? Math.max(pseudoBooked, 1) : pseudoBooked,
    image: imageForClass(item),
    accent: accentForDiscipline(item.discipline),
    startsAt: item.startsAt,
    isBooked,
  };
}
