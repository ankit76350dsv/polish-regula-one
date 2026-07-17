import { createSlice } from "@reduxjs/toolkit";

// Auth slice stores the authenticated user in Redux so any component can access
// it via useSelector without prop drilling or a context dependency.
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
  },
  reducers: {
    setAuthUser: (state, action) => {
      state.user = action.payload;
    },
    clearAuthUser: (state) => {
      state.user = null;
    },
  },
});

export const { setAuthUser, clearAuthUser } = authSlice.actions;
export default authSlice.reducer;
