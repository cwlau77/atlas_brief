// Faceted icon set in the G5 mark's folded-paper language: two or three flat
// planes in currentColor at stepped opacities, on a 24px grid. No strokes.
import type { ReactNode } from 'react'

export interface IconProps {
  size?: number
  className?: string
}

// Plane opacities, light to full, echoing the mark's three folds.
const FULL = 1
const MID = 0.7
const LIGHT = 0.45

function Svg({ size, className, children }: { size: number; className?: string; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

function F({ points, o = FULL }: { points: string; o?: number }) {
  return <polygon points={points} fill="currentColor" fillOpacity={o} />
}

export function StarIcon({ size = 18, className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg size={size} className={className}>
      <F points="12,3 9.4,8.6 3.4,9.3 7.8,13.5 6.6,19.5 12,16.6" o={filled ? FULL : 0.3} />
      <F points="12,3 14.6,8.6 20.6,9.3 16.2,13.5 17.4,19.5 12,16.6" o={filled ? MID : 0.18} />
    </Svg>
  )
}

export function ExternalIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="4,7 11,7 11,9 6,9 6,18 15,18 15,13 17,13 17,20 4,20" o={MID} />
      <F points="13,4 20,4 20,11" />
      <F points="18.6,4.4 19.6,5.4 11.7,13.3 10.7,12.3" />
    </Svg>
  )
}

export function TrashIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="9.5,3.5 14.5,3.5 14.5,6 9.5,6" o={LIGHT} />
      <F points="4,6 20,6 20,7.6 4,7.6" />
      <F points="6,9 12,9 12,21 7.2,21" />
      <F points="12,9 18,9 16.8,21 12,21" o={MID} />
    </Svg>
  )
}

export function PrintIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="7,3 17,3 17,8 7,8" o={LIGHT} />
      <F points="3.5,9 20.5,9 20.5,17 17,17 17,14 7,14 7,17 3.5,17" />
      <F points="7,15 17,15 17,21 7,21" o={MID} />
    </Svg>
  )
}

/** Stroked plus for buttons; deliberately outside the faceted ICONS set. Spins via .btn-plus. */
export function PlusIcon({ size = 14, className = 'btn-plus' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} aria-hidden="true" focusable="false">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export function ExpandIcon({ size = 14, className, open = false }: IconProps & { open?: boolean }) {
  return (
    <Svg size={size} className={className}>
      <g transform={open ? 'rotate(180 12 12)' : undefined}>
        <F points="4.5,8.5 6.5,6.8 12,12.2 12,15" />
        <F points="12,12.2 17.5,6.8 19.5,8.5 12,15" o={MID} />
      </g>
    </Svg>
  )
}

export function TensionIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="3,12 10,6 10,18" />
      <F points="21,12 14,6 14,18" o={MID} />
      <F points="10,11 14,11 14,13 10,13" o={LIGHT} />
    </Svg>
  )
}

export function DisagreeIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="3,4 13,4 13,12 7,12 4,15 4,12 3,12" />
      <F points="11,9 21,9 21,17 20,17 20,20 17,17 11,17" o={MID} />
    </Svg>
  )
}

export function AlertCriticalIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="12,3 12,21 2.5,21" />
      <F points="12,3 21.5,21 12,21" o={MID} />
    </Svg>
  )
}

export function AlertHighIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="12,4 12,20 4,12" />
      <F points="12,4 20,12 12,20" o={MID} />
    </Svg>
  )
}

export function AlertElevatedIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="6,8 12,6 12,18 6,16" o={MID} />
      <F points="12,6 18,8 18,16 12,18" o={LIGHT} />
    </Svg>
  )
}

export function ProfileIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="12,3 8.5,5 8.5,9.5 12,11.5" />
      <F points="12,3 15.5,5 15.5,9.5 12,11.5" o={MID} />
      <F points="4,21 6,15 12,13 12,21" o={MID} />
      <F points="12,13 18,15 20,21 12,21" o={LIGHT} />
    </Svg>
  )
}

export function TimeIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="12,3 8.3,3 3,8.3 3,15.7 8.3,21 12,21" o={LIGHT} />
      <F points="12,3 15.7,3 21,8.3 21,15.7 15.7,21 12,21" o={0.6} />
      <F points="11.2,6 12.8,6 12.8,12.8 11.2,12.8" />
      <F points="11.2,11.2 16.5,14.3 15.8,15.6 11.2,12.8" />
    </Svg>
  )
}

export function ReadingIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="2.5,6 11.3,7.5 11.3,20 2.5,18.5" />
      <F points="12.7,7.5 21.5,6 21.5,18.5 12.7,20" o={MID} />
    </Svg>
  )
}

export function DataIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="4,4 20,4 20,8.5 4,8.5" />
      <F points="4,10 20,10 20,14.5 4,14.5" o={MID} />
      <F points="4,16 20,16 20,20.5 4,20.5" o={LIGHT} />
    </Svg>
  )
}

export function ExportIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="3,14 5,14 5,19 19,19 19,14 21,14 21,21 3,21" o={MID} />
      <F points="12,3 18,9.5 6,9.5" />
      <F points="11,9 13,9 13,16 11,16" />
    </Svg>
  )
}

export function ClearIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <F points="3.5,15.5 11,8 16,13 8.5,20.5" o={MID} />
      <F points="11,8 14.5,4.5 19.5,9.5 16,13" />
      <F points="8.5,20.5 20.5,20.5 20.5,22 8.5,22" o={LIGHT} />
    </Svg>
  )
}

export const ICONS: Record<string, (p: IconProps) => ReactNode> = {
  StarIcon, ExternalIcon, TrashIcon, PrintIcon, ExpandIcon, TensionIcon, DisagreeIcon,
  AlertCriticalIcon, AlertHighIcon, AlertElevatedIcon, ProfileIcon, TimeIcon, ReadingIcon, DataIcon,
  ExportIcon, ClearIcon,
}
