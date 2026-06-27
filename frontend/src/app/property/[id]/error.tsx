"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PropertyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h2 className="text-xl font-semibold">Couldn&apos;t load this property</h2>
      <p className="text-muted-foreground max-w-sm">
        The property may have been removed or an error occurred.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
