import { create } from 'zustand';
import { UserProfile } from '../types';
import type { ChallengeState, UserApiResponse } from '../types/auth';
import { UserRole } from '../types';
import { authService } from '../services/authService';

// Maps the backend UserApiResponse shape to the frontend UserProfile shape.
// Centralised here so all hooks/pages get consistent user objects.
export function mapApiUserToProfile(res: UserApiResponse): UserProfile {
  return {
    uid:         res.id,
    email:       res.email,
    displayName: res.name,
    role:        res.role as UserRole,
    status:      res.enabled ? 'active' : 'suspended',
  };
}

interface AuthState {
  user:           UserProfile | null;
  isLoading:      boolean;
  // Stored when the backend returns a Cognito challenge (e.g. NEW_PASSWORD_REQUIRED).
  // The RespondChallengePage reads this to complete the challenge flow.
  challengeState: ChallengeState | null;

  setUser:           (user: UserProfile | null) => void;
  setLoading:        (isLoading: boolean) => void;
  setChallengeState: (state: ChallengeState | null) => void;

  // Called once on app boot — tries GET /api/auth/me to restore the session from the
  // idToken cookie. If the cookie is absent/expired the request returns 401 and user stays null.
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:           null,
  isLoading:      true,  // true on boot while we try to restore the session
  challengeState: null,

  setUser:           (user)           => set({ user }),
  setLoading:        (isLoading)      => set({ isLoading }),
  setChallengeState: (challengeState) => set({ challengeState }),

  initAuth: async () => {
    set({ isLoading: true });
    try {
      const me = await authService.getMe();
      set({ user: mapApiUserToProfile(me), isLoading: false });
    } catch {
      // 401 or network error — no valid session, stay logged out
      set({ user: null, isLoading: false });
    }
  },
}));
