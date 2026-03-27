import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAbortError(error: any): boolean {
  if (!error) return false;
  
  return (
    error.name === 'AbortError' ||
    error.message?.includes('aborted') ||
    error.message === 'signal is aborted without reason'
  );
}
