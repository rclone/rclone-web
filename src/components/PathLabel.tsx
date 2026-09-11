import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/ui'

export function PathLabel({ value, className }: { value: string; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null)
    const [label, setLabel] = useState(value)

    useLayoutEffect(() => {
        const element = ref.current
        const context = document.createElement('canvas').getContext('2d')
        if (!element || !context) return

        const update = () => {
            const style = getComputedStyle(element)
            context.font = style.font
            const width = element.clientWidth
            const measure = (text: string) => context.measureText(text).width
            if (measure(value) <= width) {
                setLabel(value)
                return
            }

            const characters = Array.from(value)
            const ellipsis = '...'
            const filename = value.slice(
                Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'), value.lastIndexOf(':')) +
                    1
            )
            const suffixBudget =
                measure(ellipsis + filename) <= width
                    ? width - measure(ellipsis)
                    : Math.max(0, width * 0.8 - measure(ellipsis))
            let low = 0
            let high = characters.length
            while (low < high) {
                const middle = Math.ceil((low + high) / 2)
                if (measure(characters.slice(-middle).join('')) <= suffixBudget) low = middle
                else high = middle - 1
            }
            const suffixLength = Math.min(low, Array.from(filename).length || low)
            const suffix = suffixLength ? characters.slice(-suffixLength).join('') : ''
            low = 0
            high = characters.length - suffixLength
            while (low < high) {
                const middle = Math.ceil((low + high) / 2)
                if (measure(characters.slice(0, middle).join('') + ellipsis + suffix) <= width)
                    low = middle
                else high = middle - 1
            }
            setLabel(characters.slice(0, low).join('') + ellipsis + suffix)
        }

        update()
        const observer = new ResizeObserver(update)
        observer.observe(element)
        return () => observer.disconnect()
    }, [value])

    return (
        <span
            ref={ref}
            title={value}
            className={cn('block w-full min-w-0 overflow-hidden whitespace-nowrap', className)}
        >
            <span aria-hidden="true">{label || '—'}</span>
            <span className="sr-only">{value || '—'}</span>
        </span>
    )
}
