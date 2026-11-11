"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import OutputIcon from "@mui/icons-material/Output";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CancelIcon from "@mui/icons-material/Cancel";
import HistoryIcon from "@mui/icons-material/History";
import BigButton from "@/components/ui/BigButton";
import Counter from "@/components/ui/Counter";
import PulseDot from "@/components/ui/PulseDot";
import ScreenShell from "@/components/layout/ScreenShell";
import { apiFetch } from "@/lib/api-client";
import { useOperator } from "@/hooks/useOperator";
import type { ApiError, Assignment } from "@/lib/business-central/types";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function ActiveJobPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { operator } = useOperator();
  const assignmentNo = decodeURIComponent(params.id);

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Assignment>(
      `/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}`,
    ).then((result) => {
      if (result.ok) {
        setAssignment(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, [assignmentNo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state at the start of a data fetch triggered by assignmentNo changing
    load();
  }, [load]);

  async function handleStart() {
    setActionBusy(true);
    setError(null);

    const result = await apiFetch<Assignment>(
      `/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/start`,
      { method: "POST" },
    );

    if (result.ok) {
      setAssignment({
        ...result.data,
        status: "In Progress",
      });
    } else {
      setError(result.error);
    }

    setActionBusy(false);
  }

  async function handlePause() {
    setActionBusy(true);
    const result = await apiFetch<Assignment>(
      `/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/stop`,
      {
        method: "POST",
        body: JSON.stringify({ pause: true }),
      },
    );
    setActionBusy(false);
    if (result.ok) setAssignment(result.data);
    else setError(result.error);
  }

  async function handleCancel() {
    setActionBusy(true);
    const result = await apiFetch<Assignment>(
      `/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || "Cancelled from PWA" }),
      },
    );
    setActionBusy(false);
    setCancelOpen(false);
    if (result.ok) setAssignment(result.data);
    else setError(result.error);
  }

  if (loading) {
    return (
      <ScreenShell title="Assignment">
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </ScreenShell>
    );
  }

  if (error && !assignment) {
    return (
      <ScreenShell title="Assignment" onBack={() => router.push("/jobs")}>
        <Alert severity="error">{error.message}</Alert>
      </ScreenShell>
    );
  }

  if (!assignment) return null;

  const progressPct =
    assignment.assignedQtyBase > 0
      ? Math.min(
          100,
          Math.round(
            (assignment.postedQtyBase / assignment.assignedQtyBase) * 100,
          ),
        )
      : 0;
  const canSupervisorCancel =
    operator?.role === "Supervisor" || operator?.role === "Admin";
  const isRunning = assignment.status === "In Progress";
  const isTerminal =
    assignment.status === "Completed" || assignment.status === "Cancelled";

  return (
    <ScreenShell title={assignment.number} onBack={() => router.push("/jobs")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {error && <Alert severity="error">{error.message}</Alert>}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isRunning && <PulseDot />}
          <Typography
            variant="overline"
            sx={{
              color: isRunning ? "success.main" : "text.secondary",
              letterSpacing: "0.12em",
            }}
          >
            {assignment.status}
          </Typography>
        </Box>

        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
          {assignment.description || assignment.itemNo}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Assembly Order {assignment.assemblyOrderNo} · {assignment.itemNo} ·{" "}
          {assignment.locationCode}
        </Typography>

        <Card>
          <CardContent>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
            >
              <Counter
                label="Posted"
                value={assignment.postedQtyBase}
                color="secondary"
              />
              <Counter
                label="Remaining"
                value={assignment.remainingQtyBase}
                color="primary"
              />
              <Counter
                label="Assigned"
                value={assignment.assignedQtyBase}
                color="text.primary"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{ height: 7, borderRadius: 4, mb: 1 }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {progressPct}% complete ·{" "}
              {formatElapsed(assignment.totalElapsedTimeSec)} logged
            </Typography>
          </CardContent>
        </Card>

        {assignment.outputQtyToSubmitBase > 0 && (
          <Alert severity="info">{assignment.outputQtyToSubmitBase.toLocaleString()} output is awaiting final submission from Business Central.</Alert>
        )}

        <Divider />

        <BigButton
          startIcon={<HistoryIcon />}
          variant="outlined"
          color="secondary"
          onClick={() => router.push(`/active-job/${encodeURIComponent(assignment.number)}/activity`)}
        >
          Output & Time Entry History
        </BigButton>

        {!isTerminal && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {!isRunning ? (
              <BigButton
                startIcon={<PlayArrowIcon />}
                color="success"
                disabled={actionBusy}
                onClick={handleStart}
              >
                {assignment.status === "Paused" ? "Resume Work" : "Start Work"}
              </BigButton>
            ) : (
              <BigButton
                startIcon={<PauseIcon />}
                color="warning"
                disabled={actionBusy}
                onClick={handlePause}
              >
                Pause
              </BigButton>
            )}

            <BigButton
              startIcon={<Inventory2Icon />}
              color="secondary"
              variant="outlined"
              disabled={actionBusy}
              onClick={() => router.push(`/active-job/${encodeURIComponent(assignment.number)}/materials`)}
            >
              Material Consumption / Replacement
            </BigButton>

            <BigButton
              startIcon={<OutputIcon />}
              color="primary"
              variant="outlined"
              disabled={actionBusy}
              onClick={() =>
                router.push(
                  `/report-output/${encodeURIComponent(assignment.number)}`,
                )
              }
            >
              Report Output
            </BigButton>

            {canSupervisorCancel && (
              <Button
                startIcon={<CancelIcon />}
                color="error"
                variant="text"
                disabled={actionBusy}
                onClick={() => setCancelOpen(true)}
              >
                Cancel Assignment
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle>Cancel this assignment?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            This cannot be undone. Posted quantity already recorded in Business
            Central is not reversed.
          </Typography>
          <TextField
            label="Reason"
            fullWidth
            multiline
            minRows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Back</Button>
          <Button color="error" onClick={handleCancel} disabled={actionBusy}>
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </ScreenShell>
  );
}
