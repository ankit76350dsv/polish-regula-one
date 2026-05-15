import { create } from 'zustand';
import { authService } from '../services/authService';

// Maps the backend UserApiResponse shape to the frontend UserProfile shape.
// Centralised here so all hooks/pages get consistent user objects.
export function mapApiUserToProfile(res) {
  return {
    uid:         res.id,
    email:       res.email,
    displayName: res.name,
    role:        res.role,
    status:      res.enabled ? 'active' : 'suspended',
  };
}

export const useAuthStore = create((set) => ({
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
