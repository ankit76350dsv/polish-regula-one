// Custom auth hooks backed by @tanstack/react-query mutations.
// Each hook encapsulates one auth action: loading state, error handling, and post-success
// navigation are all managed here so pages stay lean.

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authService } from '../services/authService';
import { useAuthStore, mapApiUserToProfile } from '../store/authStore';

// ── Login ─────────────────────────────────────────────────────────────────────

export function useLogin() {
  const navigate            = useNavigate();
  const { setUser, setChallengeState } = useAuthStore();

  return useMutation({
    mutationFn: (data) => authService.login(data),

    onSuccess: async (res) => {
      if (res.status === 'CHALLENGE') {
        // Cognito requires a follow-up action (e.g. invited user must set a permanent password).
        // Store the challenge context so RespondChallengePage can read it.
        setChallengeState({
          challengeName: res.challengeName,
          session:       res.session,
          username:      res.username,
        });
        navigate('/auth/challenge');
        return;
      }

      // SUCCESS — tokens are now in HTTP-only cookies. Fetch the user profile.
      try {
        const me = await authService.getMe();
        setUser(mapApiUserToProfile(me));
        navigate('/');
      } catch {
        toast.error('Login succeeded but could not load your profile. Please try again.');
      }
    },

    onError: (err) => {
      // Error message comes from the 400 response body { message: "..." }
      toast.error(err.message || 'Login failed. Check your credentials.');
    },
  });
}

// ── Signup ────────────────────────────────────────────────────────────────────

export function useSignup() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data) => authService.signup(data),

    onSuccess: (_, variables) => {
      toast.success('Account created! Check your email for the verification code.');
      // Pass the email via query param so ConfirmSignupPage can pre-fill it.
      navigate(`/auth/confirm?email=${encodeURIComponent(variables.email)}`);
    },

    onError: (err) => {
      toast.error(err.message || 'Signup failed. The email may already be registered.');
    },
  });
}

// ── Confirm Signup ────────────────────────────────────────────────────────────

export function useConfirmSignup() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data) => authService.confirmSignup(data),

    onSuccess: () => {
      toast.success('Email verified! You can now log in.');
      navigate('/login');
    },

    onError: (err) => {
      toast.error(err.message || 'Verification failed. Check the code and try again.');
    },
  });
}

// ── Resend Code ───────────────────────────────────────────────────────────────

export function useResendCode() {
  return useMutation({
    mutationFn: (email) => authService.resendCode(email),

    onSuccess: () => {
      toast.success('Verification code resent. Check your inbox.');
    },

    onError: (err) => {
      toast.error(err.message || 'Could not resend code. Please try again.');
    },
  });
}

// ── Respond to Challenge ──────────────────────────────────────────────────────

export function useRespondChallenge() {
  const navigate               = useNavigate();
  const { setUser, setChallengeState } = useAuthStore();

  return useMutation({
    mutationFn: (data) => authService.respondChallenge(data),

    onSuccess: async () => {
      // Challenge complete — backend has set tokens in cookies. Fetch user profile.
      try {
        const me = await authService.getMe();
        setUser(mapApiUserToProfile(me));
        setChallengeState(null);
        toast.success('Password set successfully. Welcome!');
        navigate('/');
      } catch {
        toast.error('Password set but could not load your profile. Please log in.');
        navigate('/login');
      }
    },

    onError: (err) => {
      toast.error(err.message || 'Could not complete the challenge. Please try again.');
    },
  });
}

// ── Change Password ───────────────────────────────────────────────────────────

export function useChangePassword() {
  return useMutation({
    mutationFn: (data) => authService.changePassword(data),

    onSuccess: () => {
      toast.success('Password changed successfully.');
    },

    onError: (err) => {
      toast.error(err.message || 'Password change failed. Check your current password.');
    },
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────

export function useLogout() {
  const navigate  = useNavigate();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: () => authService.logout(),

    onSuccess: () => {
      setUser(null);
      navigate('/login');
    },

    onError: () => {
      // Even if the API call fails, clear local state and redirect —
      // the cookies may have already expired, keeping the user stuck.
      setUser(null);
      navigate('/login');
    },
  });
}
