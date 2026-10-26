import type { User } from './supabase';

/** Preserve identity for an unchanged profile without suppressing any fresh checks. */
export function stableProfile(previous: User | null, next: User | null): User | null {
  if (!previous || !next) return next;
  const keys = Object.keys(next) as (keyof User)[];
  return Object.keys(previous).length === keys.length && keys.every(key => Object.is(previous[key], next[key])) ? previous : next;
}
