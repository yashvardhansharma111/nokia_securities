import Link from "next/link";

const SUPPORT_EMAIL = "support@nokiasecurities.in";

export const metadata = {
  title: "Nokia Securities — Paper Trading App",
  description:
    "Nokia Securities is a paper trading (simulated) app for indices, equities & commodities. Practise the markets risk-free — no real money is invested.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-lg font-bold text-white">
              N
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Nokia Securities
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-emerald-600">
              Features
            </a>
            <Link
              href="/privacy-policy"
              className="transition hover:text-emerald-600"
            >
              Privacy
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="transition hover:text-emerald-600"
            >
              Support
            </a>
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.97]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-emerald-50/60 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 pt-20 pb-24 text-center lg:pt-28 lg:pb-32">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Paper Trading App · Simulated Trades Only
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Practise the markets with{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-emerald-700 bg-clip-text text-transparent">
              Nokia Securities
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            A <strong className="text-slate-900">paper trading (simulated) app</strong>{" "}
            for indices, equities &amp; commodities. Place virtual orders, manage
            a virtual portfolio, and learn the markets risk-free &mdash; no real
            money is invested.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2.5 rounded-full bg-emerald-500 px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.97]"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-7 py-3.5 text-[15px] font-semibold text-slate-900 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-16 grid w-full max-w-md grid-cols-3 gap-6">
            <Stat value="50+" label="Instruments" />
            <Stat value="100%" label="Simulated" />
            <Stat value="Free" label="To use" />
          </div>
        </div>
      </section>

      <section id="features" className="bg-slate-50/60 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to practise trading
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-600">
              A risk-free simulator with the polish of a real trading app.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Live Market Data"
              description="Live prices for indices, equities, and commodities — used to make the simulator feel real."
            />
            <FeatureCard
              title="Interactive Charts"
              description="Professional candlestick and area charts with multiple timeframes to spot trends."
            />
            <FeatureCard
              title="Virtual Funds"
              description="Top up and withdraw simulated funds in seconds. Track your virtual balance and margin in real time."
            />
            <FeatureCard
              title="Orders & Ledger"
              description="Full simulated order history, position tracking, and downloadable CSV ledger reports."
            />
            <FeatureCard
              title="Secure & Private"
              description="Encrypted authentication, secure document uploads, and admin-approved accounts."
            />
            <FeatureCard
              title="Watchlist"
              description="Create custom watchlists and stay on top of the instruments that matter to you."
            />
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900 sm:p-8">
            <p className="text-base font-bold text-amber-950">
              Important disclaimer
            </p>
            <p className="mt-3">
              Nokia Securities is a <strong>paper trading (simulated) app</strong>.
              We are <strong>not</strong> a SEBI-registered broker, sub-broker,
              or investment adviser. We do not place real trades, do not hold
              real funds, and do not provide investment advice. Every order,
              deposit, and balance inside the app is virtual.
            </p>
            <p className="mt-3">
              Read our{" "}
              <Link
                href="/privacy-policy"
                className="font-semibold underline underline-offset-4 hover:text-amber-950"
              >
                privacy policy
              </Link>
              {" "}or email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold underline underline-offset-4 hover:text-amber-950"
              >
                {SUPPORT_EMAIL}
              </a>
              {" "}for help.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-xs font-bold text-white">
                  N
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  Nokia Securities
                </span>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                A paper trading (simulated) app for learning the markets. No
                real money is invested, deposited, or withdrawn through this
                application.
              </p>
              <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} Nokia Securities. All rights
                reserved.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold text-slate-900">Help &amp; Legal</p>
              <Link
                href="/privacy-policy"
                className="text-slate-600 transition hover:text-emerald-600"
              >
                Privacy Policy
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-slate-600 transition hover:text-emerald-600"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-500 group-hover:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </div>
  );
}
