// Custom auth hooks backed by @tanstack/react-query mutations.
// Each hook encapsulates one auth action: loading state, error handling, and post-success
// navigation are all managed here so pages stay lean.

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authService } from '../services/authService';
import { useAuthStore, mapApiUserToProfile } from '../store/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reads ?redirect_uri from the current URL and returns it if present.
 * Used by useLogin and useRespondChallenge to complete the SSO round-trip:
 * after a successful login on the central app, the user is sent back to the
 * originating module app via a full-page redirect (window.location.href)
 * rather than a React Router navigate() call, because the destination is
 * a completely different origin (e.g. ksefflow.regulaone.eu).
 */
function getSSORedirectUri() {
  const params = new URLSearchParams(window.location.search);
  return params.get('redirect_uri') || null;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export function useLogin() {
  const navigate            = useNavigate();
  const { setUser, setChallengeState } = useAuthStore();

  return useMutation({
    mutationFn: (data) => authService.login(data),

    onSuccess: async (res) => {
      if (res.status === 'CHALLENGE') {
        // Cognito requires a follow-up action (e.g. invited user must set a permanent password).
        // Preserve ?redirect_uri through the challenge so the round-trip still completes.
        setChallengeState({
          challengeName: res.challengeName,
          session:       res.session,
          username:      res.username,
        });
        const redirectUri = getSSORedirectUri();
        const challengePath = redirectUri
          ? `/auth/challenge?redirect_uri=${encodeURIComponent(redirectUri)}`
          : '/auth/challenge';
        navigate(challengePath);
        return;
      }

      // SUCCESS — tokens are now in HTTP-only cookies. Fetch the user profile.
      try {
        const me = await authService.getMe();
        setUser(mapApiUserToProfile(me));

        // SSO cross-app redirect: if this login was initiated by a module app,
        // send the browser to that app's /auth/sso-callback so it can pick up
        // the shared-domain cookies and complete its own session restoration.
        const redirectUri = getSSORedirectUri();
        if (redirectUri) {
          window.location.href = redirectUri;
        } else {
          navigate(`/company/${me.tenantId ?? 'platform'}/overview`);
        }
      } catch {
        toast.error('Login succeeded but could not load your profile. Please try again.');
      }
    },

    onError: (err) => {
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

        // Honour SSO redirect_uri if the challenge was part of a cross-app login
        const redirectUri = getSSORedirectUri();
        if (redirectUri) {
          window.location.href = redirectUri;
        } else {
          navigate(`/company/${me.tenantId ?? 'platform'}/overview`);
        }
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
  const { ssoLogout } = useAuthStore();

  return useMutation({
    // ssoLogout calls POST /api/sso/logout which clears Domain=.regulaone.eu cookies,
    // logging the user out of ALL apps at once, then redirects to the central login.
    mutationFn: () => authService.ssoLogout(),

    onSuccess: (data) => {
      ssoLogout(data?.logoutUrl);
    },

    onError: () => {
      // API call failed (token already expired) — still clear local state
      ssoLogout();
    },
  });
}
