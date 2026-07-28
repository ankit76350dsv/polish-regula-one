/**
 * Users slice — authorised personnel and the role permission matrix.
 * Used by the "Access controls" staff page (invite, remove, view matrix).
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import userService from "../services/userService";

export const fetchUsers = createAsyncThunk("users/fetch", () => userService.list());
export const inviteUser = createAsyncThunk("users/invite", (payload) => userService.invite(payload));
export const setUserEnabled = createAsyncThunk(
  "users/setEnabled",
  ({ id, enabled }) => userService.setEnabled(id, enabled),
);
// The delete endpoint returns no body, so we resolve with the id we removed and let the
// reducer drop that row from the list.
export const removeUser = createAsyncThunk("users/remove", async (id) => {
  await userService.remove(id);
  return id;
});

const usersSlice = createSlice({
  name: "users",
  initialState: {
    list: [],
    rolePermissions: [],
    status: "idle",
    error: null,
    inviting: false,
    statusUpdateState: "idle",
    updatingStatusId: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchUsers.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.list = a.payload.users;
        s.rolePermissions = a.payload.rolePermissions;
      })
      .addCase(fetchUsers.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error?.message || "error";
      })
      .addCase(inviteUser.pending, (s) => {
        s.inviting = true;
      })
      .addCase(inviteUser.fulfilled, (s, a) => {
        s.inviting = false;
        s.list.push(a.payload);
      })
      .addCase(inviteUser.rejected, (s) => {
        s.inviting = false;
      })
      .addCase(setUserEnabled.pending, (s, a) => {
        s.statusUpdateState = "loading";
        s.updatingStatusId = a.meta.arg.id;
        s.error = null;
      })
      .addCase(setUserEnabled.fulfilled, (s, a) => {
        s.statusUpdateState = "succeeded";
        s.updatingStatusId = null;
        const index = s.list.findIndex((user) => user.id === a.payload.id);
        if (index !== -1) s.list[index] = a.payload;
      })
      .addCase(setUserEnabled.rejected, (s, a) => {
        s.statusUpdateState = "failed";
        s.updatingStatusId = null;
        s.error = a.error?.message || "error";
      })
      .addCase(removeUser.fulfilled, (s, a) => {
        s.list = s.list.filter((u) => u.id !== a.payload);
      });
  },
});

export const selectUsers = (s) => s.users.list;
export const selectRolePermissions = (s) => s.users.rolePermissions;
export const selectUsersStatus = (s) => s.users.status;
export const selectInviting = (s) => s.users.inviting;
export const selectUpdatingStatusId = (s) => s.users.updatingStatusId;

export default usersSlice.reducer;
