// Shared helpers for the feature slices — one place for the async lifecycle
// conventions mandated by the project (loading / success / error states).

/** Replace an item by id, or add it to the front when new. */
export function upsert(items, item) {
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx === -1) items.unshift(item);
  else items[idx] = item;
}

/** Standard list-fetch lifecycle: status + error handling for a fetch thunk. */
export function addFetchCases(builder, thunk, key = 'items') {
  builder
    .addCase(thunk.pending, (state) => {
      state.status = 'loading';
      state.error = null;
    })
    .addCase(thunk.fulfilled, (state, action) => {
      state.status = 'succeeded';
      state[key] = action.payload;
    })
    .addCase(thunk.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.error?.message ?? 'Request failed';
    });
}

/** Standard mutation lifecycle: tracks saveStatus and upserts the result. */
export function addMutationCases(builder, thunk, key = 'items') {
  builder
    .addCase(thunk.pending, (state) => {
      state.saveStatus = 'saving';
      state.error = null;
    })
    .addCase(thunk.fulfilled, (state, action) => {
      state.saveStatus = 'succeeded';
      if (action.payload?.id) upsert(state[key], action.payload);
    })
    .addCase(thunk.rejected, (state, action) => {
      state.saveStatus = 'failed';
      state.error = action.error?.message ?? 'Request failed';
    });
}
