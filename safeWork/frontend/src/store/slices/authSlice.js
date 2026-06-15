import { createSlice } from "@reduxjs/toolkit";

// Auth slice stores the authenticated user in Redux so any component
// can access it via useSelector without prop drilling or context dependency.
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
  },
  reducers: {
    // Dispatched after /me API succeeds (on login or checkAuth)
    setAuthUser: (state, action) => {
      state.user = action.payload;
    },
    // Dispatched on logout or when /me returns null
    clearAuthUser: (state) => {
      state.user = null;
    },
  },
});

export const { setAuthUser, clearAuthUser } = authSlice.actions;

export default authSlice.reducer;
