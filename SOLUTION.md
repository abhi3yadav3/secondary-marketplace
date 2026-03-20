# Solution

## What I Built

I built the full secondary marketplace — users can browse assets, place buy/sell orders, cancel them, and track everything in their portfolio.

### Marketplace (`/investing/secondary-trading`)

A search bar and category filters (Tech, Healthcare, Energy, etc.) let users find assets quickly. Each card shows the price, trend graph, and performance. Clicking one takes you to the detail page.

### Trading (`/investing/secondary-trading/[id]`)

The detail page has a 30-day price chart with hover tooltips, a live order book (asks/bids), and an order form with buy/sell toggle, quantity, price, and time-in-force options. There's a confirmation dialog before every order, and your open orders and position show below the chart with a cancel button.

### Backend APIs

- `POST /api/trading/orders` — places orders with full validation (symbol, quantity, price, balance/share checks), calls the matching engine, and handles cash settlement including price improvement refunds
- `POST /api/trading/orders/cancel` — cancels open orders and refunds reserved cash
- `GET /api/trading/orders` — lists orders with optional symbol/status filters
- `GET /api/trading/holdings` — returns positions enriched with current price and P&L
- `GET /api/trading/balance` — returns trading cash balance
- `GET /api/trading/assets` — enhanced with `?search=` and `?category=` params

### Portfolio (`/account/portfolio`)

The portfolio now shows trading holdings (with market value and P&L), recent orders, and the trading buying power — all integrated into the existing portfolio overview totals.

## Key Decisions

**Separate trading balance from deposit balance.** The starter code has banking deposits in a `payments` table and trading cash in `trading_balances`. I kept them separate rather than merging, since that's how the schema was designed. The portfolio overview shows both.

**Cash reserved upfront for buys.** When you place a buy order, the full cost is deducted immediately. If the order matches at a better price, the difference is refunded. This prevents overspending when multiple orders are open.

**Sell orders check available shares.** Before placing a sell, I check holdings minus shares already committed to other open sell orders — so you can't accidentally sell more than you own.

**Reused existing components.** The listing page uses the provided `SecondaryTradingCard` component (with trend graphs and styling) rather than building from scratch. The order book uses the `templates.orderBook` multipliers as designed.

**Pure SVG chart.** The price chart is a hand-built SVG area chart with axis labels and hover interaction — no chart library needed for this scope.

## What I'd Improve With More Time

- **Real-time order book** — replace the static template data with actual orders from the database, updated via WebSocket or polling
- **Market orders** — add a market order type that executes immediately at the best available price
- **Candlestick chart** — the OHLCV data supports it, I went with an area chart for simplicity
- **Order book depth chart** — visual representation of cumulative bid/ask volume
- **Trade history** — a detailed log of all matched trades with timestamps
- **Unit tests** — especially for the order placement flow and cash settlement logic

## Screen Recording

[Link to screen recording will be added here]
