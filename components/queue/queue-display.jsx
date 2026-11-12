"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}
    </span>
  );
}

export function QueueDisplay({ boards, hospital }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#04202e] p-6 text-white sm:p-10">
      <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-5">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">{hospital}</div>
          <h1 className="text-3xl font-bold sm:text-4xl">Out-patient Department · Now Serving</h1>
        </div>
        <div className="text-3xl font-semibold sm:text-4xl"><Clock /></div>
      </header>

      {boards.length === 0 ? (
        <p className="mt-24 text-center text-2xl text-sky-100/70">Please take a seat. Your token number will appear here.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {boards.map((b) => (
            <section key={b.doctor} className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10">
              <div className="text-xl font-semibold">{b.doctor}</div>
              <div className="text-sm text-sky-100/70">{b.department}</div>
              <div className="mt-5 flex items-center gap-5">
                <div className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-teal-500 text-6xl font-bold tabular-nums text-[#04202e]">
                  {b.nowServing?.token ?? "–"}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-teal-300">Now serving</div>
                  <div className="text-2xl font-semibold">{b.nowServing?.name ?? "Please wait"}</div>
                </div>
              </div>
              {b.next.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-100/60">Next</div>
                  <div className="flex flex-wrap gap-2">
                    {b.next.map((n) => (
                      <span key={n.token} className="rounded-lg bg-white/10 px-3 py-1.5 text-lg">
                        <span className="font-bold tabular-nums">{n.token}</span> <span className="text-sky-100/80">{n.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
