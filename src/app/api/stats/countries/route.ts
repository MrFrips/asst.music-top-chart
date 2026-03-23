import { NextResponse } from 'next/server';
import { SUPPORTED_COUNTRIES } from '@/lib/scraping/kworbCountry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const countries = Object.entries(SUPPORTED_COUNTRIES).map(([code, info]) => ({
    code,
    name: info.name,
    flag: info.flag,
  }));

  return NextResponse.json({ countries });
}
