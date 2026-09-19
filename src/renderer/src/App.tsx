import type { PlatformId } from '@shared/types'
import React, { useState } from 'react'
import { PlatformSelectView } from './views/PlatformSelectView'
import { SplashUpdater } from './views/SplashUpdater'

export default function App(): React.JSX.Element {
  const [stage, setStage] = useState<'splash' | 'platforms'>('splash')

  if (stage === 'splash') {
    return <SplashUpdater onLaunchMainApp={() => setStage('platforms')} />
  }

  return (
    <PlatformSelectView
      onSelectPlatform={(platformId: PlatformId) => {
        console.log('Selected platform:', platformId)
      }}
    />
  )
}