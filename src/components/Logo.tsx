// The "솔" mark: a pair of pine needles from one sheath. Korean red pine grows its needles in pairs,
// which stands for the two things the app compares: the earlier in-person visit (lighter needle)
// and today's symptom. The needles differ in length and curve, like a real sprig, so the mark does not
// read as the letter "V". Colors come from the design tokens; src/app/icon.svg is the same drawing
// with fixed colors, because a browser tab icon cannot read CSS variables.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-accent" />
      <path
        d="M15.4 24.5C14.2 18.2 14.8 11.8 18.6 5.8"
        className="fill-none stroke-accent-contrast"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M16.8 24.5C19.2 20 22.6 16.6 26 14.6"
        className="fill-none stroke-accent-contrast"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="14" y="23" width="4" height="4.5" rx="1.4" className="fill-accent-contrast" />
    </svg>
  );
}
