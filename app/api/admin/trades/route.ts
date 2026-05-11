import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/trades";
import { getDb } from "@/lib/mongodb";

async function requireAdmin() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("ajx_admin");
  return !!adminCookie && adminCookie.value === "ok";
}

/** GET /api/admin/trades?userId=xxx  — list real trades for a user */
export async function GET(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);

    const db = await getDb();
    const query = userId ? { userId: { $exists: true } } : {};
    const pipeline: any[] = [
      ...(userId ? [{ $match: { userId: { $oid: userId } as any } }] : []),
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

    console.log(`[admin/trades] Placing ${side} ${qty}×${exchange}:${symbol} for user ${userId}`);

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

    return NextResponse.json({
      message: `${side} order placed for ${symbol}`,
      trade: result.trade,
      newBalance: result.newBalance,
    });
  } catch (error: any) {
    console.error("[admin/trades POST]", error?.message);
    return apiErrorResponse(error, "[admin/trades POST]", error?.message || "Trade failed");
  }
}
