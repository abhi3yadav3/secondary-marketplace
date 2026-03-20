import { NextRequest, NextResponse } from 'next/server'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

export const dynamic = 'force-dynamic'

/**
 * GET /api/trading/assets
 *
 * Query params:
 *   ?search=nova     — filter by title or symbol (case-insensitive)
 *   ?category=tech   — filter by category
 */
export async function GET(request: NextRequest) {
  try {
    let assets = secondaryTradingAssets.investments as any[]

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.toLowerCase()
    const category = searchParams.get('category')?.toLowerCase()

    if (search) {
      assets = assets.filter(
        (a) =>
          a.title.toLowerCase().includes(search) ||
          (a.symbol && a.symbol.toLowerCase().includes(search))
      )
    }

    if (category && category !== 'all') {
      assets = assets.filter((a) => a.category.toLowerCase() === category)
    }

    return NextResponse.json({
      assets,
      total: assets.length,
    })
  } catch (error: any) {
    console.error('Error fetching trading assets:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}
