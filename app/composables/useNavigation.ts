import {
  Bot,
  BookOpen,
  GraduationCap,
  CalendarDays,
  HeartPulse,
  ShoppingCart,
  CandlestickChart,
  Layers,
  Sigma,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  TrendingUp,
  Wallet,
  Target,
  Trophy
} from 'lucide-vue-next'

export function useNavigation() {
  return [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays },
    {
      label: 'Finance',
      to: '/finance',
      icon: PiggyBank,
      children: [
        { label: 'Overview', to: '/finance', icon: Wallet },
        { label: 'Investing', to: '/finance/investing', icon: TrendingUp },
        { label: 'Income', to: '/finance/income', icon: Landmark },
        { label: 'Expenses', to: '/finance/expenses', icon: ReceiptText }
      ]
    },
    {
      label: 'Investments',
      to: '/investments',
      icon: CandlestickChart,
      children: [
        { label: 'ETF', to: '/investments/etf', icon: Layers },
        { label: 'Stocks', to: '/investments/stocks', icon: TrendingUp },
        { label: 'Options', to: '/investments/options', icon: Sigma }
      ]
    },
    { label: 'Priorities', to: '/priorities', icon: Target },
    { label: 'Diary', to: '/diary', icon: BookOpen },
    { label: 'Goals', to: '/goals', icon: Trophy },
    { label: 'Personal stats', to: '/stats', icon: HeartPulse },
    { label: 'Shopping list', to: '/shopping', icon: ShoppingCart },
    { label: 'AI Assistant', to: '/assistant', icon: Bot, accent: true },
    { label: 'AI Learning', to: '/learning', icon: GraduationCap, accent: true }
  ]
}
