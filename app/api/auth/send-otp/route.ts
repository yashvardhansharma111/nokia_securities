import { NextResponse } from "next/server";
import { setOtp } from "@/lib/otp-cache";

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function sendSms(phone: string, otp: string): Promise<void> {
  const apiKey = process.env.SMS_API_KEY;
  console.log("[send-otp] SMS_API_KEY present:", !!apiKey);
  if (!apiKey) throw new Error("SMS_API_KEY not configured in .env");

  const url = `https://sms.renflair.in/V1.php?API=${apiKey}&PHONE=${phone}&OTP=${otp}`;
  console.log(`[send-otp] Calling SMS API → PHONE=${phone} OTP=${otp} (key last4=...${apiKey.slice(-4)})`);

  // AbortSignal.timeout is Node 17.3+ — use manual controller for compatibility
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (fetchErr: any) {
    clearTimeout(timer);
    const msg = fetchErr?.name === "AbortError" ? "SMS API timed out" : (fetchErr?.message ?? String(fetchErr));
    console.error("[send-otp] fetch() threw:", msg);
    throw new Error(`SMS fetch error: ${msg}`);
  }
  clearTimeout(timer);

  const bodyText = await res.text().catch(() => "");
  console.log(`[send-otp] SMS API status=${res.status} body=${bodyText}`);

  if (!res.ok) {
    throw new Error(`SMS API HTTP ${res.status}: ${bodyText}`);
  }

  // Renflair returns HTTP 200 even on failure — check JSON body
  try {
    const json = JSON.parse(bodyText);
    // Renflair success: { "return": true } or { "status": "success" }
    const ok =
      json?.return === true ||
      json?.return === "true" ||
      String(json?.status).toLowerCase() === "success" ||
      json?.code === 200;
    if (!ok) {
      throw new Error(`SMS API error: ${json?.message || json?.error || bodyText}`);
    }
  } catch (parseErr: any) {
    // Not JSON — treat plain-text "true" / "1" as success, anything else as error
    if (parseErr.message?.startsWith("SMS API error")) throw parseErr;
    const plain = bodyText.trim().toLowerCase();
    if (plain !== "true" && plain !== "1" && plain !== "success") {
      console.warn("[send-otp] Non-JSON body, treating as success:", bodyText);
    }
  }
}

export async function POST(request: Request) {
  try {
    let rawBody: any;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const phone = normalizePhone(rawBody.phone ?? "");
    console.log(`[send-otp] phone raw="${rawBody.phone}" normalised="${phone}"`);

    if (phone.length !== 10) {
      return NextResponse.json(
        { message: "Enter a valid 10-digit phone number" },
        { status: 400 },
      );
    }

    const code = generateOtp();
    setOtp(phone, code);
    console.log(`[send-otp] OTP ${code} cached for ${phone}`);

    await sendSms(phone, code);
    console.log(`[send-otp] SMS dispatched OK for ${phone}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-otp] ERROR:", err?.message ?? err);
    return NextResponse.json(
      { message: err?.message || "Failed to send OTP" },
      { status: 500 },
    );
  }
}
