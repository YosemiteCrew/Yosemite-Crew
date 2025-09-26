import e from 'express';
import winston from 'winston';
import { boolean } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let metaString = Object.keys(meta).length ? JSON.stringify(meta, null) : "";
  return `${timestamp} [${level}]: ${stack || message} ${metaString}`;
});

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'white',
};

winston.addColors(colors);
let useJsonFormat = true;

if(process.env.NODE_ENV === 'development'){
  useJsonFormat = false;
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format: useJsonFormat
    ? combine(
        errors({ stack: true }), 
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), 
        json()
      )
    : combine(
        errors({ stack: true }), 
        colorize({ all: true }), 
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), 
        logFormat
      ),
  transports: [
    new winston.transports.Console(),       
  ],
});

// TypeScript interface for the logger
interface Logger {
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export default logger as Logger;