"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminJson } from "@/components/admin/adminFetch";
import { ScopeUserBar } from "@/components/admin/ScopeUserBar";
import { computeOrderPnl } from "@/lib/admin-orders-pnl";

type LiveTrade = {
  _id: string;
  clientId?: string;
  userName?: string;
  symbol: string;
  exchange: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  totalValue: number;
  productType: string;
  optionType?: string;
  strikePrice?: number;
  expiry?: string;
  pnl: number;
  status: string;
  createdAt: string;
};

const emptyTrade = {
  userId: "",
  symbol: "",
  exchange: "NSE",
  side: "BUY" as "BUY" | "SELL",
  qty: 1,
  productType: "CNC",
  optionType: "",
  strikePrice: "",
  expiry: "",
};

type OrderSegment = { key: string; label: string };

type OrderRow = {
  id: string;
  segmentKey: string;
  market?: string;
  symbol: string;
  side: "BUY" | "SELL";
  productType?: string;
  optionType?: string;
  strikePrice?: number;
  exchange?: string;
  orderTag?: string;
  expiryDate?: string;
  changePct?: number;
  orderPrice?: number;
  qty: number;
  avgPrice: number;
  ltp: number;
  buyPrice?: number;
  sellPrice?: number;
  lots?: number;
  pnlManual?: boolean;
  pnlPct?: number;
  pnl: number;
  status: "OPEN" | "CLOSED";
};

const DEFAULT_SEGMENTS: OrderSegment[] = [
  { key: "positions", label: "Positions" },
  { key: "openOrders", label: "Open Orders" },
  { key: "baskets", label: "Baskets" },
  { key: "stockSip", label: "Stock SIP" },
  { key: "gtt", label: "GTT" },
];

