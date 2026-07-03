// Authentication state. Mock-backed today; the thunks keep the same shape the
// real OAuth2/OIDC integration will use.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';

export const restoreSession = createAsyncThunk('auth/restore', () => authService.restore());

export const login = createAsyncThunk('auth/login', ({ email, password }) =>
  authService.login(email, password),
);

export const logout = createAsyncThunk('auth/logout', () => authService.logout());

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    status: 'restoring', // restoring | idle | loading | failed
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'idle';
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = 'idle';
      })
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'idle';
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message ?? 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = 'idle';
      });
  },
});

export default authSlice.reducer;
