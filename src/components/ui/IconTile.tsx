"use client";

import ButtonBase from "@mui/material/ButtonBase";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { forgeColors } from "@/theme/theme";

interface IconTileProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: "amber" | "steel" | "success" | "muted";
  fullWidth?: boolean;
}

const ACCENTS = {
  amber: { fg: forgeColors.amber, glow: `${forgeColors.amber}55` },
  steel: { fg: forgeColors.steel, glow: `${forgeColors.steel}55` },
  success: { fg: forgeColors.success, glow: `${forgeColors.success}55` },
  muted: { fg: forgeColors.textSecondary, glow: "transparent" },
};

/**
 * A single control-panel tile: big icon, short label, subtle colored glow
 * on the icon that matches the action's accent. Two of these per row form
 * the Home screen's "control panel" grid.
 */
export default function IconTile({ icon, label, onClick, accent = "amber", fullWidth }: IconTileProps) {
  const { fg, glow } = ACCENTS[accent];
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        gridColumn: fullWidth ? "1 / -1" : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        py: 3.5,
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        transition: "transform 120ms ease, border-color 120ms ease, background-color 120ms ease",
        "&:hover": {
          borderColor: fg,
          backgroundColor: "rgba(255,255,255,0.02)",
        },
        "&:active": {
          transform: "scale(0.96)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: "50%",
          color: fg,
          filter: `drop-shadow(0 0 10px ${glow})`,
          "& svg": { fontSize: 32 },
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontFamily: '"Barlow Condensed", sans-serif',
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontSize: "1.05rem",
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}
