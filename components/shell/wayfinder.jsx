"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getNavigationForRole, getPinsForRole, getQuickActionsForRole } from "@/lib/navigation";
import { getRoleLabel } from "@/lib/roles";
import { globalSearch } from "@/actions/search";
import { getUserNotifications } from "@/actions/notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Activity, ArrowRight, Bell, BedDouble, CornerDownLeft, Loader2, LogOut, Search, Stethoscope, User, UserRound, X } from "lucide-react";

const HOSPITAL_NAME = process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital";
const RECENT_KEY = "wayfinder-recent";
const READ_KEY = "shds_read_notifications";
const RESULT_ICONS = { patients: UserRound, admissions: BedDouble, doctors: Stethoscope };

const readStore = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
};
const writeStore = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

/** Is this nav link the page we're on (or a page inside it)? */
function isActive(pathname, href, allHrefs) {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (!pathname.startsWith(href + "/")) return false;
  // Prefer the most specific link, e.g. /pharmacy/formulary over /pharmacy
  return !allHrefs.some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
}

function Overlay({ role, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent] = useState(() => readStore(RECENT_KEY, []));

  const groups = useMemo(() => getNavigationForRole(role).filter((g) => g.label !== "Account" && g.label !== "Overview"), [role]);
  const places = useMemo(() => getNavigationForRole(role).flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [role]);
  const actions = useMemo(() => getQuickActionsForRole(role), [role]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Live search of patients, stays and doctors once two characters are typed.
  useEffect(() => {
    const query = q.trim();
    const t = setTimeout(async () => {
      if (query.length < 2) { setRemote([]); setLoading(false); return; }
      setLoading(true);
      const res = await globalSearch(query);
      setRemote((res.data ?? []).flatMap((g) => g.items.map((i) => ({ ...i, kind: g.type, groupLabel: g.label }))));
      setLoading(false);
    }, query.length < 2 ? 0 : 220);
    return () => clearTimeout(t);
  }, [q]);

  const query = q.trim().toLowerCase();
  const results = query
    ? [
        ...actions.filter((a) => a.title.toLowerCase().includes(query)).map((a) => ({ ...a, kind: "action", subtitle: "Action" })),
        ...places.filter((p) => p.title.toLowerCase().includes(query) || p.group.toLowerCase().includes(query)).map((p) => ({ ...p, kind: "place", subtitle: p.group })),
        ...remote,
      ]
    : [];

  const go = (href, title) => {
    if (title) writeStore(RECENT_KEY, [{ href, title }, ...readStore(RECENT_KEY, []).filter((r) => r.href !== href)].slice(0, 6));
    onClose();
    router.push(href);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") return onClose();
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    if (e.key === "Enter") { e.preventDefault(); const r = results[active]; go(r.href, r.kind === "place" || r.kind === "action" ? r.title : null); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Where to?" className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-xl print:hidden" onKeyDown={onKeyDown}>
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 sm:px-8" style={{ paddingTop: "max(8vh, calc(env(safe-area-inset-top, 0px) + 20px))" }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{HOSPITAL_NAME}</span>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <label className="mt-6 flex items-center gap-3 border-b-2 border-foreground/15 pb-3 focus-within:border-primary">
          <Search className="size-6 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Where to? Patient, UHID, IP number, or a place"
            aria-label="Where to?"
            className="min-w-0 flex-1 bg-transparent text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground/60 sm:text-3xl"
          />
          {loading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </label>

        {query ? (
          <ul className="mt-4 space-y-1" role="listbox">
            {results.length === 0 && !loading && <li className="px-3 py-6 text-muted-foreground">Nothing matches “{q.trim()}”.</li>}
            {results.map((r, i) => {
              const Icon = r.icon ?? RESULT_ICONS[r.kind] ?? Search;
              return (
                <li key={`${r.kind}-${r.href}-${r.id ?? i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href, r.kind === "place" || r.kind === "action" ? r.title : null)}
                    className={cn("flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left", i === active && "bg-muted")}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{r.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{r.subtitle ?? r.groupLabel}</span>
                    </span>
                    {i === active && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-8 space-y-10">
            {actions.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Start something</h2>
                <div className="flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <button key={a.href} type="button" onClick={() => go(a.href, a.title)} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
                      <a.icon className="size-4" /> {a.title}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {recent.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recently opened</h2>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {recent.map((r) => (
                    <button key={r.href} type="button" onClick={() => go(r.href, r.title)} className="inline-flex items-center gap-1 text-base font-medium hover:text-primary">
                      {r.title} <ArrowRight className="size-3.5 opacity-50" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.items.map((item) => (
                    <button key={item.href} type="button" onClick={() => go(item.href, item.title)} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left hover:border-border hover:bg-card">
                      <item.icon className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="text-base font-medium">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Notifications({ user }) {
  const router = useRouter();
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await getUserNotifications();
      if (res?.success && Array.isArray(res.data)) {
        const read = new Set(readStore(READ_KEY, []));
        setItems(res.data.map((n) => (read.has(n.id) ? { ...n, unread: false } : n)));
      }
    } catch { /* navigation or network blip */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load, user]);

  const unread = items.filter((n) => n.unread).length;
  const markRead = (ids) => {
    writeStore(READ_KEY, [...new Set([...readStore(READ_KEY, []), ...ids])]);
    setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, unread: false } : n)));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{unread}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-[min(92vw,380px)] rounded-2xl p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => { markRead(items.map((n) => n.id)); toast.success("All marked as read"); }}>Mark all read</button>}
        </div>
        <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
          {items.length === 0 ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">You’re all caught up.</p> : items.map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => { markRead([n.id]); if (n.href) router.push(n.href); }} className={cn("flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5", n.unread && "bg-primary/5")}>
              <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">{n.title}<span className="shrink-0 text-xs font-normal text-muted-foreground">{n.time}</span></span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.desc}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Profile({ user, role }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const signOut = async () => {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/sign-in");
    } catch {
      toast.error("Sign-out failed");
      setLeaving(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Your account">
        <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-64 rounded-2xl p-2">
        <div className="px-3 py-2">
          <div className="text-sm font-semibold">{user?.firstName} {user?.lastName}</div>
          <div className="text-xs text-muted-foreground">{getRoleLabel(role)}</div>
        </div>
        <DropdownMenuItem onClick={() => router.push("/profile")} className="rounded-lg py-2"><User className="mr-2 size-4" /> Profile & settings</DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} disabled={leaving} className="rounded-lg py-2 text-destructive focus:text-destructive"><LogOut className="mr-2 size-4" /> {leaving ? "Signing out…" : "Sign out"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Floating dock at the bottom of every page, and the full-screen "Where to?" view it opens. */
export function Wayfinder({ role, user }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pins = useMemo(() => getPinsForRole(role), [role]);
  const allHrefs = useMemo(() => getNavigationForRole(role).flatMap((g) => g.items.map((i) => i.href)), [role]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName ?? "") || e.target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Remember pages opened from anywhere (not just the overlay) for "Recently opened".
  useEffect(() => {
    const item = getNavigationForRole(role).flatMap((g) => g.items).find((i) => i.href === pathname);
    if (item) writeStore(RECENT_KEY, [{ href: item.href, title: item.title }, ...readStore(RECENT_KEY, []).filter((r) => r.href !== item.href)].slice(0, 6));
  }, [pathname, role]);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 print:hidden"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex max-w-full items-center gap-0.5 rounded-full border border-border/70 bg-card/85 p-1.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <Link href="/" aria-label={`${HOSPITAL_NAME} home`} className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:flex">
            <Activity className="size-5" />
          </Link>
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
          {pins.map((p) => {
            const on = isActive(pathname, p.href, allHrefs);
            return (
              <Link
                key={p.href}
                href={p.href}
                aria-current={on ? "page" : undefined}
                className={cn("flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-muted-foreground hover:text-foreground sm:flex-row sm:gap-2 sm:px-4", on && "bg-foreground text-background hover:text-background")}
              >
                <p.icon className="size-[18px] shrink-0" />
                <span className="whitespace-nowrap text-[10px] font-medium leading-none sm:text-sm">{p.title}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-1 flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary md:px-4"
            aria-label="Where to? Search everything"
          >
            <Search className="size-[18px]" />
            <span className="hidden md:inline">Find</span>
            <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] lg:inline">⌘K</kbd>
          </button>
          <Notifications user={user} />
          <Profile user={user} role={role} />
        </div>
      </nav>
      {open && <Overlay role={role} onClose={() => setOpen(false)} />}
    </>
  );
}
