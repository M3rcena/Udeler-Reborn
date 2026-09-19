export const EnglishUS = {
  _meta: {
    name: 'English (US)',
    countryCode: 'us',
    dir: 'ltr'
  },
  words: {
    localDrive: 'Local Drive',
    resume: 'Resume',
    pause: 'Pause',
    stopAll: 'Stop All',
    waiting: 'Waiting',
    inProgress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    drmLocked: 'DRM Locked',
    drmProtected: 'DRM Protected',
    library: 'Library',
    removeAll: 'Remove All',
    goBack: 'Go Back',
    offline: 'Offline',
    files: 'files',
    cancel: 'Cancel',
    new: 'New',
    quiz: 'Quiz',
    understood: 'Understood',
    unlimited: 'Unlimited',
    loading: 'Loading...',
    connected: 'Connected'
  },
  splash: {
    title: 'UDELER',
    subtitle: 'REBORN',
    tagline: 'Courses Hub',
    checking: 'Searching for updates...',
    available: 'Update {{version}} available!',
    upToDate: "You're up to date! Launching...",
    downloading: 'Downloading update v{{version}}...',
    verifying: 'Verifying package integrity...',
    ready: 'Update ready. Launching...',
    error: 'Update check bypassed. Starting app...',
    themes: {
      violet: 'Dark Violet',
      midnight: 'Midnight Slate',
      cyberpunk: 'Cyberpunk Neon',
      light: 'Light Frost'
    }
  },
  platforms: {
    chooseTitle: 'Who is learning?',
    chooseSubtitle:
      'Select a platform profile to open your library or connect a new educational service.',
    addPlatform: 'Add Platform',
    addPlatformModalTitle: 'Connect a Platform',
    addPlatformModalDesc: 'Select an educational provider to link with your local hub.',
    sessionActive: 'Active Session',
    removePlatform: 'Disconnect',
    tabBrowser: 'Browser Sign-in',
    tabToken: 'Manual Token',
    webLoginBtn: 'Open Login Browser',
    webLoginDesc:
      'Recommended: Opens an isolated session to authenticate directly on {{domain}}. Solves CAPTCHAs and SSO seamlessly.',
    manualTokenLabel: 'Security Token / Cookie',
    manualTokenPlaceholder: 'Paste your access_token or session cookie value...',
    howToToken: 'How to extract your token?',
    btnSubmitToken: 'Verify & Link Token',
    businessAccount: 'Enterprise / Business Account',
    subdomainPlaceholder: 'company-subdomain',
    validationError: 'Please provide a valid token or session value.'
  },
  components: {
    sidebar: {
      courses: 'My Courses',
      downloads: 'Downloads',
      settings: 'Settings',
      about: 'About',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      logout: 'Logout'
    }
  }
} as const

export default EnglishUS
