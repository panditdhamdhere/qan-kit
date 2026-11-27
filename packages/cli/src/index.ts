import { CommanderError } from 'commander';
import { isHelpExit, createProgram } from './program.js';
import { reportError } from './output.js';

const program = createProgram();
const json = process.argv.includes('--json');

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (isHelpExit(error)) {
    process.exitCode = 0;
  } else if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    process.exitCode = reportError(error, json);
  }
}
