import { createTheme } from "@mui/material/styles";

/**
 * "Forge" theme — industrial, high-contrast, built for gloved thumbs and
 * bright shop-floor lighting, not a boardroom dashboard.
 *
 * Token system
 * ------------
 * Color:  #101216 base / #1B1E24 surface / #23262D raised surface /
 *         #FF7A1A molten-amber primary / #FFB238 hot-glow highlight /
 *         #4A8FC2 steel-blue secondary / #F3F4F6 text
 * Type:   Barlow Condensed 700 (display, uppercase, wide tracking) —
 *         Barlow 400–600 (UI/body) — Roboto Mono 700 tabular (data)
 * Layout: control-panel tile grid on Home; single-column "gauge card"
 *         stack everywhere else
 * Signature: the "press strike" — primary actions carry a brief amber
 *         glow/press animation, and every quantity renders as a glowing
 *         digital counter (see components/ui/Counter.tsx) — together they
 *         read like instrumentation on a forge press, not a generic app.
 */

export const forgeColors = {
  base: "#101216",
  surface: "#1B1E24",
  surfaceRaised: "#22262E",
  border: "#2B2F37",
  amber: "#FF7A1A",
  amberHot: "#FFB238",
  steel: "#4A8FC2",
  success: "#3FAE6B",
  warning: "#E8A33D",
  error: "#E1503F",
  textPrimary: "#F3F4F6",
  textSecondary: "#A6ACB6",
};

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: forgeColors.base,
      paper: forgeColors.surface,
    },
    primary: {
      main: forgeColors.amber,
      light: forgeColors.amberHot,
      contrastText: "#101216",
    },
    secondary: {
      main: forgeColors.steel,
      contrastText: "#101216",
    },
    success: { main: forgeColors.success },
    warning: { main: forgeColors.warning },
    error: { main: forgeColors.error },
    text: {
      primary: forgeColors.textPrimary,
      secondary: forgeColors.textSecondary,
    },
    divider: forgeColors.border,
  },
  typography: {
    fontFamily: '"Barlow", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700, letterSpacing: "0.01em" },
    h2: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700, letterSpacing: "0.01em" },
    h3: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700, letterSpacing: "0.04em" },
    button: {
      fontFamily: '"Barlow Condensed", sans-serif',
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    },
  },
  shape: {
    borderRadius: 14,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 56,
          fontSize: "1.05rem",
          paddingLeft: 24,
          paddingRight: 24,
          transition: "transform 120ms ease, box-shadow 120ms ease, filter 120ms ease",
          "&:active": {
            transform: "scale(0.97)",
          },
        },
        sizeLarge: {
          minHeight: 76,
          fontSize: "1.3rem",
        },
        outlined: {
          borderWidth: 2,
          "&:hover": { borderWidth: 2 },
        },
      },
      variants: [
        {
          props: { variant: "contained", color: "primary" },
          style: {
            backgroundImage: `linear-gradient(180deg, ${forgeColors.amberHot} 0%, ${forgeColors.amber} 100%)`,
            boxShadow: "0 4px 20px -4px rgba(255,122,26,0.55)",
            "&:hover": {
              backgroundImage: `linear-gradient(180deg, ${forgeColors.amberHot} 0%, ${forgeColors.amber} 100%)`,
              boxShadow: "0 6px 24px -4px rgba(255,122,26,0.7)",
              filter: "brightness(1.04)",
            },
            "&:active": {
              transform: "scale(0.97)",
              boxShadow: "0 2px 10px -2px rgba(255,122,26,0.5)",
            },
            "&.Mui-disabled": {
              backgroundImage: "none",
              boxShadow: "none",
            },
          },
        },
        {
          props: { variant: "contained", color: "secondary" },
          style: {
            boxShadow: "0 4px 20px -6px rgba(74,143,194,0.55)",
          },
        },
      ],
    },
    MuiTextField: {
      defaultProps: { variant: "filled" },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          fontSize: "1.4rem",
          borderRadius: 12,
          backgroundColor: forgeColors.surfaceRaised,
          "&:before, &:after": { display: "none" },
          "&.Mui-focused": {
            outline: `2px solid ${forgeColors.amber}`,
            outlineOffset: 0,
          },
        },
        input: { padding: "20px 16px" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${forgeColors.border}`,
          backgroundColor: forgeColors.surfaceRaised,
          backgroundImage: "none",
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(16,18,22,0.85)",
          backdropFilter: "blur(10px)",
          backgroundImage: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, letterSpacing: "0.03em" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 10,
          borderRadius: 6,
          backgroundColor: forgeColors.border,
        },
        bar: {
          borderRadius: 6,
          backgroundImage: `linear-gradient(90deg, ${forgeColors.amber}, ${forgeColors.amberHot})`,
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        // Every ripple across the app carries the same molten-amber tint.
        TouchRippleProps: { style: { color: forgeColors.amberHot } },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        "*:focus-visible": {
          outline: `2px solid ${forgeColors.amberHot}`,
          outlineOffset: 2,
        },
      },
    },
  },
});

/** Monospace, tabular-figure font stack used for all numeric readouts. */
export const counterFontFamily = '"Roboto Mono", "SFMono-Regular", Menlo, Consolas, monospace';
