"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import BigButton from "@/components/ui/BigButton";
import NumericField from "@/components/ui/NumericField";
import StatusBanner from "@/components/ui/StatusBanner";
import ScreenShell from "@/components/layout/ScreenShell";
import { apiFetch } from "@/lib/api-client";
import type { ApiError, Assignment } from "@/lib/business-central/types";

export default function ReportOutputPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentNo = decodeURIComponent(params.id);

  const [quantity, setQuantity] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Assignment | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const response = await apiFetch<Assignment>(
      `/api/shopfloor/assignments/${encodeURIComponent(assignmentNo)}/post-output`,
      {
        method: "POST",
        body: JSON.stringify({
          qtyToPostBase: Number(quantity),
          isFinal,
          // A fresh key per submit attempt — if this exact click is somehow
          // sent twice (double-tap, flaky connection retry), BC's
          // idempotency log (Shop Floor Idempotency Mgt) returns the
          // original result instead of posting twice.
          idempotencyKey: crypto.randomUUID(),
        }),
      },
    );
    setSubmitting(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setResult(response.data);
  }

  if (result) {
    return (
      <ScreenShell title="Report Output">
        <StatusBanner
          kind="success"
          title="Output Reported"
          detail={`${Number(quantity).toLocaleString()} reported. Final posting and inventory updates will be completed from Business Central.`}
        />
        <Box sx={{ mt: "auto" }}>
          <BigButton onClick={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}>Continue</BigButton>
        </Box>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Report Output" onBack={() => router.push(`/active-job/${encodeURIComponent(assignmentNo)}`)}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Enter the quantity completed. This records the output for review; final posting is performed from the Shop Floor Assignment in Business Central.
        </Typography>

        <NumericField label="Quantity" value={quantity} onChange={setQuantity} autoFocus suffix="base unit of measure" />

        <FormControlLabel
          control={<Checkbox checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />}
          label="This is the final output for this assignment"
        />

        {error && <StatusBanner kind="error" title="Could not report output" detail={error.message} />}

        <Box sx={{ mt: "auto" }}>
          <BigButton
            disabled={submitting || !quantity || Number(quantity) <= 0}
            onClick={handleSubmit}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {submitting ? "Saving…" : "Report Output"}
          </BigButton>
        </Box>
      </Box>
    </ScreenShell>
  );
}
