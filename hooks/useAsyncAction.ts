import { useCallback, useRef, useState } from 'react';

/**
 * Wraps an async handler with a ref-based re-entrancy guard.
 * Prevents duplicate submissions before React re-renders disabled state.
 */
export function useAsyncAction<T extends (...args: any[]) => Promise<any>>(fn: T) {
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> => {
      if (pendingRef.current) return undefined;
      pendingRef.current = true;
      setIsPending(true);
      try {
        return await fn(...args);
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [fn]
  ) as (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined>;

  return { execute, isPending };
}
