// Audit trail slice — read-only.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { auditService } from '../../services/auditService';
import { addFetchCases } from './sliceHelpers';

export const fetchAudit = createAsyncThunk('audit/fetch', () => auditService.list());

const auditSlice = createSlice({
  name: 'audit',
  initialState: { items: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    addFetchCases(builder, fetchAudit);
  },
});

export default auditSlice.reducer;
