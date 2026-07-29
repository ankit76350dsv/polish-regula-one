// Users and roles from RegulaOne's tenant-scoped identity API.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userService } from '../../services/userService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchUsers = createAsyncThunk('users/fetch', () => userService.list());
export const inviteUser = createAsyncThunk('users/invite', (data, { getState }) =>
  userService.invite(actor(getState), data));
export const changeUserRole = createAsyncThunk('users/changeRole', ({ id, role }, { getState }) => {
  const user = getState().users.items.find((item) => item.id === id);
  return userService.changeRole(user, role);
});
export const setUserActive = createAsyncThunk('users/setActive', ({ id, active }) =>
  userService.setActive(id, active));
export const deleteUser = createAsyncThunk('users/delete', async (id) => {
  await userService.remove(id);
  return id;
});

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    items: [],
    status: 'idle',
    saveStatus: 'idle',
    deleteStatus: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchUsers);
    addMutationCases(builder, inviteUser);
    addMutationCases(builder, changeUserRole);
    addMutationCases(builder, setUserActive);
    builder
      .addCase(deleteUser.pending, (state) => {
        state.deleteStatus = 'loading';
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.items = state.items.filter((user) => user.id !== action.payload);
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.error = action.error?.message ?? 'Request failed';
      });
  },
});

export default usersSlice.reducer;
