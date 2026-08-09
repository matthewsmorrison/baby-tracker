"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/lib/actions";
import { Button } from "@/components/ui/Button";

/** Accept-invite control that can actually show the action's error ("invite
 *  no longer valid", "sent to a different email", …) — a plain server-
 *  component form has nowhere to put the returned message. On success the
 *  action redirects to /today. */
export function AcceptInviteButton({
  token,
  label = "Accept invite",
  size = "md",
  fullWidth = false,
}: {
  token: string;
  label?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        size={size}
        disabled={pending}
        className={fullWidth ? "w-full" : undefined}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await acceptInvite(token);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? "Joining…" : label}
      </Button>
      {error && <p className="mt-2 text-xs text-alert">{error}</p>}
    </div>
  );
}
