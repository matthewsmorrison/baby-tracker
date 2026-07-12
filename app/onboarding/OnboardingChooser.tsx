"use client";

import { useState } from "react";
import { CreateBabyForm } from "./CreateBabyForm";
import { ProfessionalForm } from "./ProfessionalForm";

export function OnboardingChooser({
  defaultRole,
  defaultName,
}: {
  defaultRole: "parent" | "pro";
  defaultName?: string;
}) {
  const [role, setRole] = useState<"parent" | "pro">(defaultRole);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(
          [
            ["parent", "I’m a parent"],
            ["pro", "I’m a professional"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            onClick={() => setRole(value)}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              role === value
                ? "border-ink bg-ink text-on-ink"
                : "border-line bg-surface-alt text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {role === "parent" ? (
        <>
          <h2 className="mb-3 font-semibold">Add your baby</h2>
          <CreateBabyForm />
        </>
      ) : (
        <>
          <h2 className="mb-1 font-semibold">Set up your professional profile</h2>
          <p className="mb-3 text-sm text-muted">
            You’ll get a shareable page and a referral code. Families who invite
            you can share their log with you (read-only).
          </p>
          <ProfessionalForm defaultName={defaultName} />
        </>
      )}
    </div>
  );
}
