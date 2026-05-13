import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/trades";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

async function requireAdmin() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("ajx_admin");
  return !!adminCookie && adminCookie.value === "ok";
}

/** GET /api/admin/trades?userId=xxx  — list real trades (optionally filtered by user) */
export async function GET(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = Math.min(Number(searchParams.get("limit") || "100"), 500);

    const db = await getDb();
    const match = userId && ObjectId.isValid(userId)
      ? { userId: new ObjectId(userId) }
      : {};

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "_user",
        },
      },
      {
        $addFields: {
          clientId: { $arrayElemAt: ["$_user.clientId", 0] },
          userName: { $arrayElemAt: ["$_user.fullName", 0] },
        },
      },
      { $project: { _user: 0 } },
    ];

    const trades = await db.collection("trades").aggregate(pipeline).toArray();
    return NextResponse.json({ trades });
  } catch (error) {
    return apiErrorResponse(error, "[admin/trades GET]", "Failed to fetch trades");
  }
}

/** POST /api/admin/trades  — place a real trade on behalf of a user */
export async function POST(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { userId, symbol, exchange, side, qty, productType, optionType, strikePrice, expiry } = body;

    if (!userId || !symbol || !exchange || !side || !qty) {
      return NextResponse.json(
        { message: "userId, symbol, exchange, side, qty are required" },
        { status: 400 },
      );
    }

    const result = await placeOrder({
      userId,
      symbol,
      exchange,
      side,
      qty: Number(qty),
      orderType: "MARKET",
      productType: productType || "CNC",
      optionType,
      strikePrice,
      expiry,
    });

    // Mark the created position as admin-placed so it never appears in Holdings
    if (side === "BUY") {
      const db = await getDb();
      await db.collection("positions").updateOne(
        { userId: new ObjectId(userId), symbol, exchange, productType: productType || "CNC" },
        { $set: { source: "admin" } },
      );
    }

    return NextResponse.json({
      message: `${side} order placed for ${symbol}`,
      trade: result.trade,
      newBalance: result.newBalance,
    });
  } catch (error: any) {
    return apiErrorResponse(error, "[admin/trades POST]", error?.message || "Trade failed");
  }
}

/** PATCH /api/admin/trades  — edit an existing trade */
export async function PATCH(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { tradeId, ...fields } = body || {};

    if (!tradeId || !ObjectId.isValid(tradeId)) {
      return NextResponse.json({ message: "Valid tradeId is required" }, { status: 400 });
    }

    const allowed = [
      "symbol", "exchange", "side", "qty", "price",
      "totalValue", "pnl", "status", "productType",
      "optionType", "strikePrice", "expiry", "segmentKey",
    ] as const;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in fields && fields[key] !== undefined && fields[key] !== "") {
        updates[key] = fields[key];
      }
    }

    // Auto-compute totalValue if price and qty both provided
    if ("price" in updates && "qty" in updates) {
      updates.totalValue = Number(updates.price) * Number(updates.qty);
    }

    const db = await getDb();

    // Fetch the trade first so we can find the corresponding position
    const trade = await db.collection("trades").findOne({ _id: new ObjectId(tradeId) });
    if (!trade) {
      return NextResponse.json({ message: "Trade not found" }, { status: 404 });
    }

    const result = await db.collection("trades").updateOne(
      { _id: new ObjectId(tradeId) },
      { $set: updates },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Trade not found" }, { status: 404 });
    }

    // Sync editable fields into the positions collection so the user sees the change immediately.
    // Only BUY trades have open positions; SELL trades close/reduce positions.
    if (trade.side === "BUY") {
      const posUpdates: Record<string, unknown> = { updatedAt: new Date() };
      if ("qty" in updates) posUpdates.qty = Number(updates.qty);
      if ("price" in updates) posUpdates.avgPrice = Number(updates.price);
      if ("pnl" in updates) posUpdates.pnlOverride = Number(updates.pnl);

      if (Object.keys(posUpdates).length > 1) {
        await db.collection("positions").updateOne(
          {
            userId: trade.userId,
            symbol: trade.symbol,
            exchange: trade.exchange,
            side: "BUY",
          },
          { $set: posUpdates },
        );
      }
    }

    return NextResponse.json({ message: "Trade updated" });
  } catch (error) {
    return apiErrorResponse(error, "[admin/trades PATCH]", "Failed to update trade");
  }
}

/** DELETE /api/admin/trades?id=xxx  — delete a trade record */
export async function DELETE(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Valid id query param is required" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("trades").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Trade deleted" });
  } catch (error) {
    return apiErrorResponse(error, "[admin/trades DELETE]", "Failed to delete trade");
  }
}
