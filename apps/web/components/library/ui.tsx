"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import ToolIntro, { IntroButton, useIntro } from "@/components/help/ToolIntro";
import { ICON_BY_ID } from "@/components/help/helpParts";
import { BackButton, MenuButton, tuneSummary } from "@/components/library/shared";
import { ChevronRightIcon, ChordChartIcon, FileIcon, NoteIcon, SearchIcon, SetlistIcon, ShareIcon } from "@/components/tools";
import { formatComposer, keyPitchClass } from "@/lib/iRealPro";
import { topicById } from "@/lib/helpContent";
import type { Tune } from "@/lib/types";
import type { LibrarySongMeta } from "@/lib/useChordChartsLibrary";
import type { Setlist } from "@/lib/useSetlists";
import { displayKey } from "@jam-practice/core/setlistKeys";

/** The look of the Tunes and Chord Charts pages (`components/library/*`): a header card with the
    page's search in it, rows grouped in cards with a coloured key badge, and playlists / setlists /
    lists as cards. Colours come from the theme (`--key-0…11` in globals.css, from the accent). */

// ---------- colour ----------

/** A key's colour (one per key, neighbours on the circle of fifths close together), or the
    muted colour when there's no key. */
export function keyColor(label: string | null | undefined): string {
  if (!label || !/^[A-Ga-g]/.test(label.trim())) return "var(--muted)";
  return `var(--key-${keyPitchClass(label)}, var(--accent))`;
}

/** A stable colour for a name (playlists, setlists) — one of the 12 key colours. */
export function nameColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `var(--key-${h % 12}, var(--accent))`;
}

export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

// ---------- small pieces ----------

export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

/** A tune's or chart's key in a little tile of the key's colour ("Gm", "Bb"). */
export function KeyBadge({ label, size = "md" }: { label: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const color = keyColor(label);
  const text = label ? displayKey(label) : "";
  const dims =
    size === "lg" ? "h-12 w-12 rounded-2xl text-lg sm:h-16 sm:w-16 sm:text-2xl" : size === "sm" ? "h-8 w-8 rounded-lg text-xs" : "h-11 w-11 rounded-xl text-sm";
  return (
    <span className={`flex shrink-0 items-center justify-center font-extrabold tracking-tight ${dims}`} style={{ background: tint(color, 16), color }} aria-hidden>
      {text ? (
        <span className="max-w-full truncate px-0.5">{text.length > 4 ? text.slice(0, 4) : text}</span>
      ) : (
        <NoteIcon className={size === "lg" ? "h-7 w-7" : "h-4 w-4"} />
      )}
    </span>
  );
}

export function Chip({ children, accent = false, title }: { children: ReactNode; accent?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${accent ? "bg-accent/15 text-accent" : "bg-background text-muted"}`}
    >
      {children}
    </span>
  );
}

/** A pill button — `primary` filled with the accent, else plain. A link with `href`. */
export function Pill({
  icon: Icon,
  label,
  onClick,
  href,
  primary = false,
  disabled = false,
  iconOnlyOnPhone = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  primary?: boolean;
  disabled?: boolean;
  iconOnlyOnPhone?: boolean;
}) {
  const cls = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
    iconOnlyOnPhone && Icon ? "w-10 sm:w-auto sm:px-4" : "px-4"
  } ${primary ? "bg-accent text-accent-foreground hover:bg-accent-hover" : "bg-background text-foreground hover:bg-surface-hover"}`;
  const inner = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className={iconOnlyOnPhone && Icon ? "hidden sm:inline" : undefined}>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls} aria-label={label}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} aria-label={label}>
      {inner}
    </button>
  );
}

/** Tunes · Setlists · Chord Charts · Files — the library's own tabs, in each page's header. */
export function LibraryTabs({ active }: { active: "tunes" | "setlists" | "charts" | "files" }) {
  const tabs = [
    { id: "tunes", label: "Tunes", href: "/tunes", icon: NoteIcon },
    {
      id: "setlists",
      label: "Setlists",
      href: "/tunes/setlists",
      icon: SetlistIcon,
    },
    {
      id: "charts",
      label: "Chord Charts",
      short: "Charts",
      href: "/chord-charts",
      icon: ChordChartIcon,
    },
    { id: "files", label: "Files", href: "/files", icon: FileIcon },
  ] as const;
  return (
    <nav className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface p-1 [scrollbar-width:none] sm:gap-1" aria-label="Library">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
            active === t.id ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <t.icon className="hidden h-3.5 w-3.5 sm:block" />
          {"short" in t ? (
            <>
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </>
          ) : (
            t.label
          )}
        </Link>
      ))}
    </nav>
  );
}

// ---------- page frame ----------

export function LibraryPage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:max-w-none lg:px-8 lg:pt-10">
      {children}
    </main>
  );
}

/**
 * The title row every library page starts with, styled like the tool and Shed Log titles: optional
 * tabs or back button, the accent icon (or any `leading` element, e.g. a key badge), the title and
 * a line under it, the page's buttons, and `children` (usually its search box) below. `color`
 * colors the icon.
 */
