'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Storefront } from '@mui/icons-material'
import CashBalance from './CashBalance'
import styles from './Portfolio.module.css'
import api from '@/lib/api'
import { formatCurrency, slugify } from '@/lib/investmentUtils'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

const assetBySymbol = new Map(
  (secondaryTradingAssets.investments as any[]).map((a) => [a.symbol, a])
)

interface Holding {
  symbol: string
  assetTitle: string
  shares: number
  avg_cost: number
  currentPrice: number
  marketValue: number
  costBasis: number
  gainLoss: number
  gainLossPercent: number
}

interface Order {
  id: string
  symbol: string
  side: string
  quantity: number
  remaining_quantity: number
  price: number
  status: string
  created_at: string
}

export default function Portfolio() {
  const theme = useTheme()
  const router = useRouter()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [tradingBalance, setTradingBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [holdingsRes, ordersRes, balanceRes] = await Promise.all([
          api.get('/trading/holdings'),
          api.get('/trading/orders?limit=10'),
          api.get('/trading/balance'),
        ])
        setHoldings(holdingsRes.data.holdings || [])
        setOrders(ordersRes.data.orders || [])
        setTradingBalance(balanceRes.data.cashBalance)
      } catch {
        // user may not have trading data yet
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const totalGainLoss = holdings.reduce((sum, h) => sum + h.gainLoss, 0)

  return (
    <Box className={styles.portfolioContainer}>
      <CashBalance />

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: theme.palette.primary.main }} />
        </Box>
      ) : (
        <>
          {/* Trading Cash Balance */}
          {tradingBalance !== null && (
            <Paper sx={{
              p: 2.5, mb: 3, borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: '#888', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Trading Buying Power
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>
                  {formatCurrency(tradingBalance)}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Holdings */}
          <Paper sx={{
            p: 2.5, mb: 3, borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ color: '#888', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Trading Holdings
              </Typography>
              {holdings.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography sx={{ color: '#aaa', fontSize: '12px' }}>
                    Value: <span style={{ color: '#fff', fontWeight: 700 }}>{formatCurrency(totalMarketValue)}</span>
                  </Typography>
                  <Typography sx={{
                    fontSize: '12px',
                    color: totalGainLoss >= 0 ? theme.palette.primary.main : '#ff4d4d',
                    fontWeight: 600,
                  }}>
                    {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)}
                  </Typography>
                </Box>
              )}
            </Box>

            {holdings.length === 0 ? (
              <Typography sx={{ color: '#555', fontSize: '13px', py: 2, textAlign: 'center' }}>
                No holdings yet. Start trading on the marketplace.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Asset</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Shares</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Avg Cost</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Price</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Value</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>P&L</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow
                      key={h.symbol}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' } }}
                      onClick={() => {
                        const asset = assetBySymbol.get(h.symbol)
                        if (asset) router.push(`/investing/secondary-trading/${slugify(asset.title)}`)
                      }}
                    >
                      <TableCell sx={{ border: 0, py: 1 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{h.assetTitle}</Typography>
                        <Typography sx={{ color: '#666', fontSize: '11px' }}>{h.symbol}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 1 }}>{h.shares}</TableCell>
                      <TableCell align="right" sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 1 }}>{formatCurrency(h.avg_cost)}</TableCell>
                      <TableCell align="right" sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 1 }}>{formatCurrency(h.currentPrice)}</TableCell>
                      <TableCell align="right" sx={{ color: '#fff', fontWeight: 600, fontSize: '13px', border: 0, py: 1 }}>{formatCurrency(h.marketValue)}</TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 1 }}>
                        <Typography sx={{
                          fontSize: '13px', fontWeight: 600,
                          color: h.gainLoss >= 0 ? theme.palette.primary.main : '#ff4d4d',
                        }}>
                          {h.gainLoss >= 0 ? '+' : ''}{formatCurrency(h.gainLoss)}
                        </Typography>
                        <Typography sx={{
                          fontSize: '11px',
                          color: h.gainLossPercent >= 0 ? theme.palette.primary.main : '#ff4d4d',
                        }}>
                          {h.gainLossPercent >= 0 ? '+' : ''}{h.gainLossPercent.toFixed(2)}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          {/* Order History */}
          <Paper sx={{
            p: 2.5, mb: 3, borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}>
            <Typography sx={{ color: '#888', fontSize: '13px', fontWeight: 600, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Orders
            </Typography>

            {orders.length === 0 ? (
              <Typography sx={{ color: '#555', fontSize: '13px', py: 2, textAlign: 'center' }}>
                No orders yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Date</TableCell>
                    <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Side</TableCell>
                    <TableCell sx={{ color: '#555', fontSize: '11px', border: 0 }}>Symbol</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Price</TableCell>
                    <TableCell align="right" sx={{ color: '#555', fontSize: '11px', border: 0 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.02)' } }}>
                      <TableCell sx={{ color: '#888', fontSize: '12px', border: 0, py: 0.75 }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 0.75 }}>
                        <Chip
                          label={o.side.toUpperCase()}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: '10px',
                            backgroundColor: o.side === 'buy' ? 'rgba(0,255,136,0.12)' : 'rgba(255,77,77,0.12)',
                            color: o.side === 'buy' ? theme.palette.primary.main : '#ff4d4d',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#ccc', fontSize: '13px', fontWeight: 600, border: 0, py: 0.75 }}>{o.symbol}</TableCell>
                      <TableCell align="right" sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 0.75 }}>{o.quantity}</TableCell>
                      <TableCell align="right" sx={{ color: '#ccc', fontSize: '13px', border: 0, py: 0.75 }}>{formatCurrency(o.price)}</TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 0.75 }}>
                        <Chip
                          label={o.status}
                          size="small"
                          sx={{
                            fontSize: '10px', fontWeight: 600,
                            backgroundColor:
                              o.status === 'Completed' ? 'rgba(0,255,136,0.1)' :
                              o.status === 'Cancelled' ? 'rgba(255,77,77,0.1)' :
                              'rgba(255,255,255,0.06)',
                            color:
                              o.status === 'Completed' ? theme.palette.primary.main :
                              o.status === 'Cancelled' ? '#ff4d4d' :
                              '#aaa',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}

      {/* Link to Marketplace */}
      <Box sx={{ mt: 1, mb: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<Storefront />}
          onClick={() => router.push('/investing/secondary-trading')}
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            fontWeight: 600,
            textTransform: 'none',
            px: 3,
            '&:hover': {
              borderColor: '#00E677',
              backgroundColor: 'rgba(0, 255, 136, 0.08)',
            },
          }}
        >
          Go to Marketplace
        </Button>
      </Box>
    </Box>
  )
}
