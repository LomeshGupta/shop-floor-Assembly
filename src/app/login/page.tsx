"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import BoltIcon from "@mui/icons-material/Bolt";
import BigButton from "@/components/ui/BigButton";
import { apiFetch } from "@/lib/api-client";
import type { Operator } from "@/lib/business-central/types";

export default function LoginPage() {
  const router = useRouter();
  const [operatorCode, setOperatorCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const result = await apiFetch<Operator>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ operatorCode, password }),
    });

    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    router.push("/home");
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        position: "relative",
        overflow: "hidden",
        backgroundImage:
          "radial-gradient(ellipse 800px 500px at 50% -10%, rgba(255,122,26,0.16), transparent), radial-gradient(ellipse 600px 400px at 90% 100%, rgba(74,143,194,0.10), transparent)",
      }}
    >
      {/* Faint diagonal hazard-stripe band along the bottom — a nod to shop-floor signage, kept quiet */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 10,
          backgroundImage:
            "repeating-linear-gradient(135deg, #FF7A1A 0 18px, #101216 18px 36px)",
          opacity: 0.5,
        }}
      />

      <Container maxWidth="xs">
        <Fade in timeout={400}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundImage: "linear-gradient(180deg, #FFB238 0%, #FF7A1A 100%)",
                  boxShadow: "0 8px 32px -6px rgba(255,122,26,0.6)",
                }}
              >
                <BoltIcon sx={{ fontSize: 40, color: "#101216" }} />
              </Box>
              <Typography
                variant="h3"
                sx={{
                  textAlign: "center",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Shop Floor
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", letterSpacing: "0.02em" }}>
                Sign in to start your shift
              </Typography>
            </Box>

            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <TextField
              label="Operator Code"
              value={operatorCode}
              onChange={(e) => setOperatorCode(e.target.value)}
              autoFocus
              fullWidth
              autoComplete="username"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
            />

            <BigButton type="submit" disabled={submitting || !operatorCode || !password}>
              {submitting ? <CircularProgress size={28} color="inherit" /> : "Login"}
            </BigButton>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}
