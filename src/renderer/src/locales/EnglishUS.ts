export const EnglishUS = {
  _meta: {
    name: 'English (US)',
    countryCode: 'us',
    dir: 'ltr'
  },
  sidebar: {
    courses: 'My Courses',
    downloads: 'Downloads',
    settings: 'Settings',
    about: 'About',
    lightMode: '☀️ Light Mode',
    darkMode: '🌙 Dark Mode',
    logout: 'Logout'
  },
  helpModal: {
    locateToken: 'Locate your Token',
    followSteps: 'Follow these steps in your browser to securely link your account.',
    loginUdemy: 'Open your web browser and log in to your {{udemyBold}} account.',
    pressKey: 'Press {{f12Key}} (or right-click and select "Inspect") to open the Developer Tools.',
    navigateToApplication:
      'Navigate to the {{applicationStrong}} tab (Chrome/Edge) or {{storageBold}} tab (Firefox).',
    navigateKeys: {
      application: 'Application',
      storage: 'Storage'
    },
    cookies: {
      main: 'Expand {{cookiesStrong}} and click {{udemyURL}}. Find the row named {{tokenCode}}, copy its Value, and paste it below!',
      cookies: 'Cookies'
    },
    gotToken: "I've got my token"
  },
  libraryHealth: {
    title: 'Library Health & Integrity',
    scanning: 'Scanning Library...',
    runCheck: 'Run Integrity Check',
    verifyChecksums: 'Verifying Hash Checksums',
    healthy: 'Library is perfectly healthy! All checksums match.',
    corruptedFiles: '{{issuesLength}} Corrupted File(s) Detected',
    reason: 'Reason: {{reason}}',
    delete: 'Delete (Archived)',
    autoRepair: 'Auto-Repair'
  },
  pathAlert: {
    setupRequired: 'Setup Required',
    selectFolder:
      'You need to select a {{downloadFolder}} in the Settings menu before you can save course content to your computer.',
    downloadFolder: 'Download Folder',
    gotIt: 'Got it'
  },
  search: {
    noResults: 'No results found for "{{query}}"',
    titleMatches: 'Title Matches',
    transcriptMatches: 'Transcript Matches',
    customEngine: 'Custom Local Engine',
    closeKey: '{{esc}} to close'
  },
  update: {
    updateAvailable: 'Update Available',
    newVersion: 'Udeler Reborn {{version}} is ready!',
    download: 'Download',
    whatsNew: "What's New",
    devBuild: 'Developer Build',
    unreleasedVer: 'You are running an unreleased version.',
    goToRelease: 'Go to Release'
  },
  courses: {
    title: 'My Courses',
    selected: 'selected',
    selectedCount: '{{count}} selected',
    queueSelected: 'Queue Selected',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    searchPlaceholder: 'Search courses...',
    refresh: 'Refresh Courses',
    driveOffline: 'Drive Offline',
    viewContent: 'View Content',
    viewOffline: 'View (Offline)',
    noCourses: 'No courses found',
    adjustSearch: 'Try adjusting your search query.',
    savedToVolume: 'Saved to {{volumeName}}'
  },
  downloads: {
    title: 'Queue & Library',
    subtitle: 'Monitor active downloads and play saved media.',
    masterControls: 'Master Controls',
    masterSubtitle: 'Manage the background worker engine.',
    resume: 'Resume',
    pause: 'Pause',
    stopAll: 'Stop All',
    waiting: 'Waiting',
    inProgress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    drmLocked: 'DRM Locked',
    pendingQueue: 'Pending Tasks Queue',
    reorderSubtitle: 'Reorder download priority or cancel upcoming lectures.',
    library: 'Library',
    removeAll: 'Remove All',
    refreshDisk: 'Refresh Disk',
    scanning: 'Scanning local disk...',
    noFiles: 'No downloaded files found in your settings path.',
    playVideo: 'Play Video',
    readContent: 'Read Content',
    deleteAllWarning: 'You are about to permanently erase {{count}} files from your disk.'
  },
  globalDownloads: {
    active: 'Active Downloads',
    queued: '{{queueCount}} Queued',
    processing: 'Processing queue...',
    pause: 'Pause Queue',
    resume: 'Resume Queue',
    stopAll: 'Stop All'
  },
  settings: {
    title: 'Application Settings',
    downloadLocation: 'Download Location',
    browse: 'Browse...',
    downloadPreferences: 'Download Preferences',
    videoQuality: 'Video Quality',
    skipAttachments: 'Skip Course Attachments',
    skipSubtitles: 'Skip Subtitles / Closed Captions',
    autoRetry: 'Auto-Retry on Network Error',
    closeToTray: 'Keep running in background when closed',
    language: 'Application Language',
    vaultMode: 'Vault Mode (Encrypted Storage)',
    vaultModeDesc: 'Encrypts downloaded videos and auth tokens on disk using your OS Keychain.',
    saveAll: 'Save All Settings',
    savedSuccess: 'Settings Saved Successfully!'
  }
} as const

export default EnglishUS
