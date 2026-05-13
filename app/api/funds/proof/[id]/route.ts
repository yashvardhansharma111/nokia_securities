import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const db = await getDb();
    const funds = db.collection("fund_requests");

    // Allow admin or the user who submitted the request
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    const isAdmin = adminCookie?.value === "ok";

    let doc: Record<string, unknown> | null = null;

    if (isAdmin) {
      doc = await funds.findOne({ _id: new ObjectId(id) });
    } else {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      doc = await funds.findOne({
        _id: new ObjectId(id),
        userId: new ObjectId((user as { _id: ObjectId })._id),
      });
    }

    if (!doc || !doc.proofData) {
      return NextResponse.json({ message: "Proof not found" }, { status: 404 });
    }

    const buffer = (doc.proofData as { buffer: Buffer }).buffer;
    const contentType = (doc.proofContentType as string) || "image/jpeg";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Proof fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch proof" },
      { status: 500 },
    );
  }
}
