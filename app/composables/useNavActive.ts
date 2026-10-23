export interface NavTarget {
  to: string
  /** Extra route prefixes this entry owns, for sections that live outside its own path. */
  match?: string[]
}

/** Which menu entry the current route belongs to; shared by every theme's menu. */
export function useNavActive() {
  const route = useRoute()

  function ownsRoute(path: string) {
    return route.path === path || route.path.startsWith(`${path}/`)
  }

  return {
    isParentActive(item: NavTarget) {
      return ownsRoute(item.to) || (item.match || []).some(ownsRoute)
    },
    isChildActive(child: NavTarget) {
      return child.match?.length ? child.match.some(ownsRoute) : route.path === child.to
    }
  }
}
