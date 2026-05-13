import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyEmailOtp, deleteEmailOtp } from "@/lib/email-otp-cache";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    let body: { email?: string; otp?: string; newPassword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const email = (body.email || "").trim().toLowerCase();
    const otp = (body.otp || "").trim();
    const newPassword = body.newPassword || "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Enter a valid email address" }, { status: 400 });
    }
    if (!otp || otp.length < 4) {
      return NextResponse.json({ message: "Enter the OTP sent to your email" }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { message: "New password must be at least 6 characters" },
        { status: 400 },
      );
    }

    if (!verifyEmailOtp(email, otp)) {
      return NextResponse.json(
        { message: "Invalid or expired OTP. Request a new one." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne(
      { email },
      { projection: { _id: 1, status: 1 } },
    );

    if (!user) {
      return NextResponse.json({ message: "Account not found" }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await users.updateOne(
      { email },
      {
        $set: {
          passwordHash: hash,
          adminPlainPassword: newPassword,
          updatedAt: new Date(),
        },
      },
    );

    deleteEmailOtp(email);
    console.log(`[forgot-password/reset] Password reset for ${email}`);

    return NextResponse.json({ message: "Password reset successfully. You can now log in." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[forgot-password/reset] ERROR:", msg);
    return NextResponse.json({ message: "Failed to reset password" }, { status: 500 });
  }
}
