"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

type CleanupResult = {
  dryRun: boolean;
  scanned: number;
  flaggedCount: number;
  archivedCount: number;
  flagged: Array<{ id: string; title: string; mismatches: string[] }>;
};

export function CookbookMaintenanceCard() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/cookbook/cleanup-mismatches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, scanInstructions: true }),
      });
      const data = (await res.json()) as CleanupResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function runArchive() {
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch("/api/cookbook/cleanup-mismatches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, scanInstructions: true }),
      });
      const data = (await res.json()) as CleanupResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Archive failed");
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      await queryClient.invalidateQueries({ queryKey: ["recipe-matches"] });
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4" />
            Recipe accuracy cleanup
          </CardTitle>
          <CardDescription>
            Scans <strong>your</strong> AI-generated recipes (same batches as your
            account). Flags titles or steps that name foods from a dictionary (herbs,
            proteins, pasta shapes, etc.) when no ingredient line contains that name.
            Review the list, then archive mismatches — they are hidden from the cookbook,
            not deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={scanning || archiving}
              onClick={runScan}
            >
              {scanning ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Scan
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={
                scanning ||
                archiving ||
                !result ||
                result.flaggedCount === 0
              }
              onClick={() => setConfirmOpen(true)}
            >
              Archive flagged
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Scanned {result.scanned} recipe(s).{" "}
                <span className="font-medium text-foreground">
                  {result.flaggedCount} flagged
                </span>
                {result.archivedCount > 0 ? (
                  <>
                    {" "}
                    · Archived {result.archivedCount}
                  </>
                ) : null}
                .
              </p>
              {result.flagged.length > 0 ? (
                <ul className="max-h-52 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3 text-left">
                  {result.flagged.map((f) => (
                    <li key={f.id} className="text-xs">
                      <span className="font-medium text-foreground">
                        {f.title}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.mismatches.map((m) => (
                          <Badge
                            key={m}
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : result.scanned > 0 ? (
                <p className="text-muted-foreground">No mismatches found.</p>
              ) : (
                <p className="text-muted-foreground">
                  No eligible AI recipes (from your generation jobs) to scan.
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive flagged recipes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set{" "}
              <strong>{result?.flaggedCount ?? 0} recipe(s)</strong> to archived.
              You can restore them later in the database if needed; the app lists only
              active recipes in the cookbook.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiving}
              onClick={(e) => {
                e.preventDefault();
                void runArchive();
              }}
            >
              {archiving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
