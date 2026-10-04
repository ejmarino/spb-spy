import { SPARKPLUG_NAMESPACE, type SpMessageType } from './types'

const MESSAGE_TYPES = new Set<string>([
  'NBIRTH',
  'NDEATH',
  'DBIRTH',
  'DDEATH',
  'NDATA',
  'DDATA',
  'NCMD',
  'DCMD'
])

export const CERTIFICATES_PREFIX = '$sparkplug/certificates/'

export interface ParsedTopic {
  namespace: string
  type: SpMessageType
  group?: string
  node?: string
  device?: string
  hostId?: string
  /**
   * El topico tiene la forma de Sparkplug pero no la cantidad de niveles de su tipo:
   * a un mensaje de device le falta el device_id o a uno de nodo le sobra un nivel
   */
  invalid?: 'missing-device' | 'unexpected-device'
}

/**
 * Interpreta un topico con la estructura de Sparkplug:
 *   namespace/group_id/message_type/edge_node_id/[device_id]
 *   namespace/STATE/host_id          (STATE/host_id en Sparkplug 2.2)
 * El namespace no tiene que ser spBv1.0: si el usuario escucha un prefijo no
 * estandar se toma como namespace todo lo que este antes del group_id.
 */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split('/')
  for (let i = 2; i < parts.length; i++) {
    if (!MESSAGE_TYPES.has(parts[i])) continue
    const rest = parts.length - i - 1
    if (rest !== 1 && rest !== 2) continue
    const parsed: ParsedTopic = {
      namespace: parts.slice(0, i - 1).join('/'),
      type: parts[i] as SpMessageType,
      group: parts[i - 1],
      node: parts[i + 1],
      device: rest === 2 ? parts[i + 2] : undefined
    }
    // los tipos D... son de device y llevan device_id; los N... son del nodo y no
    const ofDevice = parts[i].startsWith('D')
    if (ofDevice && rest === 1) parsed.invalid = 'missing-device'
    if (!ofDevice && rest === 2) parsed.invalid = 'unexpected-device'
    return parsed
  }
  if (parts.length >= 2 && parts[parts.length - 2] === 'STATE') {
    return {
      namespace: parts.slice(0, -2).join('/'),
      type: 'STATE',
      hostId: parts[parts.length - 1]
    }
  }
  return null
}

/** Coincidencia de un topico contra un filtro MQTT con comodines + y # */
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split('/')
  const t = topic.split('/')
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true
    if (i >= t.length) return false
    if (f[i] !== '+' && f[i] !== t[i]) return false
  }
  return f.length === t.length
}

/** Devuelve el error de sintaxis de un filtro MQTT, o null si es valido */
export function validateTopicFilter(filter: string): string | null {
  if (!filter) return 'El tópico no puede estar vacío'
  const levels = filter.split('/')
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    if (level.includes('#') && (level !== '#' || i !== levels.length - 1)) {
      return 'El comodín # solo puede ir solo y en el último nivel'
    }
    if (level.includes('+') && level !== '+') {
      return 'El comodín + tiene que ocupar un nivel completo'
    }
  }
  return null
}

export function isStandardTopic(filter: string): boolean {
  return filter.startsWith(`${SPARKPLUG_NAMESPACE}/`)
}

export function stateTopic(hostId: string): string {
  return `${SPARKPLUG_NAMESPACE}/STATE/${hostId}`
}
