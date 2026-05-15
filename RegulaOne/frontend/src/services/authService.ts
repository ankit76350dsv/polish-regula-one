// Pure async functions that call the backend auth API.
// No state, no side-effects — just fetch wrappers that can be composed in hooks.

import { api } from '../lib/api';
import type {
  LoginRequest,
  LoginApiResponse,
  SignupRequest,
  ConfirmSignupRequest,
  RespondChallengeRequest,
  ChangePasswordRequest,
  MessageResponse,
  UserApiResponse,
} from '../types/auth';

export const authService = {
  // POST /api/auth/login
  // Returns LoginApiResponse with status="SUCCESS"|"CHALLENGE"|"ERROR".
  // On SUCCESS, idToken/accessToken/refreshToken are stored in HTTP-only cookies by the backend.
  login: (data: LoginRequest) =>
    api.post<LoginApiResponse>('/api/auth/login', data),

  // POST /api/auth/signup
  // Creates a new Cognito user — user must then confirm via email code.
  signup: (data: SignupRequest) =>
    api.post<MessageResponse>('/api/auth/signup', data),

  // POST /api/auth/confirm
  // Confirms the email verification code sent after signup.
  confirmSignup: (data: ConfirmSignupRequest) =>
    api.post<MessageResponse>('/api/auth/confirm', data),

  // POST /api/auth/resend-code?email=...
  // Re-sends the verification code to the given email address.
  resendCode: (email: string) =>
    api.post<MessageResponse>(`/api/auth/resend-code?email=${encodeURIComponent(email)}`),

  // POST /api/auth/respond-challenge
  // Completes the NEW_PASSWORD_REQUIRED challenge for invited/temp-password users.
  // On success the backend stores tokens in HTTP-only cookies (same as login success).
  respondChallenge: (data: RespondChallengeRequest) =>
    api.post<LoginApiResponse>('/api/auth/respond-challenge', data),

  // GET /api/auth/me  [requires valid idToken cookie]
  // Returns the authenticated user's profile from Cognito.
  getMe: () =>
    api.get<UserApiResponse>('/api/auth/me'),

  // PUT /api/auth/change-password  [requires valid accessToken cookie]
  // Changes the current user's password via Cognito.
  changePassword: (data: ChangePasswordRequest) =>
    api.put<MessageResponse>('/api/auth/change-password', data),

  // POST /api/auth/logout  [requires valid session]
  // Clears idToken/accessToken/refreshToken HTTP-only cookies.
  logout: () =>
    api.post<MessageResponse>('/api/auth/logout'),
};
