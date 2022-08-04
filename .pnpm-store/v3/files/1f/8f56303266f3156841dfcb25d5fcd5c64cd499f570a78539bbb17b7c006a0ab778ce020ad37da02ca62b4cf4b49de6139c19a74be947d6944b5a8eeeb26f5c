import type { AstroConfig } from '../../@types/astro';
interface LogWritable<T> {
    write: (chunk: T) => boolean;
}
export declare type LoggerLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export declare type LoggerEvent = 'info' | 'warn' | 'error';
export interface LogOptions {
    dest: LogWritable<LogMessage>;
    level: LoggerLevel;
}
export declare const dateTimeFormat: Intl.DateTimeFormat;
export interface LogMessage {
    type: string | null;
    level: LoggerLevel;
    message: string;
    args: Array<any>;
}
export declare const levels: Record<LoggerLevel, number>;
/** Full logging API */
export declare function log(opts: LogOptions, level: LoggerLevel, type: string | null, ...args: Array<any>): void;
/** Emit a user-facing message. Useful for UI and other console messages. */
export declare function info(opts: LogOptions, type: string | null, ...messages: Array<any>): void;
/** Emit a warning message. Useful for high-priority messages that aren't necessarily errors. */
export declare function warn(opts: LogOptions, type: string | null, ...messages: Array<any>): void;
/** Emit a error message, Useful when Astro can't recover from some error. */
export declare function error(opts: LogOptions, type: string | null, ...messages: Array<any>): void;
declare type LogFn = typeof info | typeof warn | typeof error;
export declare function table(opts: LogOptions, columns: number[]): (logFn: LogFn, ...input: Array<any>) => void;
export declare function debug(...args: any[]): void;
export declare let defaultLogLevel: LoggerLevel;
/** Print out a timer message for debug() */
export declare function timerMessage(message: string, startTime?: number): string;
/**
 * A warning that SSR is experimental. Remove when we can.
 */
export declare function warnIfUsingExperimentalSSR(opts: LogOptions, config: AstroConfig): void;
export {};
