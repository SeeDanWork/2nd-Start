import { useAuthStore } from '../stores/auth';

/** Returns a function that maps 'parent_a'/'parent_b' to the real display name */
export function useParentLabel(): (role: string) => string {
  const parentNames = useAuthStore((s) => s.parentNames);
  return (role: string) =>
    role === 'parent_a' ? parentNames.parent_a : parentNames.parent_b;
}

/** Returns the { parent_a, parent_b } names object directly */
export function useParentNames() {
  return useAuthStore((s) => s.parentNames);
}
