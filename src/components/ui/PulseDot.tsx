import Box from "@mui/material/Box";
import { forgeColors } from "@/theme/theme";

interface PulseDotProps {
  color?: string;
}

/** A small breathing dot used to mark a currently-active operation/job. */
export default function PulseDot({ color = forgeColors.success }: PulseDotProps) {
  return (
    <Box
      sx={{
        position: "relative",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
        "@media (prefers-reduced-motion: no-preference)": {
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            backgroundColor: color,
            animation: "pulse-dot 1.8s ease-out infinite",
          },
        },
        "@keyframes pulse-dot": {
          "0%": { transform: "scale(1)", opacity: 0.7 },
          "100%": { transform: "scale(2.6)", opacity: 0 },
        },
      }}
    />
  );
}
