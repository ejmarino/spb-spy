import type Long from 'long'
import { org } from 'sparkplug-payload/lib/sparkplugPayloadProto'
import { asTemplate } from '@shared/template'
import type { SpProperty, SpValue } from '@shared/types'

// Se decodifica directo sobre el protobuf generado: el decodificador de alto
// nivel de sparkplug-payload falla con DataSets de enteros y no conoce los
// tipos de array de Sparkplug 3.0.
export const Payload = org.eclipse.tahu.protobuf.Payload

export type PMetric = org.eclipse.tahu.protobuf.Payload.IMetric
type PPropertySet = org.eclipse.tahu.protobuf.Payload.IPropertySet
type PPropertyValue = org.eclipse.tahu.protobuf.Payload.IPropertyValue
type PDataSet = org.eclipse.tahu.protobuf.Payload.IDataSet
type PTemplate = org.eclipse.tahu.protobuf.Payload.ITemplate

const DATA_TYPES = [
  'Unknown',
  'Int8',
  'Int16',
  'Int32',
  'Int64',
  'UInt8',
  'UInt16',
  'UInt32',
  'UInt64',
  'Float',
  'Double',
  'Boolean',
  'String',
  'DateTime',
  'Text',
  'UUID',
  'DataSet',
  'Bytes',
  'File',
  'Template',
  'PropertySet',
  'PropertySetList',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Int64Array',
  'UInt8Array',
  'UInt16Array',
  'UInt32Array',
  'UInt64Array',
  'FloatArray',
  'DoubleArray',
  'BooleanArray',
  'StringArray',
  'DateTimeArray'
]

const INT8 = 1
const INT16 = 2
const INT32 = 3
const INT64 = 4
const BOOLEAN = 11
const FIRST_ARRAY = 22
const BYTES_PREVIEW = 64

export function typeName(datatype: number): string {
  return DATA_TYPES[datatype] ?? `Tipo ${datatype}`
}

export function typeCode(name: string): number {
  const code = DATA_TYPES.indexOf(name)
  return code > 0 ? code : 0
}

export function has(object: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field)
}

/** Los enteros de 64 bits pasan a number si entran sin perder precision; si no, a string */
export function longValue(
  value: number | Long | null | undefined,
  signed = false
): number | string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const long = signed ? value.toSigned() : value.toUnsigned()
  const number = long.toNumber()
  return Number.isSafeInteger(number) ? number : long.toString()
}

function bigValue(value: bigint): number | string {
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : value.toString()
}

function isSigned(datatype: number): boolean {
  return datatype >= INT8 && datatype <= INT64
}

/** Los Int8/16/32 viajan como uint32 en complemento a dos */
function intValue(value: number, datatype: number): number {
  switch (datatype) {
    case INT8:
      return (value << 24) >> 24
    case INT16:
      return (value << 16) >> 16
    case INT32:
      return value | 0
    default:
      return value >>> 0
  }
}

function decodeArray(bytes: Uint8Array, datatype: number): SpValue {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: SpValue[] = []
  const each = (size: number, read: (offset: number) => SpValue): void => {
    for (let offset = 0; offset + size <= buf.length; offset += size) out.push(read(offset))
  }
  switch (typeName(datatype)) {
    case 'Int8Array':
      each(1, (o) => buf.readInt8(o))
      break
    case 'Int16Array':
      each(2, (o) => buf.readInt16LE(o))
      break
    case 'Int32Array':
      each(4, (o) => buf.readInt32LE(o))
      break
    case 'Int64Array':
      each(8, (o) => bigValue(buf.readBigInt64LE(o)))
      break
    case 'UInt8Array':
      each(1, (o) => buf.readUInt8(o))
      break
    case 'UInt16Array':
      each(2, (o) => buf.readUInt16LE(o))
      break
    case 'UInt32Array':
      each(4, (o) => buf.readUInt32LE(o))
      break
    case 'UInt64Array':
    case 'DateTimeArray':
      each(8, (o) => bigValue(buf.readBigUInt64LE(o)))
      break
    case 'FloatArray':
      each(4, (o) => buf.readFloatLE(o))
      break
    case 'DoubleArray':
      each(8, (o) => buf.readDoubleLE(o))
      break
    case 'BooleanArray': {
      // 4 bytes con la cantidad de valores y despues los bits, el mas significativo primero
      if (buf.length < 4) break
      const count = buf.readUInt32LE(0)
      for (let i = 0; i < count && 4 + (i >> 3) < buf.length; i++) {
        out.push(((buf[4 + (i >> 3)] >> (7 - (i & 7))) & 1) === 1)
      }
      break
    }
    case 'StringArray': {
      // strings UTF-8 terminados en null
      let start = 0
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== 0) continue
        out.push(buf.toString('utf8', start, i))
        start = i + 1
      }
      break
    }
    default:
      return bytesPreview(bytes)
  }
  return out
}

function bytesPreview(bytes: Uint8Array): SpValue {
  const shown = bytes.subarray(0, BYTES_PREVIEW)
  return {
    bytes: bytes.length,
    hex: Buffer.from(shown.buffer, shown.byteOffset, shown.byteLength).toString('hex')
  }
}

interface ScalarFields {
  intValue?: number | null
  longValue?: number | Long | null
  floatValue?: number | null
  doubleValue?: number | null
  booleanValue?: boolean | null
  stringValue?: string | null
}

