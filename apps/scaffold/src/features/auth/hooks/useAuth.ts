import { useAuthContext } from "../AuthProvider";

/** Stable contract: auth state hook */
export function useAuth() {
  return useAuthContext();
}
