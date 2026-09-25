import type { PlatformId } from '@shared/types'
import React, { useState } from 'react'
import { PlatformSelectView } from './views/PlatformSelectView'
import { SplashUpdater } from './views/SplashUpdater'

export default function App(): React.JSX.Element {
  const isMainView = new URLSearchParams(window.location.search).get('view') === 'main'
  const [stage] = useState<'splash' | 'platforms'>(isMainView ? 'platforms' : 'splash')

  if (stage === 'splash') {
    return (
      <SplashUpdater
        onLaunchMainApp={() => {
          window.api?.resizeToMain?.()
        }}
      />
    )
  }

  return (
    <PlatformSelectView
      onSelectPlatform={(platformId: PlatformId) => {
        console.log('Selected platform:', platformId)
      }}
    />
  )
}