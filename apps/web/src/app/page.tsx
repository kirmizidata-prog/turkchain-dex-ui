import WalletButton from "@/components/WalletButton";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070A12] text-white overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-fuchsia-500/40" />
        <div className="absolute -bottom-48 -right-48 h-[620px] w-[620px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-emerald-400/30 via-teal-500/25 to-indigo-500/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.05),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(255,255,255,0.04),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-6">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
              <div className="h-4 w-4 rounded-md bg-gradient-to-br from-cyan-300 to-fuchsia-400 opacity-90" />
            </div>
            <div className="leading-tight">
              <div className="text-sm opacity-70">swap.turkscan.com</div>
              <h1 className="text-lg font-semibold tracking-tight">Turkchain DEX</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WalletButton />
          </div>
        </header>

        {/* Nav buttons - top left */}
        <nav className="mt-6 flex flex-wrap items-center gap-2">
          <a
            className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm transition"
            href="/swap"
          >
            Open Swap
          </a>

          <a
            className="inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-sm transition"
            href="/pool"
          >
            Open Pool
          </a>

          <a
            className="inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-sm transition"
            href="/positions"
          >
            My Pools
          </a>
        </nav>

        {/* Main layout */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left info panel */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Network</h2>
                  <p className="mt-1 text-sm opacity-70">
                    Turkchain 1919 endpoint bilgileri
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="rounded-full bg-emerald-400/15 border border-emerald-400/25 px-3 py-1 text-xs text-emerald-200">
                    Live
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">ChainId</span>
                  <span className="font-medium">1919</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">RPC</span>
                  <span className="font-medium">rpc.turkchain1919.com</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">Explorer</span>
                  <span className="font-medium">turkscan.com</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  className="inline-flex items-center justify-center rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:opacity-90 transition"
                  href="/swap"
                >
                  Go to Swap
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  href="/pool"
                >
                  Go to Pool
                </a>
              </div>
            </div>
          </div>

          {/* Right glass swap area (center-right) */}
          <div className="lg:col-span-7 lg:pl-6">
            <div className="relative">
              {/* 3D glass / glow layers */}
              <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-transparent blur-2xl" />
              <div className="pointer-events-none absolute -top-10 right-6 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-10 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />

              <div className="relative rounded-[28px] border border-white/15 bg-white/7 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                {/* subtle grid */}
                <div className="pointer-events-none absolute inset-0 rounded-[28px] opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
                {/* inner highlight */}
                <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />

                <div className="relative p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">Swap</h3>
                      <p className="mt-1 text-sm opacity-70">
                        Glass UI preview - islemi Swap sayfasinda yapacaksin
                      </p>
                    </div>

                    <a
                      className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm transition"
                      href="/swap"
                    >
                      Open Swap
                    </a>
                  </div>

                  {/* Token pair selectors (UI only, swap logic degil) */}
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs opacity-70">From</div>
                        <div className="text-xs opacity-60">Editable</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10" />
                          <div>
                            <div className="text-sm font-medium">TOKEN A</div>
                            <div className="text-xs opacity-60">0.0000</div>
                          </div>
                        </div>
                        <button className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition">
                          Select
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="h-10 w-10 rounded-2xl border border-white/12 bg-white/5 backdrop-blur flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5v14" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                          <path d="M7 10l5-5 5 5" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M7 14l5 5 5-5" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs opacity-70">To</div>
                        <div className="text-xs opacity-60">Editable</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10" />
                          <div>
                            <div className="text-sm font-medium">TOKEN B</div>
                            <div className="text-xs opacity-60">0.0000</div>
                          </div>
                        </div>
                        <button className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition">
                          Select
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="opacity-70">Route</span>
                        <span className="font-medium">TOKEN A -&gt; TOKEN B</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="opacity-70">Price impact</span>
                        <span className="font-medium">-</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                        href="/pool"
                      >
                        Open Pool
                      </a>
                      <a
                        className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                        href="/positions"
                      >
                        My Pools
                      </a>
                      <a
                        className="ml-auto inline-flex items-center justify-center rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:opacity-90 transition"
                        href="/swap"
                      >
                        Swap Now
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* small floating chips */}
              <div className="pointer-events-none absolute -right-2 top-10 hidden md:block">
                <div className="rounded-2xl border border-white/12 bg-white/7 px-4 py-3 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
                  <div className="text-xs opacity-70">DEX</div>
                  <div className="mt-1 text-sm font-medium">Turkchain 1919</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom left social icons */}
        <footer className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 transition"
              aria-label="X"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18.9 3H22l-6.8 7.8L23 21h-6.9l-4.5-5.9L6 21H3l7.3-8.4L1 3h7.1l4.1 5.4L18.9 3Z"
                  fill="rgba(255,255,255,0.9)"
                />
              </svg>
            </a>

            <a
              href="#"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 transition"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  fill="rgba(255,255,255,0.9)"
                  d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.86-.01-1.69-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .26.18.59.69.48A10.07 10.07 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
                />
              </svg>
            </a>
          </div>

          <div className="text-xs opacity-60">
            Turkchain DEX UI
          </div>
        </footer>
      </div>
    </main>
  );
}