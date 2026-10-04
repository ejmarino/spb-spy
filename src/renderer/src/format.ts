import type { SpProperty, SpValue } from '@shared/types'

const ARRAY_PREVIEW = 8

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return String(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatTime(ms)}`
}

/** Solo la hora si es de hoy; con fecha si es de otro dia */
export function formatTimestamp(ms: number | undefined, now: number): string {
  if (ms === undefined) return ''
  const sameDay = new Date(ms).toDateString() === new Date(now).toDateString()
  return sameDay ? formatTime(ms) : formatDateTime(ms)
}

function formatScalar(type: string, value: SpValue): string {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    if (type.startsWith('DateTime')) return formatDateTime(value)
    // un float de 32 bits no tiene mas de 7 digitos significativos
    if (type.startsWith('Float')) return String(Number(value.toPrecision(7)))
    return String(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

interface Shape {
  bytes?: SpValue
  hex?: SpValue
  columns?: SpValue
  rows?: SpValue
  templateRef?: SpValue
  isDefinition?: SpValue
  metrics?: SpValue
}

export function formatValue(type: string, value: SpValue): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    const shown = value.slice(0, ARRAY_PREVIEW).map((item) => formatScalar(type, item))
    const more = value.length > ARRAY_PREVIEW ? ', …' : ''
    return `[${shown.join(', ')}${more}] (${value.length})`
  }
  if (typeof value === 'object') {
    const shape = value as Shape
    if (typeof shape.bytes === 'number') {
      const hex = String(shape.hex ?? '')
        .replace(/(..)/g, '$1 ')
        .trim()
      return `${shape.bytes} bytes${hex ? ` · ${hex}${shape.bytes * 2 > String(shape.hex).length ? ' …' : ''}` : ''}`
    }
    if (Array.isArray(shape.columns) && Array.isArray(shape.rows)) {
      return `DataSet · ${shape.columns.length} columnas × ${shape.rows.length} filas`
    }
    if (Array.isArray(shape.metrics)) {
      const what = shape.isDefinition
        ? 'Definición de UDT'
        : `UDT${shape.templateRef ? ` ${String(shape.templateRef)}` : ''}`
      return `${what} · ${plural(shape.metrics.length, 'miembro')}`
    }
  }
  return formatScalar(type, value)
}

/** Unidad de ingenieria declarada en las propiedades de la metrica */
export function engUnit(properties: Record<string, SpProperty> | undefined): string {
  const unit = properties?.engUnit?.value
  return typeof unit === 'string' ? unit : ''
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