let _rowCounter = 0;
function emptyRow(): OrderRow {
  _rowCounter += 1;
  const base = {
    id: `${Date.now()}-${_rowCounter}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: "",
    market: "NSE",
    productType: "Delivery",
    optionType: "CE",
    strikePrice: 0,
    exchange: "NSEFO",
    orderTag: "At Market",
    expiryDate: "",
    changePct: 0,
    orderPrice: 0,
    avgPrice: 0,
    ltp: 0,
    qty: 0,
    buyPrice: 0,
    sellPrice: 0,
    lots: 1,
    pnlManual: false,
    pnlPct: 0,
    pnl: 0,
    side: "BUY" as const,
    segmentKey: "positions",
    status: "OPEN" as const,
  };
  return { ...base, pnl: computeOrderPnl(base) };
}

function patchRow(r: OrderRow, patch: Partial<OrderRow>): OrderRow {
  const next = { ...r, ...patch };
  if (!next.pnlManual) {
    next.pnl = computeOrderPnl(next);
  }
  return next;
}

type UserOpt = { _id: string; clientId?: string; email?: string; fullName?: string };

const inp =
  "min-w-[4rem] rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none focus:border-emerald-500";
const inpNum = `${inp} text-right`;

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const initialScope = searchParams.get("scopeUserId") || "";
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [scopeUserId, setScopeUserId] = useState(initialScope);
  const [segments, setSegments] = useState<OrderSegment[]>(DEFAULT_SEGMENTS);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  // Live trades (real MongoDB trades)
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [liveTradesLoading, setLiveTradesLoading] = useState(false);
  const [liveTradesErr, setLiveTradesErr] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState({ ...emptyTrade });
  const [tradePlacing, setTradePlacing] = useState(false);
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);
  const [tradeErr, setTradeErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showOptionType, setShowOptionType] = useState(true);
  const [showSide, setShowSide] = useState(true);

  const totalPnl = useMemo(
    () => rows.reduce((a, o) => a + computeOrderPnl(o), 0),
    [rows],
  );

  const loadUsers = useCallback(async () => {
    try {
      const data = await adminJson<{ users: UserOpt[] }>("/api/admin/users");
      setUsers(data.users || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setErr(null);
    const q = scopeUserId ? `?scopeUserId=${encodeURIComponent(scopeUserId)}` : "";
    try {
      const data = await adminJson<{
        config?: {
          segments?: OrderSegment[];
          orders?: OrderRow[];
          showOptionType?: boolean;
          showSide?: boolean;
        };
        source?: string;
      }>(`/api/admin/orders${q}`);
      const cfg = data.config || {};
      setShowOptionType(cfg.showOptionType !== false);
      setShowSide(cfg.showSide !== false);
      const segs = cfg.segments;
      setSegments(
        Array.isArray(segs) && segs.length > 0 ? segs : DEFAULT_SEGMENTS,
      );
      const list = cfg.orders;
      setRows(
        Array.isArray(list)
          ? list.map((row) =>
              patchRow(
                {
                  ...row,
                  segmentKey: row.segmentKey || "positions",
                  market: row.market || "NSE",
                  productType: row.productType || "Delivery",
                  optionType: row.optionType || "CE",
                  exchange: row.exchange || row.market || "NSEFO",
                  orderTag: row.orderTag || "At Market",
                },
                {},
              ),
            )
          : [],
      );
      setSource(String(data.source || ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [scopeUserId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    const summary = {
      dayPnl: rows.reduce((a, o) => a + computeOrderPnl(o), 0),
      totalPnl: rows.reduce((a, o) => a + computeOrderPnl(o), 0),
    };
    try {
      await adminJson("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          scopeUserId: scopeUserId || null,
          config: {
            summary,
            segments,
            orders: rows,
            showOptionType,
            showSide,
          },
        }),
      });
      setMsg("Orders & positions saved.");
      await loadConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetScope() {
    if (!confirm("Reset orders config for this scope to defaults?")) return;
    setSaving(true);
    try {
      const q = scopeUserId ? `?scopeUserId=${encodeURIComponent(scopeUserId)}` : "";
      await adminJson(`/api/admin/orders${q}`, { method: "DELETE" });
      setMsg("Reset.");
      await loadConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  function updateRow(idx: number, patch: Partial<OrderRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? patchRow(r, patch) : r)),
    );
  }

  const loadLiveTrades = useCallback(async () => {
    setLiveTradesLoading(true);
    setLiveTradesErr(null);
    try {
      const q = tradeForm.userId ? `?userId=${encodeURIComponent(tradeForm.userId)}` : "";
      const data = await adminJson<{ trades: LiveTrade[] }>(`/api/admin/trades${q}`);
      setLiveTrades(data.trades || []);
    } catch (e) {
      setLiveTradesErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLiveTradesLoading(false);
    }
  }, [tradeForm.userId]);

  async function placeLiveTrade() {
    if (!tradeForm.userId || !tradeForm.symbol || !tradeForm.exchange || !tradeForm.qty) {
      setTradeErr("User ID, symbol, exchange and qty are required");
      return;
    }
    setTradePlacing(true);
    setTradeMsg(null);
    setTradeErr(null);
    try {
      const result = await adminJson<{ message: string; newBalance: number }>(
        "/api/admin/trades",
        {
          method: "POST",
          body: JSON.stringify({
            userId: tradeForm.userId,
            symbol: tradeForm.symbol.toUpperCase(),
            exchange: tradeForm.exchange.toUpperCase(),
            side: tradeForm.side,
            qty: Number(tradeForm.qty),
            productType: tradeForm.productType,
            optionType: tradeForm.optionType || undefined,
            strikePrice: tradeForm.strikePrice ? Number(tradeForm.strikePrice) : undefined,
            expiry: tradeForm.expiry || undefined,
          }),
        },
      );
      setTradeMsg(`${result.message} · New balance: ₹${Number(result.newBalance).toLocaleString()}`);
      void loadLiveTrades();
    } catch (e) {
      setTradeErr(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setTradePlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <h2 className="text-lg font-semibold text-slate-900">Orders &amp; positions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Set the <strong>scope user id</strong> (or quick-pick) and click <strong>Load</strong>, then add rows and <strong>Save</strong>.
        Per-user rows <strong>merge</strong> with global: same trade <code className="rounded bg-slate-100 px-1">id</code> is
        replaced; new ids are added. Leave scope empty to edit <strong>global</strong> defaults for everyone.
      </p>
      {source ? <p className="mt-2 text-xs text-slate-500">Source: {source}</p> : null}
      {msg ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900">{err}</p>
      ) : null}

      <div className="mt-6">
        <ScopeUserBar
          scopeUserId={scopeUserId}
          onScopeChange={setScopeUserId}
          onLoad={() => void loadConfig()}
          users={users}
        />
      </div>

      <div
        className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          scopeUserId.trim()
            ? "border-sky-200 bg-sky-50 text-sky-950"
            : "border-slate-200 bg-slate-50 text-slate-800"
        }`}
      >
        {scopeUserId.trim() ? (
          <>
            <strong>Editing this user only</strong> — paste/save the MongoDB <code className="rounded bg-white/80 px-1">_id</code>{" "}
            above. The app merges these rows with <strong>global</strong> trades (per-user replaces same{" "}
            <code className="rounded bg-white/80 px-1">id</code>).
          </>
        ) : (
          <>
            <strong>Global scope</strong> — these trades show for every account unless a user has their own scoped list.
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-slate-500">Combined P/L (derived)</span>
        <span className="font-mono text-sm font-semibold text-slate-900">
          {totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void resetScope()}
          disabled={saving}
          className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          Reset scope
        </button>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Segments</h3>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            onClick={() =>
              setSegments((s) => [
                ...s,
                { key: `seg_${Date.now()}`, label: "New segment" },
              ])
            }
          >
            Add segment
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-2 font-medium">Key</th>
                <th className="py-2 pr-2 font-medium">Label</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, i) => (
                <tr key={seg.key} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <input
                      className={inp}
                      value={seg.key}
                      onChange={(e) =>
                        setSegments((prev) =>
                          prev.map((s, j) =>
                            j === i ? { ...s, key: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className={inp}
                      value={seg.label}
                      onChange={(e) =>
                        setSegments((prev) =>
                          prev.map((s, j) =>
                            j === i ? { ...s, label: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-rose-600 hover:underline"
                      onClick={() => setSegments((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Visibility in App</h3>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showOptionType}
              onChange={(e) => setShowOptionType(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
            Show CE / PE (Option Type)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showSide}
              onChange={(e) => setShowSide(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
            Show BUY / SELL (Side)
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Order rows</h3>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
          >
            Add order
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Segment</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Mkt</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Symbol</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Side</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Product</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Expiry</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Opt</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Strike</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Exch</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Tag</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Chg %</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Buy</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Sell</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Ord px</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Lots</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Qty</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Avg</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">LTP</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">P/L</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Man</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">P/L %</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={23} className="px-3 py-6 text-center text-slate-500">
                    No rows. Click &quot;Add order&quot; to create one.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-1.5 py-1 align-top">
                      <select
                        className={inp}
                        value={row.segmentKey || "positions"}
                        onChange={(e) => updateRow(idx, { segmentKey: e.target.value })}
                      >
                        {segments.map((seg) => (
                          <option key={seg.key} value={seg.key}>
                            {seg.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        className={inp}
                        value={row.market || ""}
                        onChange={(e) => updateRow(idx, { market: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        className={inp}
                        value={row.symbol}
                        onChange={(e) => updateRow(idx, { symbol: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <select
                        className={inp}
                        value={row.side}
                        onChange={(e) =>
                          updateRow(idx, { side: e.target.value as OrderRow["side"] })
                        }
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <select
                        className={inp}
                        value={row.productType || "Delivery"}
                        onChange={(e) => updateRow(idx, { productType: e.target.value })}
                      >
                        <option value="Delivery">Delivery</option>
                        <option value="Intraday">Intraday</option>
                        <option value="F&O">F&amp;O</option>
                        <option value="CNC">CNC</option>
                        <option value="MIS">MIS</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="date"
                        className={inp}
                        value={row.expiryDate || ""}
                        onChange={(e) => updateRow(idx, { expiryDate: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <select
                        className={inp}
                        value={row.optionType || "CE"}
                        onChange={(e) => updateRow(idx, { optionType: e.target.value })}
                      >
                        <option value="CE">CE</option>
                        <option value="PE">PE</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.strikePrice ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { strikePrice: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        className={inp}
                        value={row.exchange || ""}
                        onChange={(e) => updateRow(idx, { exchange: e.target.value })}
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <select
                        className={inp}
                        value={row.orderTag || "At Market"}
                        onChange={(e) => updateRow(idx, { orderTag: e.target.value })}
                      >
                        <option value="At Market">At Market</option>
                        <option value="At Limit">At Limit</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.changePct ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { changePct: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.buyPrice ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { buyPrice: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.sellPrice ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { sellPrice: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.orderPrice ?? row.avgPrice ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { orderPrice: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.lots ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { lots: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.qty ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { qty: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.avgPrice ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { avgPrice: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.ltp ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { ltp: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.pnl ?? 0}
                        onChange={(e) =>
                          updateRow(idx, {
                            pnl: Number(e.target.value || 0),
                            pnlManual: true,
                          })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top pt-2">
                      <input
                        type="checkbox"
                        checked={!!row.pnlManual}
                        onChange={(e) =>
                          updateRow(idx, {
                            pnlManual: e.target.checked,
                            pnl: e.target.checked
                              ? row.pnl
                              : computeOrderPnl({ ...row, pnlManual: false }),
                          })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <input
                        type="number"
                        step="any"
                        className={inpNum}
                        value={row.pnlPct ?? 0}
                        onChange={(e) =>
                          updateRow(idx, { pnlPct: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <select
                        className={inp}
                        value={row.status}
                        onChange={(e) =>
                          updateRow(idx, {
                            status: e.target.value as OrderRow["status"],
                          })
                        }
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <button
                        type="button"
                        className="whitespace-nowrap text-rose-600 hover:underline"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Place a real trade ── */}
      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-emerald-900">Place live trade (real balance &amp; P/L)</h3>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">User ID (MongoDB _id)</label>
            <select
              className={inp}
              value={tradeForm.userId}
              onChange={(e) => setTradeForm((f) => ({ ...f, userId: e.target.value }))}
            >
              <option value="">— pick user —</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.clientId || u.email || u._id} {u.fullName ? `· ${u.fullName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Symbol</label>
            <input className={inp} placeholder="NIFTY / RELIANCE / GOLD" value={tradeForm.symbol}
              onChange={(e) => setTradeForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Exchange</label>
            <select className={inp} value={tradeForm.exchange}
              onChange={(e) => setTradeForm((f) => ({ ...f, exchange: e.target.value }))}>
              <option>NSE</option><option>BSE</option><option>NFO</option>
              <option>BFO</option><option>MCX</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Side</label>
            <select className={inp} value={tradeForm.side}
              onChange={(e) => setTradeForm((f) => ({ ...f, side: e.target.value as "BUY" | "SELL" }))}>
              <option>BUY</option><option>SELL</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Qty</label>
            <input type="number" min={1} className={`${inpNum} w-20`} value={tradeForm.qty}
              onChange={(e) => setTradeForm((f) => ({ ...f, qty: Number(e.target.value) }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Product</label>
            <select className={inp} value={tradeForm.productType}
              onChange={(e) => setTradeForm((f) => ({ ...f, productType: e.target.value }))}>
              <option>CNC</option><option>MIS</option><option>NRML</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Opt type</label>
            <select className={inp} value={tradeForm.optionType}
              onChange={(e) => setTradeForm((f) => ({ ...f, optionType: e.target.value }))}>
              <option value="">—</option><option>CE</option><option>PE</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Strike</label>
            <input type="number" className={`${inpNum} w-20`} placeholder="0" value={tradeForm.strikePrice}
              onChange={(e) => setTradeForm((f) => ({ ...f, strikePrice: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-500">Expiry</label>
            <input className={inp} placeholder="25APR2026" value={tradeForm.expiry}
              onChange={(e) => setTradeForm((f) => ({ ...f, expiry: e.target.value }))} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={tradePlacing}
            onClick={() => void placeLiveTrade()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {tradePlacing ? "Placing…" : `${tradeForm.side} at market`}
          </button>
          <button type="button" disabled={liveTradesLoading}
            onClick={() => void loadLiveTrades()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {liveTradesLoading ? "Loading…" : "Load trades"}
          </button>
        </div>
        {tradeMsg && <p className="mt-2 rounded bg-emerald-100 px-3 py-1.5 text-xs text-emerald-900">{tradeMsg}</p>}
        {tradeErr && <p className="mt-2 rounded bg-rose-100 px-3 py-1.5 text-xs text-rose-900">{tradeErr}</p>}
      </section>

      {/* ── Live trades table ── */}
      {liveTrades.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Live trades (MongoDB)</h3>
          {liveTradesErr && <p className="mb-2 text-xs text-rose-700">{liveTradesErr}</p>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  {["User","Symbol","Exch","Side","Qty","Price","Total","Product","Opt","Status","Date"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveTrades.map((t) => (
                  <tr key={t._id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-2 py-1 text-slate-700">{t.clientId || t.userName || t._id.slice(-6)}</td>
                    <td className="px-2 py-1 font-medium">{t.symbol}</td>
                    <td className="px-2 py-1 text-slate-500">{t.exchange}</td>
                    <td className={`px-2 py-1 font-semibold ${t.side === "BUY" ? "text-emerald-700" : "text-rose-600"}`}>{t.side}</td>
                    <td className="px-2 py-1 text-right">{t.qty}</td>
                    <td className="px-2 py-1 text-right">₹{Number(t.price).toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">₹{Number(t.totalValue).toLocaleString()}</td>
                    <td className="px-2 py-1 text-slate-500">{t.productType}</td>
                    <td className="px-2 py-1 text-slate-500">{t.optionType || "—"}</td>
                    <td className="px-2 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.status === "EXECUTED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-slate-400">{new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
