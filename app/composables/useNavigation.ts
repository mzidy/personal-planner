import {
  Bot,
  BookOpen,
  GraduationCap,
  CalendarDays,
  HeartPulse,
  ShoppingCart,
  CandlestickChart,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Repeat,
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
      // Investments lives at its own top-level route, so Finance has to claim it explicitly
      // for the sidebar to stay expanded and highlighted while you are in there.
      match: ['/investments'],
      children: [
        { label: 'Overview', to: '/finance', icon: Wallet },
        { label: 'Investing', to: '/finance/investing', icon: TrendingUp },
        { label: 'Income', to: '/finance/income', icon: Landmark },
        { label: 'Expenses', to: '/finance/expenses', icon: ReceiptText },
        { label: 'Investments', to: '/investments', icon: CandlestickChart, match: ['/investments'] }
      ]
    },
    { label: 'Priorities', to: '/priorities', icon: Target },
    { label: 'Diary', to: '/diary', icon: BookOpen },
    {
      label: 'Goals',
      to: '/goals',
      icon: Trophy,
      children: [
        { label: 'Overview', to: '/goals', icon: Trophy },
        { label: 'Daily routine', to: '/goals/routine', icon: Repeat }
      ]
    },
    { label: 'Personal stats', to: '/stats', icon: HeartPulse },
    { label: 'Shopping list', to: '/shopping', icon: ShoppingCart },
    { label: 'AI Assistant', to: '/assistant', icon: Bot, accent: true },
    { label: 'AI Learning', to: '/learning', icon: GraduationCap, accent: true }
  ]
}
