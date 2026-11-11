"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ScreenShell from "@/components/layout/ScreenShell";
import BigButton from "@/components/ui/BigButton";
import { apiFetch } from "@/lib/api-client";
import type { ApiError, Assignment, AssignmentLine, AssignmentTimeEntry } from "@/lib/business-central/types";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

function formatDate(value?: string | null): string {
  if (!value || value.startsWith("0001-01-01")) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function AssignmentActivityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentNo = decodeURIComponent(params.id);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [outputHistory, setOutputHistory] = useState<AssignmentLine[]>([]);
  const [timeEntries, setTimeEntries] = useState<AssignmentTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [outputHistoryError, setOutputHistoryError] = useState<string>("");
  const [timeEntriesError, setTimeEntriesError] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [assignmentResult, outputResult, timeResult] = await Promise.all([
      apiFetch<Assignment>(`/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}`),
      apiFetch<AssignmentLine[]>(`/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/history`),
      apiFetch<AssignmentTimeEntry[]>(`/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/time-entries`),
    ]);
    if (!assignmentResult.ok) {
      setError(assignmentResult.error);
      setAssignment(null);
    } else {
      setAssignment(assignmentResult.data);
      setError(null);
    }
    if (outputResult.ok) {
      setOutputHistory(outputResult.data);
      setOutputHistoryError("");
    } else {
      setOutputHistoryError(outputResult.error.message);
      setOutputHistory([]);
    }
    if (timeResult.ok) {
      setTimeEntries(timeResult.data);
      setTimeEntriesError("");
    } else {
      setTimeEntriesError(timeResult.error.message);
      setTimeEntries([]);
    }
    setLoading(false);
  }, [assignmentNo]);

  useEffect(() => { void load(); }, [load]);

  const outputMetrics = useMemo(() => {
    const isPosted = (row: AssignmentLine) =>
      row.isPostedToBC === true || row.postedQtyBase > 0 || Boolean(row.postingReference);
    const reported = outputHistory.reduce(
      (sum, row) => sum + ((row.reportedQtyBase ?? 0) > 0 ? row.reportedQtyBase! : row.postedQtyBase),
      0,
    );
    const posted = outputHistory.reduce(
      (sum, row) => sum + (isPosted(row) ? row.postedQtyBase : 0),
      0,
    );
    const pendingRows = outputHistory.filter((row) => !isPosted(row));
    const pendingRowsQty = pendingRows.reduce(
      (sum, row) => sum + ((row.reportedQtyBase ?? 0) > 0 ? row.reportedQtyBase! : 0),
      0,
    );
    // Backward compatibility for a report staged before this history-row update.
    const headerPendingQty = assignment?.outputQtyToSubmitBase ?? 0;
    const pending = pendingRowsQty > 0 ? pendingRowsQty : headerPendingQty;
    return {
      reported: reported + (pendingRowsQty > 0 ? 0 : headerPendingQty),
      posted: outputHistory.length > 0 ? posted : (assignment?.postedQtyBase ?? 0),
      pending,
    };
  }, [outputHistory, assignment]);

  if (loading) {
    return <ScreenShell title="Output & Time History"><Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box></ScreenShell>;
  }

  if (error || !assignment) {
    return <ScreenShell title="Output & Time History" onBack={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}><Alert severity="error">{error?.message ?? "Assignment could not be loaded."}</Alert></ScreenShell>;
  }

  return (
    <ScreenShell title="Output & Time History" onBack={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}>
      <Stack spacing={2.25} sx={{ pb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>{assignment.number}</Typography>
          <Typography variant="body2" color="text.secondary">Assembly Order {assignment.assemblyOrderNo} · {assignment.description || assignment.itemNo}</Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.25 }}>
          <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Operator reported total</Typography><Typography variant="h5" fontWeight={800}>{outputMetrics.reported.toLocaleString()}</Typography></CardContent></Card>
          <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Posted by Business Central</Typography><Typography variant="h5" fontWeight={800}>{outputMetrics.posted.toLocaleString()}</Typography></CardContent></Card>
          <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Awaiting BC submission</Typography><Typography variant="h5" fontWeight={800}>{outputMetrics.pending.toLocaleString()}</Typography></CardContent></Card>
        </Box>

        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Operator output reports</Typography>
          {outputHistoryError && <Alert severity="warning">Could not load the full output report history: {outputHistoryError}</Alert>}
          {assignment.outputQtyToSubmitBase > 0 && !outputHistory.some((row) => row.isPostedToBC === false && (row.reportedQtyBase ?? 0) > 0) && (
            <Card variant="outlined" sx={{ mb: 1 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography fontWeight={700}>Operator report awaiting BC</Typography>
                  <Chip label="Pending" color="warning" size="small" />
                </Stack>
                <Typography variant="h5" fontWeight={800}>{assignment.outputQtyToSubmitBase.toLocaleString()} units reported</Typography>
                <Typography variant="caption" color="text.secondary">Reported by {assignment.outputReportedBy || assignment.assignedOperatorCode} · {formatDate(assignment.outputReportedAt || "")}</Typography>
                <Typography variant="body2" color="text.secondary">Business Central posted: 0 units. Inventory has not yet been updated.</Typography>
              </CardContent>
            </Card>
          )}
          {outputHistory.length === 0 && assignment.outputQtyToSubmitBase <= 0 ? (
            <Alert severity="info">No operator output reports have been recorded for this assignment yet.</Alert>
          ) : outputHistory.map((row) => {
            const postedToBC = row.isPostedToBC === true || row.postedQtyBase > 0 || Boolean(row.postingReference);
            const reportedQty = (row.reportedQtyBase ?? 0) > 0 ? row.reportedQtyBase! : row.postedQtyBase;
            return (
              <Card key={`${row.assignmentNo}-${row.lineNo}`} variant="outlined" sx={{ mb: 1 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography fontWeight={800}>{reportedQty.toLocaleString()} units reported by operator</Typography>
                    <Chip label={postedToBC ? "Posted in BC" : "Awaiting BC"} color={postedToBC ? "success" : "warning"} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">Operator: {row.reportedByOperatorCode || row.postedByOperatorCode || "—"} · Reported at: {formatDate(row.reportedAt || "")}</Typography>
                  <Typography variant="body2" color="text.secondary">Business Central posted: {postedToBC ? row.postedQtyBase.toLocaleString() : "Not posted yet"} {postedToBC ? `· Posted at: ${formatDate(row.postedAt)}` : ""}</Typography>
                  {postedToBC && <Typography variant="body2" color="text.secondary">BC posting reference: {row.postingReference || "—"} · Posting date: {row.postingDate || "—"}</Typography>}
                  {row.isFinalPosting && <Chip label="Final output" size="small" variant="outlined" sx={{ mt: 1 }} />}
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Divider />
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Time entries</Typography>
          {timeEntriesError && <Alert severity="warning">Could not load time entries: {timeEntriesError}</Alert>}
          {timeEntries.length === 0 ? (
            <Alert severity="info">No time entries are available for this assignment.</Alert>
          ) : timeEntries.map((entry) => {
            const elapsed = entry.isOpen
              ? Math.max(0, Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000))
              : entry.elapsedSeconds;
            return (
              <Card key={entry.entryNo} variant="outlined" sx={{ mb: 1 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography fontWeight={800}>{formatDuration(elapsed)}</Typography>
                    <Chip label={entry.isOpen ? "Running" : "Closed"} color={entry.isOpen ? "warning" : "success"} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">Operator: {entry.operatorCode}</Typography>
                  <Typography variant="body2" color="text.secondary">Started: {formatDate(entry.startedAt)}</Typography>
                  <Typography variant="body2" color="text.secondary">Stopped: {formatDate(entry.stoppedAt)}</Typography>
                </CardContent>
              </Card>
            );
          })}
        </Box>
        <BigButton variant="outlined" onClick={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}>Back to Assignment</BigButton>
      </Stack>
    </ScreenShell>
  );
}
