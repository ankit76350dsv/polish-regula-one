// TypeScript types that mirror the backend Auth DTOs exactly.
// Keep these in sync with: com.regulaone.backend.dto.Auth.*

// ── Request types ─────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface ConfirmSignupRequest {
  email: string;
  code: string;
}

export interface RespondChallengeRequest {
  username: string;
  session: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface MessageResponse {
  message: string;
}

// Mirrors com.regulaone.backend.dto.Auth.LoginResponse
// status: "SUCCESS" | "CHALLENGE" | "ERROR"
export interface LoginApiResponse {
  status: 'SUCCESS' | 'CHALLENGE' | 'ERROR';
  message?: string;
  // Challenge fields (present when status === "CHALLENGE")
  challengeName?: string;
  session?: string;
  username?: string;
}

// Mirrors com.regulaone.backend.dto.Auth.UserResponse
export interface UserApiResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  enabled: boolean;
  tempPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

// Stored in authStore when a Cognito challenge must be completed before login succeeds.
export interface ChallengeState {
  challengeName: string;
  session: string;
  username: string;
}
