"use client";

import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Container from "@mui/material/Container";
import Fade from "@mui/material/Fade";

interface ScreenShellProps {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md";
  animate?: boolean;
}

/** Consistent AppBar + centered container used by every screen after login. */
export default function ScreenShell({ title, onBack, children, maxWidth = "sm", animate = true }: ScreenShellProps) {
  const content = (
    <Container
      maxWidth={maxWidth}
      sx={{
        flex: 1,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        pb: "calc(24px + env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </Container>
  );

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{ borderBottom: "1px solid", borderColor: "divider", pt: "env(safe-area-inset-top)" }}
      >
        <Toolbar>
          {onBack && (
            <IconButton edge="start" onClick={onBack} aria-label="Back" sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {title}
          </Typography>
        </Toolbar>
      </AppBar>
      {animate ? <Fade in timeout={250}>{content}</Fade> : content}
    </Box>
  );
}
