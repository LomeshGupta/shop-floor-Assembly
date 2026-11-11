"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";

import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircle";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import ScreenShell from "@/components/layout/ScreenShell";
import PulseDot from "@/components/ui/PulseDot";
import Counter from "@/components/ui/Counter";

import { apiFetch } from "@/lib/api-client";
import type { ApiError, Assignment } from "@/lib/business-central/types";

const STATUS_COLOR: Record<
  Assignment["status"],
  "default" | "primary" | "success" | "warning" | "error"
> = {
  Open: "default",
  "In Progress": "success",
  Paused: "warning",
  Completed: "primary",
  Cancelled: "error",
};

export default function AssignmentsPage() {
  const router = useRouter();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<Assignment[]>("/api/shopfloor/assignments");

    if (result.ok) {
      setAssignments(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state at the start of the initial data fetch
    load();
  }, [load]);

  const active = assignments.filter(
    (a) => a.status !== "Completed" && a.status !== "Cancelled",
  );
  const closed = assignments.filter(
    (a) => a.status === "Completed" || a.status === "Cancelled",
  );

  return (
    <ScreenShell title="My Assignments" onBack={() => router.push("/home")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <PulseDot />
            <Typography
              variant="overline"
              sx={{ color: "success.main", letterSpacing: "0.12em" }}
            >
              Assembly
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            My Assignments
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mt: 0.75 }}
          >
            Select an assignment to continue working. New assignments are
            created by your supervisor in Business Central.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error.message}</Alert>}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : active.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 6, textAlign: "center" }}>
              <PrecisionManufacturingIcon
                sx={{ fontSize: 52, color: "text.secondary", mb: 1 }}
              />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                No active assignments
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
You have no open assembly assignments right now. Completed assignments remain available below for output and time history.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {active.map((assignment) => {
              const progressPct =
                assignment.assignedQtyBase > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (assignment.postedQtyBase /
                          assignment.assignedQtyBase) *
                          100,
                      ),
                    )
                  : 0;

              return (
                <Card
                  key={assignment.number}
                  sx={{
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    transition: "all 0.2s ease",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
                  }}
                >
                  <CardActionArea
                    onClick={() =>
                      router.push(
                        `/active-job/${encodeURIComponent(assignment.number)}`,
                      )
                    }
                  >
                    <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1.5,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: "success.main",
                              color: "success.contrastText",
                              flexShrink: 0,
                            }}
                          >
                            <PlayCircleOutlineIcon />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 800, lineHeight: 1.2 }}
                            >
                              {assignment.number}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "text.secondary" }}
                            >
                              Assembly Order {assignment.assemblyOrderNo}
                            </Typography>
                          </Box>
                        </Box>

                        <Chip
                          icon={
                            assignment.status === "In Progress" ? (
                              <PulseDot />
                            ) : undefined
                          }
                          label={assignment.status}
                          size="small"
                          color={STATUS_COLOR[assignment.status]}
                          variant="outlined"
                          sx={{
                            flexShrink: 0,
                            "& .MuiChip-icon": { ml: 0.75 },
                          }}
                        />
                      </Box>

                      <Divider sx={{ my: 1.75 }} />

                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, lineHeight: 1.25, mb: 0.5 }}
                      >
                        {assignment.description || assignment.itemNo}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {assignment.itemNo} · {assignment.locationCode}
                      </Typography>

                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mt: 2.25,
                          mb: 2,
                        }}
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

                      <Box>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mb: 0.75,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            Progress
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 700, color: "text.secondary" }}
                          >
                            {progressPct}% of{" "}
                            {assignment.assignedQtyBase.toLocaleString()}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progressPct}
                          sx={{ height: 7, borderRadius: 4 }}
                        />
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          mt: 1.75,
                        }}
                      >
                        <ArrowForwardIosIcon
                          sx={{ fontSize: 16, color: "text.secondary" }}
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        )}

        {closed.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1 }}>
            <Divider />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Completed / Closed assignments</Typography>
            <Typography variant="body2" color="text.secondary">Open an assignment to review the output posted by you and the recorded time entries.</Typography>
            {closed.map((assignment) => (
              <Card key={assignment.number} variant="outlined">
                <CardActionArea onClick={() => router.push(`/active-job/${encodeURIComponent(assignment.number)}`)}>
                  <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700}>{assignment.number}</Typography>
                      <Typography variant="body2" color="text.secondary">{assignment.description || assignment.itemNo} · Order {assignment.assemblyOrderNo}</Typography>
                      <Typography variant="caption" color="text.secondary">Posted {assignment.postedQtyBase.toLocaleString()} of {assignment.assignedQtyBase.toLocaleString()} · {formatClosedElapsed(assignment.totalElapsedTimeSec)}</Typography>
                    </Box>
                    <Chip label={assignment.status} size="small" color={STATUS_COLOR[assignment.status]} variant="outlined" />
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </ScreenShell>
  );
}

function formatClosedElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m logged`;
}
