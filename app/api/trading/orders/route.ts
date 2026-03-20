import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { matchOrder } from '@/lib/matchingEngine'
import {
  getTradingBalance,
  updateTradingBalance,
  getHolding,
  getOpenSellQuantity,
  getTradesForOrder,
  getUserOrders,
  getOrder,
} from '@/lib/tradingStore'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

export const dynamic = 'force-dynamic'

const VALID_SIDES = ['buy', 'sell'] as const
const VALID_TIME_IN_FORCE = ['day', 'gtc', 'gtd'] as const

const validSymbols = new Set(
  (secondaryTradingAssets.investments as any[]).map((a) => a.symbol)
)

/**
 * POST /api/trading/orders — Place a buy or sell order
 *
 * Body: { symbol, side, quantity, price, timeInForce, goodTilDate? }
 *
 * Cash flow:
 *   Buy  → deduct (qty × price) upfront; refund price-improvement after matching
 *   Sell → credit (tradeQty × tradePrice) for each fill
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { symbol, side, quantity, price, timeInForce, goodTilDate } = body

    // --- Validate inputs ---
    if (!symbol || !validSymbols.has(symbol)) {
      return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
    }
    if (!VALID_SIDES.includes(side)) {
      return NextResponse.json({ error: 'Side must be "buy" or "sell"' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 })
    }
    const orderPrice = Number(price)
    if (!orderPrice || orderPrice <= 0) {
      return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 })
    }
    if (!VALID_TIME_IN_FORCE.includes(timeInForce)) {
      return NextResponse.json({ error: 'Invalid time-in-force' }, { status: 400 })
    }
    if (timeInForce === 'gtd' && !goodTilDate) {
      return NextResponse.json({ error: 'goodTilDate required for GTD orders' }, { status: 400 })
    }

    const totalCost = qty * orderPrice

    // --- Balance / position checks ---
    if (side === 'buy') {
      const cashBalance = getTradingBalance(userId)
      if (cashBalance < totalCost) {
        return NextResponse.json(
          { error: `Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${cashBalance.toFixed(2)}` },
          { status: 400 }
        )
      }
      // Reserve cash upfront
      updateTradingBalance(userId, -totalCost)
    }

    if (side === 'sell') {
      const holding = getHolding(userId, symbol)
      const sharesOwned = holding?.shares ?? 0
      const sharesReserved = getOpenSellQuantity(userId, symbol)
      const availableShares = sharesOwned - sharesReserved
      if (availableShares < qty) {
        return NextResponse.json(
          { error: `Insufficient shares. Available: ${availableShares}, Requested: ${qty}` },
          { status: 400 }
        )
      }
    }

    // --- Place order & match ---
    const orderId = crypto.randomUUID()
    const result = matchOrder(
      orderId,
      userId,
      symbol,
      side as 'buy' | 'sell',
      qty,
      orderPrice,
      timeInForce,
      goodTilDate || null
    )

    // --- Settle cash for trades ---
    const trades = getTradesForOrder(orderId)

    for (const trade of trades) {
      if (side === 'buy') {
        // Trade executed at match price (≤ order price). Refund the difference.
        const savings = (orderPrice - trade.price) * trade.quantity
        if (savings > 0) {
          updateTradingBalance(userId, savings)
        }
        // Credit the seller
        const sellOrder = getOrder(trade.sell_order_id)
        if (sellOrder && sellOrder.user_id !== userId) {
          updateTradingBalance(sellOrder.user_id, trade.price * trade.quantity)
        }
      } else {
        // Sell order: credit the seller (current user)
        updateTradingBalance(userId, trade.price * trade.quantity)
        // The buyer's cash was already deducted when they placed their buy order.
        // Trade executes at buyer's price, so no refund needed for the buyer.
      }
    }

    const order = getOrder(orderId)

    return NextResponse.json({
      order,
      result,
      trades,
      message: result.status === 'Completed'
        ? `Order fully filled (${qty} shares)`
        : result.status === 'PartiallyFilled'
          ? `Order partially filled (${qty - result.remaining} of ${qty} shares)`
          : 'Order placed on the book',
    })
  } catch (error: any) {
    console.error('Error placing order:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to place order' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/trading/orders — Get user's orders
 *
 * Query params: ?symbol=NVMT&status=open|closed&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || undefined
    const status = searchParams.get('status') || undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50

    const orders = getUserOrders(userId, { symbol, status, limit })
    return NextResponse.json({ orders })
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