export function Hero({
  title,
  subtitle,
  icon: Icon,
  leading,
  color = "var(--accent)",
  tabs,
  back,
  backHref,
  backLabel,
  actions,
  helpTopic,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  leading?: ReactNode;
  color?: string;
  tabs?: ReactNode;
  back?: () => void;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  helpTopic?: string;
  children?: ReactNode;
}) {
  const topic = helpTopic ? topicById(helpTopic) : undefined;
  const intro = useIntro(topic);
  const TopicIcon = topic ? ICON_BY_ID[topic.id] : undefined;
  const ShownIcon = Icon ?? TopicIcon;
  return (
    <header className="flex flex-col gap-4">
      {(tabs || back || backHref) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {back || backHref ? <BackButton onClick={back} href={backHref} label={backLabel} /> : <span />}
          {tabs}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-[min(100%,16rem)] flex-1 basis-72 items-center gap-3">
          {leading}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="flex min-w-0 items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {!leading && ShownIcon && (
                  <span className="shrink-0" style={{ color }}>
                    <ShownIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </span>
                )}
                <span className="line-clamp-2 break-words">{title}</span>
              </h1>
              {topic && <IntroButton onClick={intro.show} label={`How ${topic.title} works`} />}
            </div>
            {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
          </div>
        </div>
        {/* Buttons here sit on the page background, so the "on a card" bg-background ones turn surface. */}
        {actions && <div className="flex flex-wrap items-center gap-2 [&_.bg-background]:bg-surface">{actions}</div>}
      </div>
      {children && <div>{children}</div>}
      {intro.open && topic && <ToolIntro topic={topic} onClose={intro.close} />}
    </header>
  );
}

export function HeroSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-foreground/5 focus-within:ring-2 focus-within:ring-accent">
      <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-muted hover:text-foreground">
          Clear
        </button>
      )}
    </label>
  );
}

