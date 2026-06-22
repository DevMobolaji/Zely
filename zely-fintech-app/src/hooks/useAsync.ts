import { useCallback, useEffect, useRef, useState } from "react";

type UseAsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export const useAsync = <T>(
  asyncFunction: () => Promise<T>,
  immediate = true,
) => {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  // 👇 Store latest asyncFunction in a ref — never stale, never triggers re-runs
  const asyncFunctionRef = useRef(asyncFunction);
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction;
  }, [asyncFunction]);

  // 👇 execute is now stable forever — no deps needed
  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await asyncFunctionRef.current();
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || "Something went wrong";
      setState({ data: null, loading: false, error: errorMessage });
      throw err;
    }
  }, []); // 👈 empty deps — execute never changes

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, []); // 👈 empty deps — fires exactly once on mount

  return { ...state, execute };
};
