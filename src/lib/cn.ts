import { clsx, type ClassValue } from 'clsx';

/** Small classnames helper so components can compose Tailwind classes cleanly. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
