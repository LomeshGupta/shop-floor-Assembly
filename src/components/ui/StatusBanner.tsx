import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Zoom from "@mui/material/Zoom";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

interface StatusBannerProps {
  kind: "success" | "error";
  title: string;
  detail?: string;
}

/**
 * Full-width confirmation/error banner. This is the ONLY place the app
 * shows a "posted" confirmation — it must only be rendered after a
 * confirmed 2xx response from the ProductionService, never optimistically.
 */
export default function StatusBanner({ kind, title, detail }: StatusBannerProps) {
  const isSuccess = kind === "success";
  return (
    <Zoom in timeout={280}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          p: 4,
          borderRadius: 3,
          border: "1px solid",
          borderColor: isSuccess ? "success.main" : "error.main",
          backgroundColor: isSuccess ? "rgba(63,174,107,0.08)" : "rgba(225,80,63,0.08)",
          boxShadow: isSuccess
            ? "0 0 30px -8px rgba(63,174,107,0.5)"
            : "0 0 30px -8px rgba(225,80,63,0.5)",
          textAlign: "center",
        }}
      >
        {isSuccess ? (
          <CheckCircleIcon sx={{ fontSize: 60, color: "success.main" }} />
        ) : (
          <ErrorIcon sx={{ fontSize: 60, color: "error.main" }} />
        )}
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {detail}
          </Typography>
        )}
      </Box>
    </Zoom>
  );
}