/** A titled card: header (title, detail, a small +, "See all") and its content. */
export function Panel({
  title,
  detail,
  href,
  hrefLabel = "See all",
  onAdd,
  addLabel,
  icon: Icon,
  children,
  className = "",
  flush = false,
}: {
  title: string;
  detail?: ReactNode;
  href?: string;
  hrefLabel?: string;
  onAdd?: (e: React.MouseEvent) => void;
  addLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  /** Rows go edge to edge (a list) instead of padded content. */
  flush?: boolean;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-2xl bg-surface ${className}`}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        {Icon && <Icon className="h-4 w-4 text-accent" />}
        <h2 className="truncate font-bold">{title}</h2>
        {detail != null && <span className="hidden text-xs font-semibold tabular-nums text-muted sm:inline">{detail}</span>}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel ?? `Add to ${title}`}
            title={addLabel ?? `Add to ${title}`}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-accent hover:bg-surface-hover"
          >
            <span className="text-base leading-none">+</span>
          </button>
        )}
        {href && (
          <Link href={href} className="ml-auto flex shrink-0 items-center text-xs font-semibold text-accent hover:underline">
            {hrefLabel}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className={flush ? "pb-1.5" : "px-4 pb-4"}>{children}</div>
    </section>
  );
}

/** Rows inside a `Panel` (or any card), separated by hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-foreground/[0.06] px-1.5">{children}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-bold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- rows ----------

function RowShell({
  href,
  leading,
  title,
  extra,
  meta,
  onMenu,
  menuLabel,
  trailing,
}: {
  href: string;
  leading: ReactNode;
  title: string;
  extra?: ReactNode;
  meta?: ReactNode;
  onMenu?: (e: React.MouseEvent) => void;
  menuLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-background/60">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2">
        {leading}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold">{title}</span>
            {extra}
          </span>
          {meta && <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 overflow-hidden text-xs text-muted">{meta}</span>}
        </span>
        {trailing}
      </Link>
      {onMenu && (
        <div className="pr-1.5">
          <MenuButton label={menuLabel ?? `Options for ${title}`} onClick={onMenu} />
        </div>
      )}
    </div>
  );
}

/** A tune: its key badge, name (with a chart mark if it has one), tempo / time / keys known. */
export function TuneItem({ tune, href, onMenu }: { tune: Tune; href: string; onMenu?: (e: React.MouseEvent) => void }) {
  const keys = tune.keys.filter((k) => k.enabled);
  const tempo = tune.tempos.find((t) => t.enabled)?.value;
  return (
    <RowShell
      href={href}
      leading={<KeyBadge label={keys[0]?.value} />}
      title={tune.name}
      extra={
        tune.chordChartId && (
          <span title="Has a chord chart" className="shrink-0 text-accent">
            <ChordChartIcon className="h-3.5 w-3.5" />
          </span>
        )
      }
      meta={
        <>
          {tempo != null && <Chip>{tempo} BPM</Chip>}
          {tune.timeSignature && <Chip>{tune.timeSignature}</Chip>}
          {keys.length > 1 && <Chip>{keys.length} keys</Chip>}
          {!tempo && !keys.length && <span className="truncate">{tuneSummary(tune) || "No key or tempo yet"}</span>}
        </>
      }
      onMenu={onMenu}
    />
  );
}

/** A chart: its key badge, title, composer and anything else in `subtitle`. */
export function ChartItem({ song, href, subtitle, onMenu }: { song: LibrarySongMeta; href: string; subtitle?: string; onMenu?: (e: React.MouseEvent) => void }) {
  const line = subtitle ?? [song.composer ? formatComposer(song.composer) : null, song.style || null].filter(Boolean).join(" · ");
  return (
    <RowShell href={href} leading={<KeyBadge label={song.key} />} title={song.title} meta={line ? <span className="truncate">{line}</span> : undefined} onMenu={onMenu} />
  );
}

// ---------- cards ----------

/** One of your lists on a dashboard: icon, a big count, its name and the first few in it. */
export function ShelfCard({
  href,
  icon: Icon,
  count,
  label,
  preview,
  color = "var(--accent)",
  empty,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
  preview: string[];
  color?: string;
  empty?: string;
}) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4 transition-colors hover:bg-surface-hover">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: tint(color, 16), color }}>
          <Icon className="h-5 w-5" />
        </span>
        <ChevronRightIcon className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div>
        <div className="text-3xl font-extrabold tabular-nums leading-none">{count}</div>
        <div className="mt-1 text-sm font-semibold text-muted">{label}</div>
      </div>
      <div className="flex min-h-[2.75rem] flex-col justify-end gap-0.5 border-t border-foreground/[0.06] pt-2 text-xs text-muted">
        {preview.length ? (
          preview.slice(0, 2).map((p, i) => (
            <span key={i} className="truncate">
              {p}
            </span>
          ))
        ) : (
          <span>{empty}</span>
        )}
      </div>
    </Link>
  );
}

/** Recently opened tunes or charts: a scrolling row of small cards with their key. */
export function RecentStrip({
  items,
}: {
  items: {
    key: string;
    title: string;
    detail: string;
    href: string;
    keyLabel?: string | null;
  }[];
}) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className="flex w-52 shrink-0 snap-start items-center gap-3 rounded-2xl bg-surface p-3 transition-colors hover:bg-surface-hover"
        >
          <KeyBadge label={it.keyLabel} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{it.title}</span>
            <span className="block truncate text-xs text-muted">{it.detail}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** A playlist as a card: a cover in the playlist's colour with its first charts, then its name. */
export function PlaylistCard({
  name,
  count,
  href,
  titles,
  onMenu,
  featured = false,
}: {
  name: string;
  count: number;
  href: string;
  titles: string[];
  onMenu?: (e: React.MouseEvent) => void;
  featured?: boolean;
}) {
  const color = featured ? "var(--accent)" : nameColor(name);
  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-surface transition-colors hover:bg-surface-hover">
      <Link href={href} className="flex flex-col">
        <div
          className="relative h-28 overflow-hidden px-4 pt-4"
          style={{
            background: `linear-gradient(140deg, ${tint(color, 34)}, ${tint(color, 10)})`,
          }}
        >
          <div className="flex flex-col gap-1.5">
            {(titles.length ? titles.slice(0, 3) : ["", "", ""]).map((t, i) => (
              <div
                key={i}
                className="flex h-6 items-center gap-2 rounded-md bg-surface/85 px-2 text-[11px] font-semibold shadow-sm"
                style={{
                  marginLeft: i * 10,
                  marginRight: (2 - i) * 6,
                  opacity: 1 - i * 0.18,
                }}
              >
                <span className="shrink-0" style={{ color }}>
                  <ChordChartIcon className="h-3 w-3" />
                </span>
                <span className="truncate">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 pr-12">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{name}</span>
            <span className="block text-xs text-muted">
              {count} chart{count === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      </Link>
      {onMenu && (
        <div className="absolute bottom-2.5 right-2">
          <MenuButton label={`Options for ${name}`} onClick={onMenu} alwaysVisible />
        </div>
      )}
    </div>
  );
}

/** A setlist as a card: its colour, name, count, shared, and the first tunes in it. */
export function SetlistCard({ setlist, href, tuneNames }: { setlist: Setlist; href: string; tuneNames: string[] }) {
  const n = setlist.tuneIds.length;
  const color = nameColor(setlist.name);
  return (
    <Link href={href} className="group flex min-w-0 gap-3 rounded-2xl bg-surface p-3.5 transition-colors hover:bg-surface-hover">
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none" style={{ background: tint(color, 18), color }}>
        <span className="text-lg font-extrabold tabular-nums">{n}</span>
        <span className="text-[9px] font-bold">{n === 1 ? "tune" : "tunes"}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold">{setlist.name}</span>
          {setlist.shareId && (
            <span title="Shared by link">
              <ShareIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{setlist.description || (tuneNames.length ? tuneNames.slice(0, 4).join(" · ") : "No tunes yet")}</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 self-center text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
