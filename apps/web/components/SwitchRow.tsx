"use client";

import { useId } from "react";
import Hint from "@/components/Hint";
import { rewardGradient, usePopKey, useReward } from "@/components/reward/Reward";
import { CheckIcon } from "@/components/tools";

export default function SwitchRow({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  const reward = useReward();
  const pop = usePopKey(String(checked));
  if (reward) {
    // Reward look: the whole row is a card you tap; on, the switch lights up with a check.
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className="relative flex items-center justify-between gap-3 rounded-2xl bg-background py-2.5 pl-3.5 pr-2.5 text-left text-sm transition hover:bg-surface-hover active:scale-[0.98] disabled:opacity-50"
        >
          <span id={id} className={`font-semibold ${checked ? "text-foreground" : "text-muted"}`}>
            {label}
          </span>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "" : "bg-surface"}`}
            style={checked ? { background: rewardGradient(reward.color) } : undefined}
          >
            <span
              key={pop}
              className={`absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full shadow transition-transform ${
                checked ? "translate-x-5 bg-accent-foreground text-accent" : "bg-foreground/80"
              } ${pop ? "reward-pop" : ""}`}
            >
              {checked && <CheckIcon className="h-3.5 w-3.5" />}
            </span>
          </span>
          {pop > 0 && checked && (
            <span key={`g${pop}`} aria-hidden className="reward-glow pointer-events-none absolute inset-0 rounded-2xl" style={{ "--reward": reward.color } as React.CSSProperties} />
          )}
        </button>
        {hint && <Hint>{hint}</Hint>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span id={id} className="font-medium text-muted">
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            checked ? "bg-accent" : "bg-background"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
              checked ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}
