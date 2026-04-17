export default defineAppConfig({
  brand: {
    name: 'The Serene Executive',
    label: 'Digital concierge'
  },
  shell: {
    links: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Calendar', to: '/calendar' },
      { label: 'Finance', to: '/finance' },
      { label: 'Priorities', to: '/priorities' },
      { label: 'Diary', to: '/diary' },
      { label: 'Goals', to: '/goals' },
      { label: 'AI Assistant', to: '/assistant' }
    ]
  }
})
