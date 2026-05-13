import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { Binary, ObjectId } from "mongodb";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      console.warn("[funds/request GET] unauthenticated");
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const db = await getDb();
    const funds = db.collection("fund_requests");

    const requests = await funds
      .find({ userId: new ObjectId((user as { _id: ObjectId })._id) })
      .sort({ createdAt: -1 })
      .limit(25)
      .toArray();

    return NextResponse.json({
      requests: requests.map((item) => ({
        _id: item._id,
        type: item.type || "add",
        amount: item.amount,
        method: item.method || "upi",
        reference: item.reference || "",
        note: item.note || "",
        status: item.status || "pending",
        createdAt: item.createdAt,
        processedAt: item.processedAt || null,
        hasProof: !!item.proofData,
      })),
    });
  } catch (error) {
    console.error("[funds/request GET] error:", error);
    return NextResponse.json({ message: "Failed to load fund requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log("[funds/request POST] incoming");

  try {
    // ── 1. Auth ──────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    console.log("[funds/request POST] Authorization header present:", !!authHeader, authHeader?.slice(0, 20));

    const user = await getUserFromRequest(request);
    console.log("[funds/request POST] user resolved:", user ? `id=${(user as any)._id}` : "null (unauthenticated)");

    if (!user) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    // ── 2. Parse body ─────────────────────────────────────────────
    const contentType = request.headers.get("content-type") || "";
    console.log("[funds/request POST] content-type:", contentType);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error("[funds/request POST] JSON parse error:", parseErr);
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const { amount, method, reference, type, proofBase64, proofType } = body || {};
    console.log("[funds/request POST] body fields:", {
      amount,
      method,
      reference,
      type,
      hasProofBase64: typeof proofBase64 === "string" && proofBase64.length > 0,
      proofBase64Len: typeof proofBase64 === "string" ? proofBase64.length : 0,
      proofType,
    });

    // ── 3. Validate amount ────────────────────────────────────────
    const numericAmount = Number(amount);
    console.log("[funds/request POST] numericAmount:", numericAmount);
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ message: "Valid amount is required" }, { status: 400 });
    }

    const requestType = type === "withdraw" ? "withdraw" : "add";
    console.log("[funds/request POST] requestType:", requestType);

    // ── 4. Withdraw balance check ─────────────────────────────────
    const db = await getDb();
    const funds = db.collection("fund_requests");
    const users = db.collection("users");

    if (requestType === "withdraw") {
      const currentUser = await users.findOne<{ tradingBalance?: number }>(
        { _id: new ObjectId((user as { _id: ObjectId })._id) },
      );
      const currentBalance = Number(currentUser?.tradingBalance ?? 0);
      console.log("[funds/request POST] withdraw check — balance:", currentBalance, "requested:", numericAmount);
      if (numericAmount > currentBalance) {
        return NextResponse.json(
          { message: "Withdrawal amount cannot exceed current trading balance" },
          { status: 400 },
        );
      }
    }

    // ── 5. Build document ─────────────────────────────────────────
    const doc: Record<string, unknown> = {
      userId: new ObjectId((user as { _id: ObjectId })._id),
      type: requestType,
      amount: numericAmount,
      method: method || "upi",
      reference: reference || "",
      status: "pending",
      createdAt: new Date(),
    };

    if (proofBase64 && typeof proofBase64 === "string") {
      try {
        const buf = Buffer.from(proofBase64, "base64");
        doc.proofData = new Binary(buf);
        doc.proofContentType = typeof proofType === "string" ? proofType : "image/jpeg";
        console.log("[funds/request POST] proof attached, bytes:", buf.byteLength);
      } catch (bufErr) {
        console.error("[funds/request POST] base64 decode error:", bufErr);
      }
    } else {
      console.log("[funds/request POST] no proof attached");
    }

    // ── 6. Insert ─────────────────────────────────────────────────
    console.log("[funds/request POST] inserting document...");
    const result = await funds.insertOne(doc);
    console.log("[funds/request POST] inserted ok, id:", result.insertedId);

    return NextResponse.json({
      message:
        requestType === "withdraw"
          ? "Withdraw request submitted. Admin will verify and process your withdrawal."
          : "Fund request submitted. Admin will verify payment and update your balance.",
    });
  } catch (error: any) {
    console.error("[funds/request POST] unhandled error:", error?.message ?? error);
    return NextResponse.json({ message: "Failed to submit fund request" }, { status: 500 });
  }
}
