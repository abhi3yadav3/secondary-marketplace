'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  List,
  Typography,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material'
import {
  ArrowForward,
} from '@mui/icons-material'
import PortfolioSummaryCard from './PortfolioSummaryCard'
import InvestmentsSection from './InvestmentsSection'
import styles from './CashBalance.module.css'

interface Investment {
  id: string
  amount: number
  payment_status: string
}

export default function CashBalance() {
  const [cashAvailable, setCashAvailable] = useState(0)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [tradingBalance, setTradingBalance] = useState(0)
  const [holdingsValue, setHoldingsValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isPositionsExpanded, setIsPositionsExpanded] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [balRes, invRes, tradBalRes, holdRes] = await Promise.all([
          fetch('/api/banking/balance'),
          fetch('/api/investments'),
          fetch('/api/trading/balance'),
          fetch('/api/trading/holdings'),
        ])

        if (balRes.ok) {
          const data = await balRes.json()
          setCashAvailable(Number(data.balance) || 0)
        }
        if (invRes.ok) {
          const data = await invRes.json()
          setInvestments(data.investments || [])
        }
        if (tradBalRes.ok) {
          const data = await tradBalRes.json()
          setTradingBalance(Number(data.cashBalance) || 0)
        }
        if (holdRes.ok) {
          const data = await holdRes.json()
          const total = (data.holdings || []).reduce((sum: number, h: any) => sum + (h.marketValue || 0), 0)
          setHoldingsValue(total)
        }
      } catch (error) {
        console.error('Error fetching portfolio data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const oldInvestedAmount = investments
    .filter((inv) => inv.payment_status === 'COMPLETED')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const investedAmount = oldInvestedAmount + holdingsValue
  const portfolioValue = cashAvailable + tradingBalance + investedAmount

  return (
    <Box className={styles.content}>
      {/* Portfolio Summary Section */}
      <PortfolioSummaryCard
        totalValue={portfolioValue}
        cashAvailable={cashAvailable}
        investedAmount={investedAmount}
        onInvestedClick={() => setIsPositionsExpanded(!isPositionsExpanded)}
      />

      {/* Old investments section — hidden when empty; trading holdings are shown in Portfolio.tsx */}
      {investments.length > 0 && (
        <InvestmentsSection
          isPositionsExpanded={isPositionsExpanded}
          onTogglePositions={() => setIsPositionsExpanded(!isPositionsExpanded)}
        />
      )}
    </Box>
  )
}
