"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Operator } from "@/lib/business-central/types";

export function useOperator() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Operator | null>("/api/auth/session").then((result) => {
      if (cancelled) return;
      setOperator(result.ok ? result.data : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { operator, loading };
}
