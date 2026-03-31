"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateQueriesAffectedByPantry } from "@/hooks/use-inventory";
import type { ParsedReceipt } from "@/lib/ai/receipt-parser";

export interface ConfirmReceiptItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface ConfirmReceiptPayload {
  items: ConfirmReceiptItem[];
  storeName?: string | null;
  receiptDate?: string | null;
  totalAmount?: number | null;
  imageBase64?: string;
}

export interface ConfirmReceiptResult {
  receiptScanId: string;
  itemsProcessed: number;
  inventoryUpdated: number;
  inventoryCreated: number;
  totalCost: number;
  generationTriggered: boolean;
}

export function useParseReceipt() {
  return useMutation<ParsedReceipt, Error, string>({
    mutationFn: async (imageBase64: string) => {
      const res = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to parse receipt");
      }
      return res.json();
    },
  });
}

export function useConfirmReceipt() {
  const qc = useQueryClient();
  return useMutation<ConfirmReceiptResult, Error, ConfirmReceiptPayload>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/ai/confirm-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to confirm receipt");
      }
      return res.json();
    },
    onSuccess: async () => {
      await invalidateQueriesAffectedByPantry(qc);
    },
  });
}
