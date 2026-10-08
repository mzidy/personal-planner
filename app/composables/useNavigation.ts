import {
  Bot,
  BookOpen,
  GraduationCap,
  CalendarDays,
  ImageUp,
  StickyNote,
  Calculator,
  Compass,
  HeartPulse,
  ShoppingCart,
  CandlestickChart,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Repeat,
  Scale,
  Sprout,
  TrendingUp,
  Wallet,
  Target,
  Trophy
} from 'lucide-vue-next'

export function useNavigation() {
  return [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
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
        { label: 'Portfolio management', to: '/finance/portfolio', icon: Scale },
        { label: 'Investments', to: '/investments', icon: CandlestickChart, match: ['/investments'] },
        { label: 'Investment calculator', to: '/investments/calculator', icon: Calculator }
      ]
    },
    {
      label: 'Tasks',
      to: '/priorities',
      icon: Target,
      children: [
        { label: 'Overview', to: '/priorities', icon: Target },
        { label: 'Daily routine', to: '/priorities/routine', icon: Repeat }
      ]
    },
    {
      label: 'Goals',
      to: '/goals',
      icon: Trophy,
      children: [
        { label: 'Overview', to: '/goals', icon: Trophy },
        { label: 'Habit guide', to: '/goals/guide', icon: Compass }
      ]
    },
    {
      label: 'Personal stats',
      to: '/stats',
      icon: HeartPulse,
      children: [
        { label: 'Overview', to: '/stats', icon: HeartPulse },
        { label: 'Personal Growth', to: '/stats/growth', icon: Sprout }
      ]
    },
    { label: 'Shopping list', to: '/shopping', icon: ShoppingCart },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays },
    {
      label: 'Diary',
      to: '/diary',
      icon: BookOpen,
      children: [
        { label: 'Overview', to: '/diary', icon: BookOpen },
        { label: 'Notes', to: '/diary/notes', icon: StickyNote },
        { label: 'Import', to: '/diary/import', icon: ImageUp }
      ]
    },
    { label: 'AI Assistant', to: '/assistant', icon: Bot, accent: true },
    { label: 'AI Learning', to: '/learning', icon: GraduationCap, accent: true }
  ]
}
