import { decodePasteBytes } from "@opentui/core";
import { useKeyboard, usePaste } from "@opentui/react";
import { useState, useRef } from "react";

interface MaskedInputProps {
  placeholder: string;
  textColor: string;
  cursorColor: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

export function MaskedInput({ placeholder, textColor, cursorColor, onSubmit, onCancel }: MaskedInputProps) {
  const [value, setValue] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;

  useKeyboard((key) => {
    const cur = valueRef.current;
    if (key.name === "return" || key.name === "enter") {
      const trimmed = cur.trim();
      if (trimmed) onSubmit(trimmed);
      return;
    }
    if (key.name === "escape") {
      onCancel?.();
      return;
    }
    if (key.name === "backspace") {
      setValue((prev) => prev.slice(0, -1));
      return;
    }
    if (key.name && key.name.length === 1) {
      setValue((prev) => prev + key.name!);
    }
  });

  usePaste((event) => {
    const text = decodePasteBytes(event.bytes);
    setValue((prev) => prev + text);
  });

  const display = value ? "•".repeat(value.length) : placeholder;
  const fg = value ? textColor : "#888";

  return (
    <box>
      <text fg={fg}>{display}</text>
    </box>
  );
}
