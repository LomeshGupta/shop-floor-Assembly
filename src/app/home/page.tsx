"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import AssignmentIcon from "@mui/icons-material/Assignment";
import LogoutIcon from "@mui/icons-material/Logout";
import ScreenShell from "@/components/layout/ScreenShell";
import IconTile from "@/components/ui/IconTile";
import { useOperator } from "@/hooks/useOperator";
import { apiFetch } from "@/lib/api-client";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const router = useRouter();
  const { operator, loading } = useOperator();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100dvh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!operator) {
    router.replace("/login");
    return null;
  }

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = operator.displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScreenShell title="Shop Floor">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: '"Barlow Condensed", sans-serif',
              fontWeight: 700,
              fontSize: "1.4rem",
              color: "primary.contrastText",
              backgroundImage: "linear-gradient(180deg, #FFB238 0%, #FF7A1A 100%)",
              boxShadow: "0 4px 16px -4px rgba(255,122,26,0.6)",
              flexShrink: 0,
            }}
          >
            {initials}
          </Box>
          <Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {greeting()}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {operator.displayName}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {operator.operatorCode} · {operator.role}
            </Typography>
          </Box>
        </Box>

        {operator.mustChangePassword && (
          <Alert severity="warning">
            Your password was set by a supervisor and should be changed. Ask your supervisor to set a new one from the Operator Card in Business Central — self-service password change isn&apos;t available in this app yet.
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
          <IconTile icon={<AssignmentIcon />} label="My Assignments" accent="success" fullWidth onClick={() => router.push("/jobs")} />
          <IconTile icon={<LogoutIcon />} label="Logout" accent="muted" fullWidth onClick={handleLogout} />
        </Box>
      </Box>
    </ScreenShell>
  );
}
