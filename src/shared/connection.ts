import { isStandardTopic, validateTopicFilter } from './topic'
import { DEFAULT_TOPIC, type ConnectionConfig, type RebirthPolicy } from './types'

export const CONNECTION_COLORS = [
  '#5b9dff',
  '#c084fc',
  '#f5a524',
  '#22d3ee',
  '#fb7185',
  '#a3e635',
  '#f97316',
  '#e879f9'
]

const REBIRTH_POLICIES: RebirthPolicy[] = ['never', 'alias', 'missing-birth']
const DEFAULT_REBIRTH_COOLDOWN = 5
const MAX_REBIRTH_COOLDOWN = 3600

function randomSuffix(): string {
  return Math.random().toString(16).slice(2, 8)
}

export function newConnection(existing: ConnectionConfig[]): ConnectionConfig {
  const used = new Set(existing.map((c) => c.color))
  const color =
    CONNECTION_COLORS.find((c) => !used.has(c)) ??
    CONNECTION_COLORS[existing.length % CONNECTION_COLORS.length]
  return {
    id: crypto.randomUUID(),
    name: '',
    color,
    host: 'localhost',
    port: 1883,
    tls: false,
    rejectUnauthorized: true,
    sparkplugAware: false,
    clientId: `spb-spy-${randomSuffix()}`,
    announceHost: true,
    topic: DEFAULT_TOPIC,
    username: '',
    password: '',
    rebirthPolicy: 'missing-birth',
    rebirthCooldown: DEFAULT_REBIRTH_COOLDOWN
  }
}

/** Completa con valores por defecto lo que falte (configuraciones guardadas por versiones viejas) */
export function normalizeConnection(raw: Partial<ConnectionConfig>): ConnectionConfig {
  const base = newConnection([])
  const port = Number(raw.port)
  const cooldown = Number(raw.rebirthCooldown ?? base.rebirthCooldown)
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : base.id,
    name: String(raw.name ?? '').trim(),
    color: typeof raw.color === 'string' && raw.color ? raw.color : base.color,
    host: String(raw.host ?? base.host).trim(),
    port: Number.isInteger(port) ? port : base.port,
    tls: Boolean(raw.tls),
    rejectUnauthorized: raw.rejectUnauthorized !== false,
    sparkplugAware: Boolean(raw.sparkplugAware),
    clientId: String(raw.clientId ?? base.clientId).trim(),
    announceHost: raw.announceHost !== false,
    topic: String(raw.topic ?? base.topic).trim(),
    username: String(raw.username ?? ''),
    password: String(raw.password ?? ''),
    rebirthPolicy: REBIRTH_POLICIES.includes(raw.rebirthPolicy as RebirthPolicy)
      ? (raw.rebirthPolicy as RebirthPolicy)
      : base.rebirthPolicy,
    rebirthCooldown: Number.isFinite(cooldown) ? cooldown : base.rebirthCooldown
  }
}

export type ConnectionErrors = Partial<Record<keyof ConnectionConfig, string>>

export function validateConnection(config: ConnectionConfig): ConnectionErrors {
  const errors: ConnectionErrors = {}
  if (!config.host) errors.host = 'Falta el host'
  else if (/[\s/]/.test(config.host)) errors.host = 'Solo el nombre o IP, sin protocolo ni espacios'
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.port = 'Puerto entre 1 y 65535'
  }
  if (!config.clientId) errors.clientId = 'Falta el nombre de cliente'
  else if (/[/+#]/.test(config.clientId)) {
    errors.clientId = 'No puede tener / + # (se usa como Host ID de Sparkplug)'
  }
  const topicError = validateTopicFilter(config.topic)
  if (topicError) errors.topic = topicError
  if (!(config.rebirthCooldown >= 1 && config.rebirthCooldown <= MAX_REBIRTH_COOLDOWN)) {
    errors.rebirthCooldown = `Entre 1 y ${MAX_REBIRTH_COOLDOWN} segundos`
  }
  return errors
}

export function topicWarning(topic: string): string | null {
  if (!topic || validateTopicFilter(topic) || isStandardTopic(topic)) return null
  return 'No empieza con el prefijo estándar de Sparkplug B (spBv1.0/). Se va a usar igual, pero los mensajes que no sigan la estructura de tópicos de Sparkplug se muestran sin decodificar.'
}

export function connectionUrl(config: ConnectionConfig): string {
  return `${config.tls ? 'mqtts' : 'mqtt'}://${config.host}:${config.port}`
}

export function connectionLabel(config: ConnectionConfig): string {
  return config.name || config.host
}
