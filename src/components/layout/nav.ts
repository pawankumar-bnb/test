import {
  Camera,
  Dumbbell,
  FileText,
  HeartPulse,
  LayoutDashboard,
  PersonStanding,
  Settings,
  Target,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  short?: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/fitness', label: 'Fitness Workout', short: 'Workout', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/fitness-test', label: 'Fitness Test', icon: HeartPulse },
  { to: '/physique', label: 'Physique', icon: PersonStanding },
  { to: '/instagram', label: 'Instagram', icon: Camera },
  { to: '/report', label: 'Weekly Report', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** The four destinations used daily; everything else sits behind More on phones. */
export const PRIMARY_MOBILE = NAV_ITEMS.slice(0, 4)
export const SECONDARY_MOBILE = NAV_ITEMS.slice(4)
