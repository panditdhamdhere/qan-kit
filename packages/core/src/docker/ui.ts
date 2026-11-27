import ora, { type Ora } from 'ora';
import pc from 'picocolors';

export interface Spinner {
  text(value: string): void;
  succeed(message: string): void;
  fail(message: string): void;
}

export interface DockerUi {
  info(message: string): void;
  warn(message: string): void;
  spin(label: string): Spinner;
}

export function createConsoleUi(enabled: boolean): DockerUi {
  return {
    info(message) {
      if (enabled) process.stderr.write(`${message}\n`);
    },
    warn(message) {
      process.stderr.write(`${pc.yellow(message)}\n`);
    },
    spin(label) {
      if (!enabled) {
        return {
          text() {},
          succeed() {},
          fail() {},
        };
      }
      const spinner: Ora = ora({ text: label, stream: process.stderr }).start();
      return {
        text(value) {
          const line = value
            .split('\n')
            .filter((part) => part.trim().length > 0)
            .at(-1);
          if (line) spinner.text = line;
        },
        succeed(message) {
          spinner.succeed(message);
        },
        fail(message) {
          spinner.fail(message);
        },
      };
    },
  };
}

export const silentUi: DockerUi = {
  info() {},
  warn() {},
  spin() {
    return { text() {}, succeed() {}, fail() {} };
  },
};
