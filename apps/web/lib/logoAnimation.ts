/** The logo's page-change animation: the goal ring sweeps round to where it was, then the tick pops
    in, like the day's goal filling up. Works on anything rendering `components/Logo.tsx`
    (`data-ring`, `data-badge`). Web Animations, so nothing re-renders; a no-op under reduced
    motion. */
export function playLogo(root: Element | null, { duration = 560 } = {}) {
  if (!root || prefersReducedMotion()) return;
  const ease = "cubic-bezier(0.3, 0.7, 0.2, 1)";
  root.querySelector("[data-ring]")?.animate(
    [
      { strokeDasharray: "1", strokeDashoffset: "1" },
      { strokeDasharray: "1", strokeDashoffset: "0" },
    ],
    { duration, easing: ease },
  );
  root.querySelector("[data-badge]")?.animate(
    [{ transform: "scale(0)" }, { transform: "scale(1.25)", offset: 0.6 }, { transform: "scale(1)" }],
    { duration: duration * 0.55, delay: duration * 0.7, easing: ease, fill: "backwards" },
  );
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
