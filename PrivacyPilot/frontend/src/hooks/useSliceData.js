// Fetch-on-mount hook for list slices — keeps pages free of effect boilerplate.
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

export function useSliceData(sliceName, fetchThunk) {
  const dispatch = useDispatch();
  const { items, status, error } = useSelector((s) => s[sliceName]);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchThunk());
  }, [status, dispatch, fetchThunk]);

  return { items, status, error, refetch: () => dispatch(fetchThunk()) };
}
