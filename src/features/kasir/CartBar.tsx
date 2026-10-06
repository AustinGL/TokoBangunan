import { ShoppingCart } from 'lucide-react'
import { Icon } from '../../ui/Icon'
import { NumberTicker } from '../../ui/NumberTicker'
import { formatRupiah, rupiah } from '../../domain/money'

type Props = {
  count: number
  total: number
  onOpen: () => void
}

/**
 * Phone only. The cart itself lives in a bottom sheet, so without this the
 * only sign that a tap on "+" worked would be a cart hundreds of pixels down
 * the page. The bar answers the tap at once ("2 barang, Rp 130.000") and is
 * the one big target that opens the cart. It rises in on a bouncy spring and
 * sits above the bottom nav and its centre action.
 */
export function CartBar({ count, total, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rise-in fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-nav flex min-h-control items-center justify-between gap-3 rounded-pill bg-primary py-1 pl-5 pr-5 text-ink-on-primary shadow-float transition-[transform,background-color] duration-quick ease-spring hover:bg-primary-hover active:scale-[0.98]"
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Icon icon={ShoppingCart} size="button" />
        {count} barang
      </span>
      <span className="flex items-center gap-2 text-sm">
        <NumberTicker value={total} className="font-bold">{formatRupiah(rupiah(total))}</NumberTicker>
        <span className="font-medium opacity-90">Lihat keranjang</span>
      </span>
    </button>
  )
}
