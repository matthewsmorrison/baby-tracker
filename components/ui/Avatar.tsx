/** Circle avatar: the profile photo when there is one, else an initial. */
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-9 w-9 text-sm",
    md: "h-10 w-10",
    lg: "h-16 w-16 text-xl",
  } as const;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${sizes[size]} shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent`}
    >
      {(name[0] ?? "?").toUpperCase()}
    </span>
  );
}
