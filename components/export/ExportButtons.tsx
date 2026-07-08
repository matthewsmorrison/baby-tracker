"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download, FileText } from "lucide-react";

export function ExportCard() {
  const tz = () =>
    encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);

  return (
    <Card className="p-5">
      <CardTitle>Your data</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Export everything you’ve logged — handy for a midwife, health visitor
        or GP appointment.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            window.location.href = `/api/export/csv?tz=${tz()}`;
          }}
        >
          <Download className="h-4 w-4" /> Download CSV
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            window.location.href = `/report?tz=${tz()}`;
          }}
        >
          <FileText className="h-4 w-4" /> Printable report
        </Button>
      </div>
    </Card>
  );
}
