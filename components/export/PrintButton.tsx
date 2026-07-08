"use client";

import { Button } from "@/components/ui/Button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" /> Save as PDF / print
    </Button>
  );
}
