import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { getAllHoldings } from '@/lib/tradingStore'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

export const dynamic = 'force-dynamic'

const assetsBySymbol = new Map(
  (secondaryTradingAssets.investments as any[]).map((a) => [a.symbol, a])
)

/**
 * GET /api/trading/holdings — Get user's share positions
 *
 * Returns holdings enriched with current market data (price, name, P&L).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const holdings = getAllHoldings(userId)

    const enriched = holdings.map((h) => {
      const asset = assetsBySymbol.get(h.symbol)
      const currentPrice = asset?.currentValue ?? h.avg_cost
      const marketValue = h.shares * currentPrice
      const costBasis = h.shares * h.avg_cost
      const gainLoss = marketValue - costBasis
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

      return {
        ...h,
        assetTitle: asset?.title ?? h.symbol,
        currentPrice,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPercent,
      }
    })

    return NextResponse.json({ holdings: enriched })
  } catch (error: any) {
    console.error('Error fetching holdings:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch holdings' },
      { status: 500 }
    )
  }
}
