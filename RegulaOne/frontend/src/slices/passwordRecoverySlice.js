import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService } from '../services/authService';

function toRejectedValue(error, fallbackMessage) {
  return {
    message: error?.message || fallbackMessage,
    errorCode: error?.errorCode || 'UNKNOWN_ERROR',
    httpStatus: error?.httpStatus,
  };
}

export const requestPasswordReset = createAsyncThunk(
  'passwordRecovery/requestCode',
  async ({ email }, { rejectWithValue }) => {
    try {
      await authService.requestPasswordReset({ email });
      return { email };
    } catch (error) {
      return rejectWithValue(toRejectedValue(error, 'Could not request a password reset code.'));
    }
  },
);

export const confirmPasswordReset = createAsyncThunk(
  'passwordRecovery/confirmReset',
  async ({ email, code, newPassword }, { rejectWithValue }) => {
    try {
      await authService.confirmPasswordReset({ email, code, newPassword });
      return { completed: true };
    } catch (error) {
      return rejectWithValue(toRejectedValue(error, 'Could not reset the password.'));
    }
  },
);

const initialState = {
  step: 'request',
  email: '',
  requestStatus: 'idle',
  resetStatus: 'idle',
  requestSucceeded: false,
  resetSucceeded: false,
  error: null,
};

const passwordRecoverySlice = createSlice({
  name: 'passwordRecovery',
  initialState,
  reducers: {
    restartPasswordRecovery: () => ({ ...initialState }),
    clearPasswordRecoveryError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestPasswordReset.pending, (state) => {
        state.requestStatus = 'loading';
        state.requestSucceeded = false;
        state.error = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.requestStatus = 'succeeded';
        state.requestSucceeded = true;
        state.email = action.payload.email;
        state.step = 'confirm';
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.requestStatus = 'failed';
        state.error = action.payload || { message: action.error?.message || 'Request failed' };
      })
      .addCase(confirmPasswordReset.pending, (state) => {
        state.resetStatus = 'loading';
        state.resetSucceeded = false;
        state.error = null;
      })
      .addCase(confirmPasswordReset.fulfilled, (state) => {
        state.resetStatus = 'succeeded';
        state.resetSucceeded = true;
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.resetStatus = 'failed';
        state.error = action.payload || { message: action.error?.message || 'Reset failed' };
      });
  },
});

export const { restartPasswordRecovery, clearPasswordRecoveryError } = passwordRecoverySlice.actions;

export const selectPasswordRecoveryStep = (state) => state.passwordRecovery.step;
export const selectPasswordRecoveryEmail = (state) => state.passwordRecovery.email;
export const selectPasswordRecoveryRequestStatus = (state) => state.passwordRecovery.requestStatus;
export const selectPasswordRecoveryResetStatus = (state) => state.passwordRecovery.resetStatus;
export const selectPasswordRecoveryError = (state) => state.passwordRecovery.error;

export default passwordRecoverySlice.reducer;
