"use client";

import { Input, Label } from "@/components/ui/Field";
import { toLocalInputValue } from "@/lib/dates";

/**
 * The backdating mechanism: every entry's date+time, defaulting to now and
 * freely editable into the past. Day-of-life and feeding mix are always
 * computed from this value.
 */
export function OccurredAtField({
  value,
  onChange,
}: {
  value: string; // datetime-local format
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <Label htmlFor="occurred_at" className="mb-0">
          When
        </Label>
        <button
          type="button"
          onClick={() => onChange(toLocalInputValue(new Date()))}
          className="text-xs font-medium text-muted hover:text-ink"
        >
          Now
        </button>
      </div>
      <Input
        id="occurred_at"
        type="datetime-local"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-xs text-faint">
        Set a past date &amp; time to enter earlier days.
      </p>
    </div>
  );
}
