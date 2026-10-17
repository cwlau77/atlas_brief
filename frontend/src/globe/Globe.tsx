import { Suspense, lazy } from 'react'
import type { GlobeViewProps } from './GlobeView'
import { StaticGlobe } from './StaticGlobe'

// three.js and the land data live in this lazy chunk; pages without a globe never load them.
const GlobeView = lazy(() => import('./GlobeView'))

export function Globe(props: GlobeViewProps) {
  return (
    <Suspense fallback={<StaticGlobe label={props.label} />}>
      <GlobeView {...props} />
    </Suspense>
  )
}
