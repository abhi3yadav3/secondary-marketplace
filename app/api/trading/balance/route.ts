import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { getTradingBalance, ensureTradingBalance } from '@/lib/tradingStore'

export const dynamic = 'force-dynamic'

/**
 * GET /api/trading/balance — Get user's trading cash balance
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    ensureTradingBalance(userId)
    const cashBalance = getTradingBalance(userId)

    return NextResponse.json({ cashBalance })
  } catch (error: any) {
    console.error('Error fetching trading balance:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch trading balance' },
      { status: 500 }
    )
  }
}
