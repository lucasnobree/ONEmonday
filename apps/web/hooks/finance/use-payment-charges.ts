"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createPaymentCharge } from "@/lib/actions/finance/payments";

export type ChargeStatus =
  | "draft"
  | "pending"
  | "received"
  | "overdue"
  | "cancelled"
  | "error";

export interface PaymentCharge {
  id: string;
  sector_id: string;
  invoice_id: string;
  provider: string;
  billing_type: "pix" | "boleto" | "undefined";
  amount_cents: number;
  currency: string;
  due_date: string;
  status: ChargeStatus;
  provider_ref: string | null;
  boleto_line: string | null;
  pix_payload: string | null;
  invoice_url: string | null;
  status_reason: string | null;
  created_at: string;
}

/** All payment charges for a sector, newest first. */
export function usePaymentCharges(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-payment-charges", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const { data, error } = await supabase
        .from("finance_payment_charges")
        .select(
          `id, sector_id, invoice_id, provider, billing_type, amount_cents,
           currency, due_date, status, provider_ref, boleto_line, pix_payload,
           invoice_url, status_reason, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentCharge[];
    },
    enabled: !!sectorId,
  });
}

export function useCreatePaymentCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createPaymentCharge(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-payment-charges"],
      });
    },
  });
}
