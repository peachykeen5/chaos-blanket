import { useCallback, useEffect, useRef, useState } from "react";

export function useInlineConfirmation(delayMs = 2000) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const trigger = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
    timeoutRef.current = setTimeout(() => setVisible(false), delayMs);
  }, [delayMs]);

  return { visible, trigger };
}
