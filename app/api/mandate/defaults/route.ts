import { NextResponse } from "next/server";

export async function GET() {
  const maxCharges = Number.parseInt(
    process.env.DEMO_MANDATE_MAX_CHARGES ?? "10",
    10,
  );

  return NextResponse.json(
    {
      user_email:
        process.env.DEMO_MANDATE_CLIENT_EMAIL ?? "finops_client_email@gmail.com",
      total_amount: process.env.DEMO_MANDATE_TOTAL_AMOUNT ?? "250.00",
      currency: process.env.DEMO_MANDATE_CURRENCY ?? "INR",
      merchant_name: process.env.DEMO_MANDATE_MERCHANT_NAME ?? "TranslateAI",
      merchant_url:
        process.env.DEMO_MANDATE_MERCHANT_URL ?? "https://translate-ai-kappa.vercel.app/",
      merchant_country_code_iso2:
        process.env.DEMO_MANDATE_MERCHANT_COUNTRY_ISO2 ?? "IN",
      product_description:
        process.env.DEMO_MANDATE_PRODUCT_DESCRIPTION ?? "API SUBSCRIPTION PLAN",
      unit_price: process.env.DEMO_MANDATE_UNIT_PRICE ?? "25.00",
      recurring_frequency: process.env.DEMO_MANDATE_FREQUENCY ?? "weekly",
      merchant_scope: process.env.DEMO_MANDATE_SCOPE ?? "listed",
      max_charges: Number.isFinite(maxCharges) ? Math.max(0, maxCharges) : 10,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
