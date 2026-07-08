import { createSlice } from "@reduxjs/toolkit";

// Holds the signed-in user in Redux so any component can read it via
// useSelector without prop drilling or depending on the context directly.
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
  },
  reducers: {
    // Dispatched after /me succeeds (on login or checkAuth).
    setAuthUser: (state, action) => {
      state.user = action.payload;
    },
    // Dispatched on logout or when /me returns null.
    clearAuthUser: (state) => {
      state.user = null;
    },
  },
});

export const { setAuthUser, clearAuthUser } = authSlice.actions;
export default authSlice.reducer;