function scalarValue(object: ScalarFields, datatype: number): SpValue | undefined {
  if (has(object, 'intValue')) return intValue(object.intValue ?? 0, datatype)
  if (has(object, 'longValue')) return longValue(object.longValue, isSigned(datatype))
  if (has(object, 'floatValue')) return object.floatValue ?? null
  if (has(object, 'doubleValue')) return object.doubleValue ?? null
  if (has(object, 'booleanValue')) return object.booleanValue ?? null
  if (has(object, 'stringValue')) return object.stringValue ?? null
  return undefined
}

function decodeDataSet(dataSet: PDataSet): SpValue {
  const types = dataSet.types ?? []
  return {
    columns: dataSet.columns ?? [],
    types: types.map(typeName),
    rows: (dataSet.rows ?? []).map((row) =>
      (row.elements ?? []).map((element, i) => scalarValue(element, types[i] ?? 0) ?? null)
    )
  }
}

/**
 * known es el valor que ya se conocia de este UDT: en un DATA los miembros pueden
 * venir sin datatype (vale el del BIRTH) o identificados solo por su alias.
 */
function decodeTemplate(template: PTemplate, known: SpValue | undefined): SpValue {
  const knownMembers = (known === undefined ? null : asTemplate('Template', known))?.metrics ?? []
  const out: { [key: string]: SpValue } = {}
  if (template.templateRef) out.templateRef = template.templateRef
  if (template.version) out.version = template.version
  if (template.isDefinition) out.isDefinition = true
  if (template.parameters?.length) {
    out.parameters = template.parameters.map((parameter) => ({
      name: parameter.name ?? '',
      type: typeName(parameter.type ?? 0),
      value: scalarValue(parameter, parameter.type ?? 0) ?? null
    }))
  }
  out.metrics = (template.metrics ?? []).map((metric) => {
    const alias = has(metric, 'alias') ? String(longValue(metric.alias)) : undefined
    const before = metric.name
      ? knownMembers.find((member) => member.name === metric.name)
      : knownMembers.find((member) => alias !== undefined && member.alias === alias)
    const datatype = metric.datatype || typeCode(before?.type ?? '') || inferDatatype(metric)
    const member: { [key: string]: SpValue } = {
      name: metric.name || before?.name || (alias === undefined ? '' : `alias:${alias}`),
      type: typeName(datatype),
      value: decodeMetricValue(metric, datatype, before?.value)
    }
    if (alias !== undefined) member.alias = alias
    if (has(metric, 'timestamp')) member.timestamp = Number(longValue(metric.timestamp))
    if (metric.isNull) member.isNull = true
    const properties = decodeProperties(metric.properties)
    if (properties) member.properties = properties as unknown as SpValue
    return member
  })
  return out
}

function decodePropertyValue(value: PPropertyValue): SpProperty {
  const datatype = value.type ?? 0
  let decoded: SpValue = null
  if (!value.isNull) {
    if (value.propertysetValue) {
      decoded = propertySetValue(value.propertysetValue)
    } else if (value.propertysetsValue) {
      decoded = (value.propertysetsValue.propertyset ?? []).map(propertySetValue)
    } else {
      decoded = scalarValue(value, datatype) ?? null
    }
  }
  return { type: typeName(datatype), value: decoded }
}

function propertySetValue(set: PPropertySet): SpValue {
  const out: { [key: string]: SpValue } = {}
  for (const [key, property] of Object.entries(decodeProperties(set) ?? {})) {
    out[key] = property.value
  }
  return out
}

export function decodeProperties(
  set: PPropertySet | null | undefined
): Record<string, SpProperty> | undefined {
  const keys = set?.keys ?? []
  const values = set?.values ?? []
  if (!keys.length) return undefined
  const out: Record<string, SpProperty> = {}
  keys.forEach((key, i) => {
    if (values[i]) out[key] = decodePropertyValue(values[i])
  })
  return out
}

/** Cuando el mensaje no trae datatype (ni hay BIRTH) se deduce del campo que vino con valor */
export function inferDatatype(metric: PMetric): number {
  if (has(metric, 'intValue')) return typeCode('UInt32')
  if (has(metric, 'longValue')) return typeCode('UInt64')
  if (has(metric, 'floatValue')) return typeCode('Float')
  if (has(metric, 'doubleValue')) return typeCode('Double')
  if (has(metric, 'booleanValue')) return BOOLEAN
  if (has(metric, 'stringValue')) return typeCode('String')
  if (has(metric, 'bytesValue')) return typeCode('Bytes')
  if (metric.datasetValue) return typeCode('DataSet')
  if (metric.templateValue) return typeCode('Template')
  return 0
}

export function decodeMetricValue(metric: PMetric, datatype: number, known?: SpValue): SpValue {
  if (metric.isNull) return null
  const scalar = scalarValue(metric, datatype)
  if (scalar !== undefined) return scalar
  if (has(metric, 'bytesValue') && metric.bytesValue) {
    return datatype >= FIRST_ARRAY
      ? decodeArray(metric.bytesValue, datatype)
      : bytesPreview(metric.bytesValue)
  }
  if (metric.datasetValue) return decodeDataSet(metric.datasetValue)
  if (metric.templateValue) return decodeTemplate(metric.templateValue, known)
  return null
}

export function encodeRebirth(now: number): Buffer {
  const payload = Payload.encode({
    timestamp: now,
    metrics: [
      { name: 'Node Control/Rebirth', timestamp: now, datatype: BOOLEAN, booleanValue: true }
    ]
  }).finish()
  return Buffer.from(payload)
}
