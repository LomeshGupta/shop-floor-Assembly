"use client";

import TextField from "@mui/material/TextField";
import { counterFontFamily } from "@/theme/theme";

interface NumericFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  suffix?: string;
}

/**
 * A large numeric-keypad-optimized input. Uses inputMode="decimal" so
 * mobile/tablet browsers show a numeric keypad, and renders the value in
 * the same tabular-figure counter font as read-only quantities so entry
 * feels continuous with the rest of the UI.
 */
export default function NumericField({ label, value, onChange, autoFocus, suffix }: NumericFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => {
        const next = e.target.value;
        if (/^\d*\.?\d*$/.test(next)) {
          onChange(next);
        }
      }}
      inputMode="decimal"
      fullWidth
      slotProps={{
        htmlInput: {
          style: {
            fontFamily: counterFontFamily,
            fontSize: "2rem",
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          },
        },
      }}
      helperText={suffix}
    />
  );
}
