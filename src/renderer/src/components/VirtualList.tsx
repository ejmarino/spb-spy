import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from 'react'

interface VirtualListProps<T> {
  items: T[]
  rowHeight: number
  render: (item: T, index: number) => ReactNode
  className?: string
  /** Mantiene la vista pegada al final mientras se agregan filas */
  follow?: boolean
  onFollowChange?: (follow: boolean) => void
}

const OVERSCAN = 8

/** Lista de filas de alto fijo que solo monta las que estan a la vista */
export function VirtualList<T>({
  items,
  rowHeight,
  render,
  className,
  follow = false,
  onFollowChange
}: VirtualListProps<T>): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const element = container.current
    if (follow && element) element.scrollTop = element.scrollHeight
  }, [follow, items, height])

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    const element = event.currentTarget
    setScrollTop(element.scrollTop)
    if (!onFollowChange) return
    const atEnd = element.scrollHeight - element.scrollTop - element.clientHeight < rowHeight * 1.5
    if (atEnd !== follow) onFollowChange(atEnd)
  }

  const total = items.length * rowHeight
  // siguiendo el final se calcula desde abajo, sin esperar al evento de scroll
  const top = follow
    ? Math.max(0, total - height)
    : Math.min(scrollTop, Math.max(0, total - height))
  const start = Math.max(0, Math.floor(top / rowHeight) - OVERSCAN)
  const end = Math.min(items.length, Math.ceil((top + height) / rowHeight) + OVERSCAN)

  return (
    <div ref={container} className={className} onScroll={onScroll}>
      <div style={{ height: total, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {items.slice(start, end).map((item, i) => render(item, start + i))}
        </div>
      </div>
    </div>
  )
}
