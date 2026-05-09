import { spawn } from 'node:child_process';

const forwardedArgs = process.argv.slice(2);
const normalizedArgs = forwardedArgs[0] === '--' ? forwardedArgs.slice(1) : forwardedArgs;

const jestProcess = spawn('pnpm', ['exec', 'jest', ...normalizedArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

jestProcess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
