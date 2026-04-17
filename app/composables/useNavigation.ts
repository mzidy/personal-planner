import {
  Bot,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  PiggyBank,
  Target,
  Trophy
} from 'lucide-vue-next'

export function useNavigation() {
  return [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays },
    { label: 'Finance', to: '/finance', icon: PiggyBank },
    { label: 'Priorities', to: '/priorities', icon: Target },
    { label: 'Diary', to: '/diary', icon: BookOpen },
    { label: 'Goals', to: '/goals', icon: Trophy },
    { label: 'AI Assistant', to: '/assistant', icon: Bot, accent: true }
  ]
}
