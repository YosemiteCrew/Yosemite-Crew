import winston from 'winston'
import dotenv from 'dotenv'
dotenv.config()

const { combine, timestamp, printf, colorize, json, errors } = winston.format

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0

const serializeLogMessage = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
    }

    if (value instanceof Error) {
        return value.stack ?? value.message
    }

    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

const logFormat = printf(({ level, message, timestamp: time, stack, ...meta }) => {
    const safeTimestamp = isNonEmptyString(time) ? time : new Date().toISOString()
    const metaRecord = meta as Record<string, unknown>
    const serializedMeta =
        Object.keys(metaRecord).length > 0 ? ` ${JSON.stringify(metaRecord, null, 2)}` : ''
    const renderedMessage = isNonEmptyString(stack) ? stack : serializeLogMessage(message)

    return `${safeTimestamp} [${level}]: ${renderedMessage}${serializedMeta}`
})

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
}

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'white',
}

winston.addColors(colors)

const useJsonFormat = process.env.NODE_ENV !== 'development'

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels,
    format: useJsonFormat
        ? combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json())
        : combine(
              errors({ stack: true }),
              colorize({ all: true }),
              timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              logFormat
          ),
    transports: [new winston.transports.Console()],
})

type LogMethod = (message: string, ...meta: unknown[]) => void

interface Logger {
    error: LogMethod
    warn: LogMethod
    info: LogMethod
    debug: LogMethod
}

export default logger as Logger
