'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import SecondaryTradingCard, { SecondaryTradingCardData } from '@/components/investments/SecondaryTradingCard'
import {
  Box,
  Container,
  Typography,
  Grid,
  TextField,
  Chip,
  InputAdornment,
  CircularProgress,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Search } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
import {
  formatCurrency,
  getSecondaryTradingSymbol,
  buildSecondaryTradingMonthlySeries,
} from '@/lib/investmentUtils'

type Asset = {
  id: string
  title: string
  category: string
  basePrice: number
  previousValue: number
  currentValue: number
  performancePercent: number
  isPositive: boolean
  volume: string
  companyDescription: string
  symbol?: string
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'tech', label: 'Technology' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'energy', label: 'Energy' },
  { key: 'consumer', label: 'Consumer' },
  { key: 'finance', label: 'Finance' },
]

export default function SecondaryTradingPage() {
  const router = useRouter()
  const theme = useTheme()
  const { isAuthenticated } = useAuth()
  const allAssets = secondaryTradingAssets.investments as Asset[]
  const dailyTemplate = useMemo(
    () => (secondaryTradingAssets as any).templates?.dailyHistory ?? [],
    []
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const filteredAssets = useMemo(() => {
    let result = allAssets

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.symbol && a.symbol.toLowerCase().includes(q)) ||
          getSecondaryTradingSymbol(a.title, a.symbol).toLowerCase().includes(q)
      )
    }

    if (activeCategory !== 'all') {
      result = result.filter((a) => a.category === activeCategory)
    }

    return result
  }, [allAssets, searchQuery, activeCategory])

  const cardData: SecondaryTradingCardData[] = useMemo(() => {
    return filteredAssets.map((asset) => {
      const symbol = getSecondaryTradingSymbol(asset.title, asset.symbol)
      const trendData = buildSecondaryTradingMonthlySeries(
        asset.basePrice,
        symbol,
        dailyTemplate,
        30
      )
      return {
        id: asset.id,
        title: asset.title,
        previousValue: asset.previousValue,
        currentValue: asset.currentValue,
        performancePercent: asset.performancePercent,
        isPositive: asset.isPositive,
        trendData,
        symbol: asset.symbol,
        volume: asset.volume,
        lastPrice: formatCurrency(asset.currentValue),
        category: asset.category as SecondaryTradingCardData['category'],
      }
    })
  }, [filteredAssets, dailyTemplate])

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Header />

      <Container maxWidth="lg" sx={{ pt: { xs: '100px', sm: '120px' }, pb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff', mb: 0.5 }}>
          Secondary Marketplace
        </Typography>
        <Typography sx={{ color: '#888888', mb: 3 }}>
          Browse and trade digital securities on the secondary market.
        </Typography>

        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search by asset name or symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#666' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 2,
              color: '#ffffff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
              '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
            },
            '& .MuiInputBase-input::placeholder': { color: '#666', opacity: 1 },
          }}
        />

        {/* Category Filters */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.key}
              label={cat.label}
              clickable
              onClick={() => setActiveCategory(cat.key)}
              sx={{
                fontWeight: 600,
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeCategory === cat.key
                  ? theme.palette.primary.main
                  : 'rgba(255,255,255,0.12)',
                backgroundColor: activeCategory === cat.key
                  ? 'rgba(0, 255, 136, 0.12)'
                  : 'rgba(255,255,255,0.04)',
                color: activeCategory === cat.key
                  ? theme.palette.primary.main
                  : '#aaa',
                '&:hover': {
                  backgroundColor: activeCategory === cat.key
                    ? 'rgba(0, 255, 136, 0.18)'
                    : 'rgba(255,255,255,0.08)',
                },
              }}
            />
          ))}
        </Box>

        {/* Asset Cards */}
        {cardData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: '#666', fontSize: '16px' }}>
              No assets found matching your search.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {cardData.map((card) => (
              <Grid item xs={12} sm={6} md={4} key={card.id}>
                <SecondaryTradingCard
                  card={card}
                  isAuthenticated={isAuthenticated}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  )
}
