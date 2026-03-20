import crypto from 'crypto'
import db from '@/lib/db'

export interface TradingOrder {
  id: string
  user_id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  remaining_quantity: number
  price: number
  status: string
  time_in_force: string
  good_til_date: string | null
  created_at: string
  updated_at: string
}

export interface TradingTrade {
  id: string
  buy_order_id: string
  sell_order_id: string
  symbol: string
  quantity: number
  price: number
  created_at: string
}

export interface TradingHolding {
  id: string
  user_id: string
  symbol: string
  shares: number
  avg_cost: number
  created_at: string
  updated_at: string
}

export interface TradingBalance {
  id: string
  user_id: string
  cash_balance: number
}

export function getTradingBalance(userId: string): number {
  const row = db.prepare(
    'SELECT cash_balance FROM trading_balances WHERE user_id = ?'
  ).get(userId) as { cash_balance: number } | undefined
  return row?.cash_balance ?? 0
}

export function ensureTradingBalance(userId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO trading_balances (id, user_id, cash_balance)
     VALUES (?, ?, 0)`
  ).run(crypto.randomUUID(), userId)
}

export function updateTradingBalance(userId: string, delta: number): void {
  ensureTradingBalance(userId)
  db.prepare(
    `UPDATE trading_balances
     SET cash_balance = cash_balance + ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(delta, userId)
}

export function getHolding(userId: string, symbol: string): TradingHolding | undefined {
  return db.prepare(
    'SELECT * FROM trading_holdings WHERE user_id = ? AND symbol = ?'
  ).get(userId, symbol) as TradingHolding | undefined
}

export function getAllHoldings(userId: string): TradingHolding[] {
  return db.prepare(
    'SELECT * FROM trading_holdings WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(userId) as TradingHolding[]
}

export function getOpenSellQuantity(userId: string, symbol: string): number {
  const row = db.prepare(
    `SELECT COALESCE(SUM(remaining_quantity), 0) as total
     FROM trading_orders
     WHERE user_id = ? AND symbol = ? AND side = 'sell'
       AND status IN ('New', 'Pending', 'PartiallyFilled')`
  ).get(userId, symbol) as { total: number }
  return row.total
}

export function getOrder(orderId: string): TradingOrder | undefined {
  return db.prepare(
    'SELECT * FROM trading_orders WHERE id = ?'
  ).get(orderId) as TradingOrder | undefined
}

export function getUserOrders(userId: string, filters?: {
  symbol?: string
  status?: string
  limit?: number
}): TradingOrder[] {
  let query = 'SELECT * FROM trading_orders WHERE user_id = ?'
  const params: any[] = [userId]

  if (filters?.symbol) {
    query += ' AND symbol = ?'
    params.push(filters.symbol)
  }

  if (filters?.status === 'open') {
    query += " AND status IN ('New', 'Pending', 'PartiallyFilled')"
  } else if (filters?.status === 'closed') {
    query += " AND status IN ('Completed', 'Cancelled')"
  } else if (filters?.status) {
    query += ' AND status = ?'
    params.push(filters.status)
  }

  query += ' ORDER BY created_at DESC'

  if (filters?.limit) {
    query += ' LIMIT ?'
    params.push(filters.limit)
  }

  return db.prepare(query).all(...params) as TradingOrder[]
}

export function getTradesForOrder(orderId: string): TradingTrade[] {
  return db.prepare(
    'SELECT * FROM trading_trades WHERE buy_order_id = ? OR sell_order_id = ? ORDER BY created_at ASC'
  ).all(orderId, orderId) as TradingTrade[]
}

export function cancelOrder(order: TradingOrder): void {
  db.prepare(
    `UPDATE trading_orders
     SET status = 'Cancelled', updated_at = datetime('now')
     WHERE id = ?`
  ).run(order.id)
}
