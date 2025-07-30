/* eslint-disable no-console */
type LogArgs = (string | number | boolean | object | null | undefined)[];

export class Logger {
  static error(...args: LogArgs): void {
    console.error("[ERROR]", ...args);
  }

  static info(...args: LogArgs): void {
    console.info("[INFO]", ...args);
  }

  static warn(...args: LogArgs): void {
    console.warn("[WARN]", ...args);
  }

  static debug(...args: LogArgs): void {
    if (process.env.NODE_ENV === "development") {
      console.debug("[DEBUG]", ...args);
    }
  }
}
