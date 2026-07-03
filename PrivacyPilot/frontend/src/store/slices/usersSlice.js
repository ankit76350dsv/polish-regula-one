// Users & roles slice.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userService } from '../../services/userService';
import { addFetchCases, addMutationCases } from './sliceHelpers';

const actor = (getState) => getState().auth.user;

export const fetchUsers = createAsyncThunk('users/fetch', () => userService.list());
export const inviteUser = createAsyncThunk('users/invite', (data, { getState }) =>
  userService.invite(actor(getState), data));
export const changeUserRole = createAsyncThunk('users/changeRole', ({ id, role }, { getState }) =>
  userService.changeRole(actor(getState), id, role));
export const setUserActive = createAsyncThunk('users/setActive', ({ id, active }, { getState }) =>
  userService.setActive(actor(getState), id, active));

const usersSlice = createSlice({
  name: 'users',
  initialState: { items: [], status: 'idle', saveStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchUsers);
    addMutationCases(builder, inviteUser);
    addMutationCases(builder, changeUserRole);
    addMutationCases(builder, setUserActive);
  },
});

export default usersSlice.reducer;
