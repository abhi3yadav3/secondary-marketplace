'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from '@/components/Header'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ArrowBack, Cancel as CancelIcon } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import {
  formatCurrency,
  getSecondaryTradingSymbol,
  slugify,
  getSeededColor,
  buildSecondaryTradingDailyHistory,
} from '@/lib/investmentUtils'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
import api from '@/lib/api'

const templates = (secondaryTradingAssets as any).templates

// ─── Price Chart (SVG area chart) ────────────────────────────────

function PriceChart({ data, isPositive }: { data: { date: string; close: number }[]; isPositive: boolean }) {
  const theme = useTheme()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (data.length < 2) return null

  const prices = data.map((d) => d.close)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const LEFT_PAD = 55
  const RIGHT_PAD = 10
  const TOP_PAD = 10
  const BOTTOM_PAD = 24
  const W = 600
  const H = 220
  const chartW = W - LEFT_PAD - RIGHT_PAD
  const chartH = H - TOP_PAD - BOTTOM_PAD

  const points = data.map((d, i) => {
    const x = LEFT_PAD + (i / (data.length - 1)) * chartW
    const y = TOP_PAD + (1 - (d.close - minP) / range) * chartH
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${TOP_PAD + chartH} L${points[0].x},${TOP_PAD + chartH} Z`
  const color = isPositive ? theme.palette.primary.main : '#ff4d4d'

  const yTicks = 5
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const val = minP + (range * i) / (yTicks - 1)
    const y = TOP_PAD + (1 - (val - minP) / range) * chartH
    return { val, y }
  })

  const xLabelIndices = [0, Math.floor(data.length / 2), data.length - 1]

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * W
    const relX = mouseX - LEFT_PAD
    if (relX < 0 || relX > chartW) { setHoverIdx(null); return }
    const idx = Math.round((relX / chartW) * (data.length - 1))
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)))
  }

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 220 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines & labels */}
        {yLabels.map((tick, i) => (
          <g key={i}>
            <line x1={LEFT_PAD} y1={tick.y} x2={W - RIGHT_PAD} y2={tick.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={LEFT_PAD - 8} y={tick.y + 4} textAnchor="end" fill="#555" fontSize="10" fontFamily="Inter, sans-serif">
              ${tick.val.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabelIndices.map((idx) => (
          <text
            key={idx}
            x={points[idx].x}
            y={H - 4}
            textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
            fill="#555"
            fontSize="10"
            fontFamily="Inter, sans-serif"
          >
            {data[idx].date.slice(5)}
          </text>
        ))}

        {/* Chart area + line */}
        <path d={areaPath} fill="url(#chartGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

        {/* Hover crosshair + dot */}
        {hoverIdx !== null && (
          <>
            <line x1={points[hoverIdx].x} y1={TOP_PAD} x2={points[hoverIdx].x} y2={TOP_PAD + chartH} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,3" />
            <circle cx={points[hoverIdx].x} cy={points[hoverIdx].y} r="4" fill={color} stroke="#000" strokeWidth="1.5" />
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverIdx !== null && (
        <Box sx={{
          position: 'absolute', top: 8,
          left: `${((points[hoverIdx].x / W) * 100)}%`,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 1, px: 1.5, py: 0.5, pointerEvents: 'none',
        }}>
          <Typography sx={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>
            {formatCurrency(data[hoverIdx].close)}
          </Typography>
          <Typography sx={{ color: '#888', fontSize: '10px' }}>
            {data[hoverIdx].date}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// ─── Order Book ──────────────────────────────────────────────────

function OrderBook({ basePrice }: { basePrice: number }) {
  const theme = useTheme()
  const asks = templates.orderBook.asks.map((a: any) => ({
    price: +(a.priceMultiplier * basePrice).toFixed(4),
    size: a.size,
  })).sort((a: any, b: any) => b.price - a.price)

  const bids = templates.orderBook.bids.map((b: any) => ({
    price: +(b.priceMultiplier * basePrice).toFixed(4),
    size: b.size,
  })).sort((a: any, b: any) => b.price - a.price)

  const maxSize = Math.max(...asks.map((a: any) => a.size), ...bids.map((b: any) => b.size))

  const renderRow = (row: { price: number; size: number }, type: 'ask' | 'bid') => {
    const pct = (row.size / maxSize) * 100
    const bgColor = type === 'ask' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(0, 255, 136, 0.1)'
    const textColor = type === 'ask' ? '#ff4d4d' : theme.palette.primary.main
    return (
      <TableRow
        key={`${type}-${row.price}`}
        sx={{
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
          background: `linear-gradient(to left, ${bgColor} ${pct}%, transparent ${pct}%)`,
        }}
      >
        <TableCell sx={{ color: textColor, fontWeight: 600, fontSize: '13px', border: 0, py: 0.5 }}>
          {formatCurrency(row.price)}
        </TableCell>
        <TableCell align="right" sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 0.5 }}>
          {row.size.toLocaleString()}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Typography sx={{ color: '#888', fontSize: '12px', fontWeight: 600, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Asks (Sell)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#555', fontSize: '11px', border: 0, py: 0.5 }}>Price</TableCell>
              <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0, py: 0.5 }}>Size</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {asks.map((a: any) => renderRow(a, 'ask'))}
          </TableBody>
        </Table>
      </Grid>
      <Grid item xs={6}>
        <Typography sx={{ color: '#888', fontSize: '12px', fontWeight: 600, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Bids (Buy)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#555', fontSize: '11px', border: 0, py: 0.5 }}>Price</TableCell>
              <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0, py: 0.5 }}>Size</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bids.map((b: any) => renderRow(b, 'bid'))}
          </TableBody>
        </Table>
      </Grid>
    </Grid>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function SecondaryTradingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const theme = useTheme()
  const { user, isAuthenticated } = useAuth()

  const investmentSlug = Array.isArray(params.id) ? params.id[0] : params.id
  const decodedSlug = investmentSlug ? decodeURIComponent(investmentSlug) : ''
  const allAssets = secondaryTradingAssets.investments as any[]
  const asset = allAssets.find((a: any) => a.id === decodedSlug || slugify(a.title) === decodedSlug)

  // Order form state
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [timeInForce, setTimeInForce] = useState('day')
  const [goodTilDate, setGoodTilDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Data state
  const [cashBalance, setCashBalance] = useState<number | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [position, setPosition] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)

  const symbol = asset ? getSecondaryTradingSymbol(asset.title, asset.symbol) : ''

  const dailyHistory = useMemo(() => {
    if (!asset) return []
    return buildSecondaryTradingDailyHistory(
      asset.basePrice,
      symbol,
      templates.dailyHistory
    )
  }, [asset, symbol])

  // Pre-fill price when asset loads
  useEffect(() => {
    if (asset && !price) {
      setPrice(asset.currentValue.toString())
    }
  }, [asset, price])

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated || !symbol) return
    setLoadingData(true)
    try {
      const [balRes, ordersRes, holdingsRes] = await Promise.all([
        api.get('/trading/balance'),
        api.get(`/trading/orders?symbol=${symbol}&status=open`),
        api.get('/trading/holdings'),
      ])
      setCashBalance(balRes.data.cashBalance)
      setOrders(ordersRes.data.orders || [])
      const h = (holdingsRes.data.holdings || []).find((h: any) => h.symbol === symbol)
      setPosition(h || null)
    } catch {
      // silently fail — user may not have data yet
    } finally {
      setLoadingData(false)
    }
  }, [isAuthenticated, symbol])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  if (!asset) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        <Header />
        <Container maxWidth="lg" sx={{ pt: '120px', textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#ffffff' }}>Asset not found</Typography>
          <Button onClick={() => router.push('/investing/secondary-trading')} sx={{ mt: 2, color: theme.palette.primary.main }}>
            Back to Marketplace
          </Button>
        </Container>
      </Box>
    )
  }

  const orderTotal = (Number(quantity) || 0) * (Number(price) || 0)

  const handlePlaceOrder = async () => {
    setConfirmOpen(false)
    setOrderError('')
    setOrderSuccess('')
    setSubmitting(true)
    try {
      const res = await api.post('/trading/orders', {
        symbol,
        side,
        quantity: Number(quantity),
        price: Number(price),
        timeInForce,
        ...(timeInForce === 'gtd' ? { goodTilDate } : {}),
      })
      setOrderSuccess(res.data.message)
      setQuantity('')
      fetchUserData()
    } catch (err: any) {
      setOrderError(err.response?.data?.error || 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    setOrderError('')
    setOrderSuccess('')
    try {
      await api.post('/trading/orders/cancel', { orderId })
      setOrderSuccess('Order cancelled successfully')
      fetchUserData()
    } catch (err: any) {
      setOrderError(err.response?.data?.error || 'Failed to cancel order')
    }
  }

  const handleSubmit = () => {
    setOrderError('')
    if (!Number(quantity) || Number(quantity) <= 0) {
      setOrderError('Quantity must be a positive number')
      return
    }
    if (!Number(price) || Number(price) <= 0) {
      setOrderError('Price must be a positive number')
      return
    }
    if (!Number.isInteger(Number(quantity))) {
      setOrderError('Quantity must be a whole number')
      return
    }
    if (timeInForce === 'gtd' && !goodTilDate) {
      setOrderError('Please select an expiry date for Good Till Date orders')
      return
    }
    setConfirmOpen(true)
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Header />

      <Container maxWidth="lg" sx={{ pt: { xs: '100px', sm: '120px' }, pb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/investing/secondary-trading')}
          sx={{ color: '#ffffff', mb: 2, textTransform: 'none' }}
        >
          Back to Marketplace
        </Button>

        {/* Asset Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '12px',
            backgroundColor: getSeededColor(symbol),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '16px' }}>
              {symbol.slice(0, 2)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff' }}>
              {asset.title}
            </Typography>
            <Typography sx={{ color: '#888888' }}>
              {symbol} &bull; {asset.category}
            </Typography>
          </Box>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#ffffff', mt: 2 }}>
          {formatCurrency(asset.currentValue)}
        </Typography>
        <Typography sx={{
          color: asset.isPositive ? theme.palette.primary.main : '#ff4d4d',
          fontWeight: 600, mb: 4,
        }}>
          {asset.isPositive ? '+' : ''}{asset.performancePercent.toFixed(2)}%
          &nbsp;&nbsp;
          <Typography component="span" sx={{ color: '#666', fontSize: '13px' }}>
            Vol: {asset.volume}
          </Typography>
        </Typography>

        <Grid container spacing={3}>
          {/* ── Left Column ── */}
          <Grid item xs={12} md={8}>
            {/* Price Chart */}
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
              <Typography sx={{ color: '#888', fontSize: '12px', fontWeight: 600, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Price History (30 Days)
              </Typography>
              <PriceChart data={dailyHistory} isPositive={asset.isPositive} />
            </Paper>

            {/* Order Book */}
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
              <Typography sx={{ color: '#888', fontSize: '12px', fontWeight: 600, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Order Book
              </Typography>
              <OrderBook basePrice={asset.basePrice} />
            </Paper>

            {/* User Orders & Position */}
            {isAuthenticated && (
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ color: '#888', fontSize: '12px', fontWeight: 600, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your Orders & Position
                </Typography>

                {/* Position */}
                {position && (
                  <Box sx={{ mb: 3, p: 2, borderRadius: 1.5, backgroundColor: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)' }}>
                    <Typography sx={{ color: '#888', fontSize: '11px', mb: 1, fontWeight: 600, textTransform: 'uppercase' }}>
                      Your Position
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={3}>
                        <Typography sx={{ color: '#666', fontSize: '11px' }}>Shares</Typography>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>{position.shares}</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography sx={{ color: '#666', fontSize: '11px' }}>Avg Cost</Typography>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>{formatCurrency(position.avg_cost)}</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography sx={{ color: '#666', fontSize: '11px' }}>Mkt Value</Typography>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>{formatCurrency(position.marketValue)}</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography sx={{ color: '#666', fontSize: '11px' }}>P&L</Typography>
                        <Typography sx={{
                          fontWeight: 700,
                          color: position.gainLoss >= 0 ? theme.palette.primary.main : '#ff4d4d',
                        }}>
                          {position.gainLoss >= 0 ? '+' : ''}{formatCurrency(position.gainLoss)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Open Orders */}
                {loadingData ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} sx={{ color: theme.palette.primary.main }} /></Box>
                ) : orders.length === 0 ? (
                  <Typography sx={{ color: '#555', fontSize: '13px', py: 2 }}>No open orders for this asset.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Side</TableCell>
                        <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Qty</TableCell>
                        <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Price</TableCell>
                        <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Filled</TableCell>
                        <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Status</TableCell>
                        <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }} align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((o: any) => (
                        <TableRow key={o.id} sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ border: 0, py: 0.75 }}>
                            <Chip
                              label={o.side.toUpperCase()}
                              size="small"
                              sx={{
                                fontWeight: 700, fontSize: '11px',
                                backgroundColor: o.side === 'buy' ? 'rgba(0,255,136,0.12)' : 'rgba(255,77,77,0.12)',
                                color: o.side === 'buy' ? theme.palette.primary.main : '#ff4d4d',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 0.75 }}>{o.quantity}</TableCell>
                          <TableCell sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 0.75 }}>{formatCurrency(o.price)}</TableCell>
                          <TableCell sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 0.75 }}>{o.quantity - o.remaining_quantity}/{o.quantity}</TableCell>
                          <TableCell sx={{ color: '#aaa', fontSize: '12px', border: 0, py: 0.75 }}>{o.status}</TableCell>
                          <TableCell align="right" sx={{ border: 0, py: 0.75 }}>
                            <IconButton size="small" onClick={() => handleCancelOrder(o.id)} sx={{ color: '#ff4d4d' }}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            )}
          </Grid>

          {/* ── Right Column: Order Form ── */}
          <Grid item xs={12} md={4}>
            <Paper sx={{
              p: 3, borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.08)',
              position: { md: 'sticky' }, top: { md: 100 },
            }}>
              {!isAuthenticated ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography sx={{ color: '#888', mb: 2 }}>Sign in to start trading</Typography>
                  <Button
                    variant="contained"
                    onClick={() => router.push('/auth')}
                    sx={{ backgroundColor: theme.palette.primary.main, color: '#1a1a1a', fontWeight: 700 }}
                  >
                    Sign In / Sign Up
                  </Button>
                </Box>
              ) : (
                <>
                  <Typography sx={{ color: '#888', fontSize: '12px', fontWeight: 600, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Place Order
                  </Typography>

                  {/* Buy/Sell Toggle */}
                  <ToggleButtonGroup
                    value={side}
                    exclusive
                    onChange={(_, val) => { if (val) setSide(val) }}
                    fullWidth
                    sx={{ mb: 2.5 }}
                  >
                    <ToggleButton value="buy" sx={{
                      fontWeight: 700, textTransform: 'none', fontSize: '14px',
                      color: side === 'buy' ? '#fff' : '#888',
                      backgroundColor: side === 'buy' ? 'rgba(0,255,136,0.15)' : 'transparent',
                      borderColor: side === 'buy' ? theme.palette.primary.main : 'rgba(255,255,255,0.12)',
                      '&.Mui-selected': { backgroundColor: 'rgba(0,255,136,0.15)', color: theme.palette.primary.main },
                      '&.Mui-selected:hover': { backgroundColor: 'rgba(0,255,136,0.2)' },
                    }}>
                      Buy
                    </ToggleButton>
                    <ToggleButton value="sell" sx={{
                      fontWeight: 700, textTransform: 'none', fontSize: '14px',
                      color: side === 'sell' ? '#fff' : '#888',
                      backgroundColor: side === 'sell' ? 'rgba(255,77,77,0.15)' : 'transparent',
                      borderColor: side === 'sell' ? '#ff4d4d' : 'rgba(255,255,255,0.12)',
                      borderLeft: side === 'sell' ? '1px solid #ff4d4d' : '1px solid rgba(255,255,255,0.12)',
                      '&.Mui-selected': { backgroundColor: 'rgba(255,77,77,0.15)', color: '#ff4d4d', borderLeft: '1px solid #ff4d4d' },
                      '&.Mui-selected:hover': { backgroundColor: 'rgba(255,77,77,0.2)' },
                    }}>
                      Sell
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {/* Quantity */}
                  <Typography sx={{ color: '#888', fontSize: '12px', mb: 0.5 }}>Quantity (shares)</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        color: '#fff', backgroundColor: 'rgba(255,255,255,0.04)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                      },
                    }}
                    inputProps={{ min: 1, step: 1 }}
                  />

                  {/* Price */}
                  <Typography sx={{ color: '#888', fontSize: '12px', mb: 0.5 }}>Price per share ($)</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        color: '#fff', backgroundColor: 'rgba(255,255,255,0.04)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                      },
                    }}
                    inputProps={{ min: 0.01, step: 0.01 }}
                  />

                  {/* Time in Force */}
                  <Typography sx={{ color: '#888', fontSize: '12px', mb: 0.5 }}>Time in Force</Typography>
                  <Select
                    fullWidth
                    value={timeInForce}
                    onChange={(e) => setTimeInForce(e.target.value)}
                    sx={{
                      mb: 2.5, color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
                      '& .MuiSvgIcon-root': { color: '#888' },
                    }}
                  >
                    <MenuItem value="day">Day Order</MenuItem>
                    <MenuItem value="gtc">Good Till Cancelled</MenuItem>
                    <MenuItem value="gtd">Good Till Date</MenuItem>
                  </Select>

                  {/* GTD Date Picker */}
                  {timeInForce === 'gtd' && (
                    <>
                      <Typography sx={{ color: '#888', fontSize: '12px', mb: 0.5 }}>Expiry Date</Typography>
                      <TextField
                        fullWidth
                        type="date"
                        value={goodTilDate}
                        onChange={(e) => setGoodTilDate(e.target.value)}
                        inputProps={{ min: new Date().toISOString().split('T')[0] }}
                        sx={{
                          mb: 2.5,
                          '& .MuiOutlinedInput-root': {
                            color: '#fff', backgroundColor: 'rgba(255,255,255,0.04)',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                          },
                          '& input::-webkit-calendar-picker-indicator': { filter: 'invert(1)' },
                        }}
                      />
                    </>
                  )}

                  {/* Order Total */}
                  <Box sx={{
                    p: 2, mb: 2.5, borderRadius: 1.5,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: '#888', fontSize: '13px' }}>Order Total</Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                        {formatCurrency(orderTotal)}
                      </Typography>
                    </Box>
                    {cashBalance !== null && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ color: '#666', fontSize: '12px' }}>Cash Available</Typography>
                        <Typography sx={{ color: '#aaa', fontSize: '12px' }}>
                          {formatCurrency(cashBalance)}
                        </Typography>
                      </Box>
                    )}
                    {position && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ color: '#666', fontSize: '12px' }}>Shares Held</Typography>
                        <Typography sx={{ color: '#aaa', fontSize: '12px' }}>
                          {position.shares}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Error / Success Messages */}
                  {orderError && <Alert severity="error" sx={{ mb: 2, fontSize: '13px' }}>{orderError}</Alert>}
                  {orderSuccess && <Alert severity="success" sx={{ mb: 2, fontSize: '13px' }}>{orderSuccess}</Alert>}

                  {/* Submit */}
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting || !quantity || !price}
                    sx={{
                      py: 1.5, fontWeight: 700, fontSize: '15px',
                      backgroundColor: side === 'buy' ? theme.palette.primary.main : '#ff4d4d',
                      color: side === 'buy' ? '#1a1a1a' : '#fff',
                      '&:hover': {
                        backgroundColor: side === 'buy' ? '#00E677' : '#ff3333',
                      },
                      '&:disabled': {
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        color: '#555',
                      },
                    }}
                  >
                    {submitting ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
                  </Button>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(255,255,255,0.12)', minWidth: 360 } }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Confirm Order</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#888' }}>Side</Typography>
                <Chip
                  label={side.toUpperCase()}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    backgroundColor: side === 'buy' ? 'rgba(0,255,136,0.12)' : 'rgba(255,77,77,0.12)',
                    color: side === 'buy' ? theme.palette.primary.main : '#ff4d4d',
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#888' }}>Symbol</Typography>
                <Typography sx={{ fontWeight: 600 }}>{symbol}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#888' }}>Quantity</Typography>
                <Typography sx={{ fontWeight: 600 }}>{quantity} shares</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#888' }}>Price</Typography>
                <Typography sx={{ fontWeight: 600 }}>{formatCurrency(Number(price))}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: '#888', fontWeight: 600 }}>Total</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '16px' }}>{formatCurrency(orderTotal)}</Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setConfirmOpen(false)} sx={{ color: '#888', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handlePlaceOrder}
              sx={{
                fontWeight: 700, textTransform: 'none',
                backgroundColor: side === 'buy' ? theme.palette.primary.main : '#ff4d4d',
                color: side === 'buy' ? '#1a1a1a' : '#fff',
                '&:hover': { backgroundColor: side === 'buy' ? '#00E677' : '#ff3333' },
              }}
            >
              Confirm {side === 'buy' ? 'Buy' : 'Sell'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}
