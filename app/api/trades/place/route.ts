import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { placeOrder } from "@/lib/trades";

/**
 * POST /api/trades/place
 * Body: { symbol, exchange, side, qty, orderType, limitPrice?, productType?, optionType?, strikePrice?, expiry? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      symbol,
      exchange = "NSE",
      side,
      qty,
      orderType = "MARKET",
      limitPrice,
      productType = "CNC",
      optionType,
      strikePrice,
      expiry,
    } = body;

    if (!symbol || !side || !qty) {
      return NextResponse.json(
        { message: "symbol, side, and qty are required" },
        { status: 400 },
      );
    }

    if (!["BUY", "SELL"].includes(side)) {
      return NextResponse.json(
        { message: "side must be BUY or SELL" },
        { status: 400 },
      );
    }

    const { trade, newBalance } = await placeOrder({
      userId: user._id.toString(),
      symbol,
      exchange,
      side,
      qty: Number(qty),
      orderType,
      limitPrice: limitPrice ? Number(limitPrice) : undefined,
      productType,
      optionType,
      strikePrice: strikePrice ? Number(strikePrice) : undefined,
      expiry,
    });

    return NextResponse.json({
      message: `${side} ${qty} ${symbol} @ ₹${trade.price.toFixed(2)}`,
      trade: {
        id: trade._id?.toString(),
        symbol: trade.symbol,
        exchange: trade.exchange,
        side: trade.side,
        qty: trade.qty,
        price: trade.price,
        totalValue: trade.totalValue,
        status: trade.status,
        executedAt: trade.executedAt,
      },
      newBalance,
    });
  } catch (err: any) {
    console.error("[trades/place]", err);
    const status = err.message?.includes("Insufficient") ? 400 : 500;
    return NextResponse.json(
      { message: err.message || "Order failed" },
      { status },
    );
  }
}
