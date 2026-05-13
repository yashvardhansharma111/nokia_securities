import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { setEmailOtp } from "@/lib/email-otp-cache";
import { sendOtpEmail } from "@/lib/mailer";

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  try {
    let body: { email?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const email = (body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Enter a valid email address" }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");
    const user = await users.findOne(
      { email },
      { projection: { _id: 1, email: 1, status: 1 } },
    );

    if (!user) {
      // Don't reveal whether email exists — return success either way
      return NextResponse.json({ success: true });
    }

    if (user.status === "blocked") {
      return NextResponse.json(
        { message: "Account is blocked. Contact support." },
        { status: 403 },
      );
    }

    const otp = generateOtp();
    setEmailOtp(email, otp);

    try {
      await sendOtpEmail(email, otp);
      console.log(`[forgot-password] OTP sent to ${email}`);
    } catch (mailErr: unknown) {
      const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error("[forgot-password] Email send error:", msg);
      return NextResponse.json(
        { message: "Could not send OTP email. Try again later." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[forgot-password/send-otp] ERROR:", msg);
    return NextResponse.json({ message: "Failed to send OTP" }, { status: 500 });
  }
}
