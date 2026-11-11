"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ScreenShell from "@/components/layout/ScreenShell";
import BigButton from "@/components/ui/BigButton";
import { apiFetch } from "@/lib/api-client";
import type { ApiError, AssignmentComponent } from "@/lib/business-central/types";

export default function AssignmentMaterialsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentNo = decodeURIComponent(params.id);
  const [components, setComponents] = useState<AssignmentComponent[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState("");
  const [replacementLine, setReplacementLine] = useState<AssignmentComponent | null>(null);
  const [replacementItemNo, setReplacementItemNo] = useState("");
  const [replacementReason, setReplacementReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<AssignmentComponent[]>(`/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/components`);
    if (result.ok) {
      setComponents(result.data);
      setQuantities(Object.fromEntries(result.data.map((line) => [line.lineNo, line.consumptionEntered ? String(line.consumedQtyBase) : ""])));
      setRemarks(Object.fromEntries(result.data.map((line) => [line.lineNo, line.consumptionRemarks ?? ""])));
      setError(null);
    } else setError(result.error);
    setLoading(false);
  }, [assignmentNo]);

  useEffect(() => { void load(); }, [load]);

  async function saveConsumption(line: AssignmentComponent) {
    const raw = quantities[line.lineNo] ?? "";
    const quantity = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(quantity) || quantity < 0) {
      setError({ code: "VALIDATION_ERROR", message: "Enter a valid consumption quantity (zero is allowed)." });
      return;
    }
    const totalPosted = line.totalPostedConsumedQtyBase ?? line.lastPostedConsumedQtyBase ?? 0;
    const remainingAllowance = Math.max(0, line.expectedQtyBase - totalPosted);
    if (quantity > remainingAllowance + 0.00001) {
      setError({ code: "VALIDATION_ERROR", message: `Consumption exceeds the remaining expected allowance of ${remainingAllowance.toLocaleString()} ${line.unitOfMeasureCode}.` });
      return;
    }
    setBusyLine(line.lineNo);
    setError(null);
    const result = await apiFetch<AssignmentComponent>(`/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/consumption`, {
      method: "POST",
      body: JSON.stringify({ lineNo: line.lineNo, qtyConsumedBase: quantity, remarks: remarks[line.lineNo] ?? "" }),
    });
    setBusyLine(null);
    if (!result.ok) setError(result.error);
    else {
      setComponents((current) => current.map((row) => row.lineNo === line.lineNo ? result.data : row));
      setNotice(`Consumption saved for ${result.data.itemNo}. It will be applied when Business Central submits the assignment.`);
    }
  }

  async function submitReplacement() {
    if (!replacementLine) return;
    setBusyLine(replacementLine.lineNo);
    setError(null);
    const result = await apiFetch<AssignmentComponent>(`/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/replacement-request`, {
      method: "POST",
      body: JSON.stringify({ lineNo: replacementLine.lineNo, replacementItemNo, reason: replacementReason }),
    });
    setBusyLine(null);
    if (!result.ok) setError(result.error);
    else {
      setComponents((current) => current.map((row) => row.lineNo === result.data.lineNo ? result.data : row));
      setNotice("Replacement request sent to Business Central for supervisor approval.");
      setReplacementLine(null);
      setReplacementItemNo("");
      setReplacementReason("");
    }
  }

  return (
    <ScreenShell title="Material Consumption" onBack={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}>
      <Stack spacing={2} sx={{ pb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>BOM materials</Typography>
          <Typography variant="body2" color="text.secondary">Enter the actual quantity consumed for each component. Replacement requests require approval in Business Central.</Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error.message}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
        {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : components.length === 0 ? (
          <Alert severity="info">No item components were found on the linked Assembly Order.</Alert>
        ) : components.map((line) => (
          <Card key={line.lineNo} variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{line.itemNo}</Typography>
                    <Typography variant="body2" color="text.secondary">{line.description}</Typography>
                  </Box>
                  <Chip size="small" label={line.replacementStatus === "None" ? "BOM item" : line.replacementStatus} color={line.replacementStatus === "Approved" ? "success" : line.replacementStatus === "Pending" ? "warning" : "default"} />
                </Box>
                {line.originalItemNo !== line.itemNo && <Typography variant="caption" color="text.secondary">Original BOM item: {line.originalItemNo}</Typography>}
                <Typography variant="body2" color="text.secondary">Expected total: {line.expectedQtyBase.toLocaleString()} {line.unitOfMeasureCode} · Posted consumption: {(line.totalPostedConsumedQtyBase ?? line.lastPostedConsumedQtyBase).toLocaleString()} · Remaining allowance: {Math.max(0, line.expectedQtyBase - (line.totalPostedConsumedQtyBase ?? line.lastPostedConsumedQtyBase)).toLocaleString()}</Typography>
                {line.replacementStatus === "Pending" && <Alert severity="warning">Replacement {line.requestedReplacementItemNo} is awaiting supervisor approval. {line.replacementReason}</Alert>}
                {line.replacementStatus === "Rejected" && <Alert severity="error">Last replacement request was rejected. You may submit a new request.</Alert>}
                <TextField
                  fullWidth
                  type="number"
                  label={`Actual consumed (${line.unitOfMeasureCode || "base UOM"})`}
                  value={quantities[line.lineNo] ?? ""}
                  onChange={(event) => setQuantities((current) => ({ ...current, [line.lineNo]: event.target.value }))}
                  slotProps={{ htmlInput: { min: 0, max: Math.max(0, line.expectedQtyBase - (line.totalPostedConsumedQtyBase ?? line.lastPostedConsumedQtyBase)), step: "any" } }}
                  disabled={line.replacementStatus === "Pending" || busyLine === line.lineNo}
                />
                <TextField
                  fullWidth
                  label="Remarks (optional)"
                  value={remarks[line.lineNo] ?? ""}
                  onChange={(event) => setRemarks((current) => ({ ...current, [line.lineNo]: event.target.value }))}
                  disabled={line.replacementStatus === "Pending" || busyLine === line.lineNo}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="contained" onClick={() => void saveConsumption(line)} disabled={busyLine === line.lineNo || line.replacementStatus === "Pending"}>
                    {busyLine === line.lineNo ? <CircularProgress size={18} color="inherit" /> : "Save consumption"}
                  </Button>
                  <Button variant="outlined" onClick={() => { setReplacementLine(line); setReplacementItemNo(""); setReplacementReason(""); }} disabled={line.replacementStatus === "Pending" || busyLine === line.lineNo}>Request replacement</Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
        <Divider />
        <Typography variant="caption" color="text.secondary">Consumption and replacement requests are saved in Business Central. Inventory is not posted from this screen; final submission remains a Business Central action.</Typography>
        <BigButton variant="outlined" onClick={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}>Back to Assignment</BigButton>
      </Stack>
      <Dialog open={Boolean(replacementLine)} onClose={() => setReplacementLine(null)} fullWidth>
        <DialogTitle>Request BOM item replacement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">Current item: {replacementLine?.itemNo} — {replacementLine?.description}</Typography>
            <TextField autoFocus label="Replacement item no." value={replacementItemNo} onChange={(event) => setReplacementItemNo(event.target.value.toUpperCase())} fullWidth />
            <TextField label="Reason" value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplacementLine(null)}>Cancel</Button>
          <Button onClick={() => void submitReplacement()} disabled={!replacementItemNo.trim() || !replacementReason.trim() || busyLine !== null}>Send request</Button>
        </DialogActions>
      </Dialog>
    </ScreenShell>
  );
}
