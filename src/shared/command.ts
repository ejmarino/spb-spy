import type { SpProperty, SpValue } from './types'

/** Rango de cada tipo entero. Un DateTime viaja como los milisegundos desde 1970 */
const INTEGER_RANGES: Record<string, [bigint, bigint]> = {
  Int8: [-(2n ** 7n), 2n ** 7n - 1n],
  Int16: [-(2n ** 15n), 2n ** 15n - 1n],
  Int32: [-(2n ** 31n), 2n ** 31n - 1n],
  Int64: [-(2n ** 63n), 2n ** 63n - 1n],
  UInt8: [0n, 2n ** 8n - 1n],
  UInt16: [0n, 2n ** 16n - 1n],
  UInt32: [0n, 2n ** 32n - 1n],
  UInt64: [0n, 2n ** 64n - 1n],
  DateTime: [0n, 2n ** 64n - 1n]
}

const ARRAY_ELEMENTS = new Set([
  ...Object.keys(INTEGER_RANGES),
  'Float',
  'Double',
  'Boolean',
  'String'
])
const TEXT_TYPES = new Set(['String', 'Text', 'UUID'])

const INTEGER = /^[+-]?\d+$/
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i
const NOT_A_NUMBER = /^[+-]?nan$/i
const INFINITE = /^([+-]?)inf(inity)?$/i
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function isArrayType(type: string): boolean {
  return type.endsWith('Array')
}

/** Tipo de cada elemento de un array; para un escalar, el mismo tipo */
export function elementType(type: string): string {
  return isArrayType(type) ? type.slice(0, -'Array'.length) : type
}

/** Rango de un tipo entero, o de los elementos de un array de enteros */
export function integerRange(type: string): [bigint, bigint] | undefined {
  return INTEGER_RANGES[elementType(type)]
}

/** Tipos cuyo valor se puede mandar en un comando: los escalares y los arrays */
export function isWritableType(type: string): boolean {
  const element = elementType(type)
  return ARRAY_ELEMENTS.has(element) || (TEXT_TYPES.has(element) && !isArrayType(type))
}

/**
 * Sparkplug no define como declarar que una metrica es de solo lectura: se
 * reconocen las propiedades con las que los nodos suelen avisarlo (readOnly en
 * true, como publica Ignition, o writable en false).
 */
export function isReadOnly(properties: Record<string, SpProperty> | undefined): boolean {
  for (const [key, property] of Object.entries(properties ?? {})) {
    const name = key.toLowerCase().replace(/[_\s]/g, '')
    if (name === 'readonly' && property.value === true) return true
    if ((name === 'writable' || name === 'writeable') && property.value === false) return true
  }
  return false
}

function elementError(type: string, value: SpValue): string | null {
  const range = INTEGER_RANGES[type]
  if (range) {
    // los enteros que no entran en un number viajan como texto
    const isInteger =
      typeof value === 'number'
        ? Number.isInteger(value)
        : typeof value === 'string' && INTEGER.test(value)
    if (!isInteger) return 'tiene que ser un número entero'
    const big = BigInt(value as number | string)
    return big < range[0] || big > range[1]
      ? `está fuera del rango de ${type} (${range[0]} a ${range[1]})`
      : null
  }
  switch (type) {
    case 'Float':
    case 'Double':
      if (typeof value !== 'number') return 'tiene que ser un número'
      // NaN e Infinity se pueden enviar; lo que no sirve es un numero que desborda el Float
      return type === 'Float' && Number.isFinite(value) && !Number.isFinite(Math.fround(value))
        ? 'está fuera del rango de Float'
        : null
    case 'Boolean':
      return typeof value === 'boolean' ? null : 'tiene que ser true o false'
    default:
      return typeof value === 'string' ? null : 'tiene que ser un texto'
  }
}

/** Motivo por el que un valor no se puede enviar con ese tipo de dato, o null si sirve */
export function valueError(type: string, value: SpValue): string | null {
  if (!isWritableType(type)) return `No se pueden enviar valores de tipo ${type}`
  if (!isArrayType(type)) {
    const error = elementError(type, value)
    return error && `El valor ${error}`
  }
  if (!Array.isArray(value)) return 'El valor tiene que ser una lista'
  const element = elementType(type)
  for (let i = 0; i < value.length; i++) {
    const error = elementError(element, value[i])
    if (error) return `El elemento ${i + 1} ${error}`
  }
  return null
}

export type ParsedValue = { value: SpValue; error?: undefined } | { error: string }

/** Interpreta lo que se escribio para un valor suelto o para un elemento de un array */
function parseElement(type: string, text: string): ParsedValue {
  let value: SpValue = text
  if (INTEGER_RANGES[type]) {
    if (INTEGER.test(text)) {
      const big = BigInt(text)
      const number = Number(big)
      value = Number.isSafeInteger(number) ? number : big.toString()
    } else if (type === 'DateTime') {
      // una fecha sin hora se toma, como las demas, en hora local
      value = Date.parse(DATE_ONLY.test(text) ? `${text}T00:00` : text)
      if (Number.isNaN(value)) {
        return {
          error: 'tiene que ser una fecha (AAAA-MM-DD HH:MM:SS) o los milisegundos desde 1970'
        }
      }
    } else {
      return { error: 'tiene que ser un número entero' }
    }
  } else if (type === 'Float' || type === 'Double') {
    const infinite = INFINITE.exec(text)
    if (NOT_A_NUMBER.test(text)) {
      value = NaN
    } else if (infinite) {
      value = infinite[1] === '-' ? -Infinity : Infinity
    } else if (DECIMAL.test(text)) {
      value = Number(text)
      // escrito con digitos y aun asi infinito: no entra en un Double
      if (!Number.isFinite(value)) return { error: `está fuera del rango de ${type}` }
    } else {
      return { error: 'tiene que ser un número (con punto decimal), NaN o Infinity' }
    }
  } else if (type === 'Boolean') {
    const word = text.toLowerCase()
    if (word === 'true' || word === '1') value = true
    else if (word === 'false' || word === '0') value = false
  }
  const error = elementError(type, value)
  return error ? { error } : { value }
}

function splitElements(type: string, text: string): string[] {
  if (type === 'StringArray') {
    // un texto por linea; el salto de linea del final no agrega un elemento vacio
    return text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/)
  }
  // se aceptan los corchetes de la notacion [1, 2, 3]
  const inner = text.trim().replace(/^\[([\s\S]*)\]$/, '$1')
  // las fechas llevan un espacio entre el dia y la hora: no sirve para separarlas
  const separator = type === 'DateTimeArray' ? /[,;\n]+/ : /[\s,;]+/
  return inner
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Convierte el texto que escribio el usuario en el valor a enviar para ese tipo de dato */
export function parseCommandValue(type: string, text: string): ParsedValue {
  if (!isWritableType(type)) return { error: `No se pueden enviar valores de tipo ${type}` }
  if (!isArrayType(type)) {
    // en un texto los espacios son parte del valor
    const entered = TEXT_TYPES.has(type) ? text : text.trim()
    if (entered === '' && !TEXT_TYPES.has(type)) return { error: 'Falta el valor' }
    const parsed = parseElement(type, entered)
    return parsed.error === undefined ? parsed : { error: `El valor ${parsed.error}` }
  }
  const element = elementType(type)
  const values: SpValue[] = []
  for (const part of splitElements(type, text)) {
    const parsed = parseElement(element, part)
    if (parsed.error !== undefined) {
      return { error: `El elemento ${values.length + 1} (${part}) ${parsed.error}` }
    }
    values.push(parsed.value)
  }
  return { value: values }
}
