import { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  fg?: string;
}

export function TypewriterText({ text, speed = 8, onComplete, fg }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    if (!text) {
      setDisplayed("");
      doneRef.current = true;
      onComplete?.();
      return;
    }
    let i = 1;
    setDisplayed(text.slice(0, 1));
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete?.();
        }
      }
    }, speed);
    return () => {
      clearInterval(interval);
    };
  }, [text, speed]);

  return <text fg={fg ?? undefined} selectable>{displayed}</text>;
}
