import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import {
  getOrder,
  cancelOrder,
  updateTradingBalance,
} from '@/lib/tradingStore'

const CANCELLABLE_STATUSES = new Set(['New', 'Pending', 'PartiallyFilled'])

/**
 * POST /api/trading/orders/cancel — Cancel an open order
 *
 * Body: { orderId }
 *
 * - Validates the order belongs to the user and is still cancellable
 * - Sets status to Cancelled
 * - Refunds reserved cash for buy orders (remaining_quantity × price)
 * - Sell orders need no refund (shares were never removed from holdings for unfilled portion)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const order = getOrder(orderId)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return NextResponse.json(
        { error: `Cannot cancel order with status "${order.status}"` },
        { status: 400 }
      )
    }

    cancelOrder(order)

    if (order.side === 'buy') {
      const refund = order.remaining_quantity * order.price
      updateTradingBalance(userId, refund)
    }

    return NextResponse.json({
      message: 'Order cancelled',
      orderId: order.id,
      refunded: order.side === 'buy'
        ? order.remaining_quantity * order.price
        : 0,
    })
  } catch (error: any) {
    console.error('Error cancelling order:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
