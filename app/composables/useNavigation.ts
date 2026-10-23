import {
  ArrowLeftRight,
  Bot,
  BookOpen,
  GraduationCap,
  Headphones,
  CalendarDays,
  ImageUp,
  StickyNote,
  Calculator,
  Compass,
  HeartPulse,
  House,
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

/**
 * Hidden in basic view: the finance detail beyond Overview and Investing, plus
 * Goals, Personal stats, Shopping list and Calendar. Matched on route, since a
 * label can be renamed without anyone thinking to update this.
 */
const BASIC_HIDDEN_ROUTES = new Set([
  '/finance/income',
  '/finance/expenses',
  '/finance/portfolio',
  '/finance/trades',
  '/investments',
  '/goals',
  '/stats',
  '/shopping',
  '/calendar'
])

export function useNavigation() {
  const { isBasic } = useViewMode()

  const all = [
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
        { label: 'Active trades', to: '/finance/trades', icon: ArrowLeftRight },
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
    { label: 'Smart Home', to: '/smart-home', icon: House },
    { label: 'AI Assistant', to: '/assistant', icon: Bot, accent: true },
    {
      label: 'AI Learning',
      to: '/learning',
      icon: GraduationCap,
      accent: true,
      children: [
        { label: 'Notebook', to: '/learning', icon: GraduationCap },
        { label: 'Claudemy', to: '/learning/claudemy', icon: Headphones, match: ['/learning/claudemy'] }
      ]
    }
  ]

  return computed(() => {
    if (!isBasic.value) {
      return all
    }

    return all
      .filter(item => !BASIC_HIDDEN_ROUTES.has(item.to))
      .map(item => {
        if (!item.children) {
          return item
        }
        const children = item.children.filter(child => !BASIC_HIDDEN_ROUTES.has(child.to))
        // A parent left with only its own Overview no longer needs a submenu.
        return children.length > 1 ? { ...item, children } : { ...item, children: undefined }
      })
  })
}
