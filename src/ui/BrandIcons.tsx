import { forwardRef, type ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'

/* eslint-disable react-refresh/only-export-components -- this file is an icon asset module; the factory keeps the custom SVG family consistent. */

type GlyphProps = LucideProps & { children?: ReactNode }

function createGlyph(name: string, children: ReactNode) {
  const Glyph = forwardRef<SVGSVGElement, GlyphProps>(
    ({ color = 'currentColor', size = 24, strokeWidth = 1.75, className, ...props }, ref) => (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {children}
      </svg>
    ),
  )
  Glyph.displayName = name
  return Glyph
}

export const DashboardIcon = createGlyph('DashboardIcon', <>
  <rect x="3" y="3" width="7" height="7" rx="2" />
  <rect x="14" y="3" width="7" height="4" rx="2" />
  <rect x="14" y="11" width="7" height="10" rx="2" />
  <rect x="3" y="14" width="7" height="7" rx="2" />
</>)

export const SaleIcon = createGlyph('SaleIcon', <>
  <path d="M5 8.5h14v10A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5z" />
  <path d="M7 8.5 8.4 3h7.2L17 8.5M8.5 13h3M8.5 17h7" />
  <circle cx="15.8" cy="13" r="1.2" />
</>)

export const InventoryIcon = createGlyph('InventoryIcon', <>
  <path d="m4 7.5 8-4 8 4-8 4z" />
  <path d="M4 7.5v9l8 4 8-4v-9M12 11.5v9M8 5.5l8 4" />
</>)

export const WalletIcon = createGlyph('WalletIcon', <>
  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z" />
  <path d="M4 8h13M15 12h5v4h-5a2 2 0 0 1 0-4Z" />
</>)

export const ReportIcon = createGlyph('ReportIcon', <>
  <path d="M6 3h9l3 3v15H6zM15 3v4h4" />
  <path d="M9 16v-3M12 16V9M15 16v-5" />
</>)

export const CatalogIcon = createGlyph('CatalogIcon', <>
  <rect x="4" y="4" width="16" height="16" rx="3" />
  <path d="M8 8h8M8 12h5M8 16h7" />
  <circle cx="17" cy="12" r="1" fill="currentColor" stroke="none" />
</>)

export const CategoryIcon = createGlyph('CategoryIcon', <>
  <rect x="3" y="3" width="7" height="7" rx="2" />
  <rect x="14" y="3" width="7" height="7" rx="2" />
  <rect x="3" y="14" width="7" height="7" rx="2" />
  <path d="M17.5 14v7M14 17.5h7" />
</>)

export const SupplierIcon = createGlyph('SupplierIcon', <>
  <path d="M3 7h11v10H3zM14 11h4l3 3v3h-7z" />
  <circle cx="7" cy="18" r="2" />
  <circle cx="17.5" cy="18" r="2" />
</>)

export const CustomerIcon = createGlyph('CustomerIcon', <>
  <circle cx="9" cy="8" r="3.5" />
  <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
  <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
</>)

export const ExpenseIcon = createGlyph('ExpenseIcon', <>
  <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
  <path d="M9.5 10h5M9.5 14h3" />
</>)

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="9.2" fill="#0071E3" />
      <path d="M11 13.5h18M13.5 13.5v13h13v-13M17 26.5v-6h6v6" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m10.5 13.5 9.5-5 9.5 5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
