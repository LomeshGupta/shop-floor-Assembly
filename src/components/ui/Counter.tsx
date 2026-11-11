import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { counterFontFamily, forgeColors } from "@/theme/theme";

interface CounterProps {
  label: string;
  value: number;
  color?: "primary" | "secondary" | "error" | "text.primary";
  size?: "md" | "lg";
}

const GLOW: Record<string, string> = {
  primary: `0 0 18px ${forgeColors.amber}66`,
  secondary: `0 0 18px ${forgeColors.steel}55`,
  error: `0 0 18px ${forgeColors.error}55`,
  "text.primary": "none",
};

/**
 * Signature element: renders a quantity like a forge-press digital
 * counter — a small uppercase label above a large, glowing, tabular-figure
 * number. Used consistently for produced / scrap / remaining everywhere
 * in the app so the whole workflow reads as one instrument panel.
 */
export default function Counter({ label, value, color = "text.primary", size = "md" }: CounterProps) {
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: counterFontFamily,
          fontVariantNumeric: "tabular-nums",
          fontSize: size === "lg" ? { xs: "2.75rem", sm: "3.25rem" } : { xs: "2.1rem", sm: "2.5rem" },
          fontWeight: 700,
          lineHeight: 1.05,
          color: color === "text.primary" ? "text.primary" : `${color}.main`,
          textShadow: GLOW[color],
        }}
      >
        {value.toLocaleString()}
      </Typography>
    </Box>
  );
}
