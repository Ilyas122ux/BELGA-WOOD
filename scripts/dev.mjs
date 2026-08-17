#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apiPort = Number(process.env.PORT || 4000);
const clientPort = Number(process.env.CLIENT_DEV_PORT || 5173);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const clientUrl = `http://127.0.0.1:${clientPort}`;
const smokeDurationMs = Number(process.env.JAD_HOME_DEV_SMOKE_DURATION_MS || 0);

const children = new Set();
let shuttingDown = false;

function spawnNpm(args, prefix, extraEnv = {}, options = {}) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  children.add(child);
  child.stdout.on('data', (chunk) => process.stdout.write(`[${prefix}] ${chunk.toString()}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${prefix}] ${chunk.toString()}`));
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!shuttingDown && !options.expectedExit) {
      console.error(`[dev] ${prefix} exited unexpectedly code=${code ?? 'null'} signal=${signal ?? 'null'}`);
      shutdown(1);
    }
  });
  return child;
}

function runNpm(args, prefix) {
  return new Promise((resolve, reject) => {
    const child = spawnNpm(args, prefix, {}, { expectedExit: true });
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${prefix} failed code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(750, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function assertPortFree(port, label) {
  if (!(await isPortOpen(port))) return;
  const windowsHint = `PowerShell: netstat -ano | findstr :${port} puis Stop-Process -Id <PID> -Force`;
  const unixHint = `Unix: lsof -i :${port} puis kill <PID>`;
  throw new Error(`${label} port ${port} is already in use. Stop the existing local server first. ${process.platform === 'win32' ? windowsHint : unixHint}`);
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/api/health`, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const backend = payload?.data?.catalogueBackend || 'unknown';
        console.log(`[dev] API ready ${apiUrl} catalogueBackend=${backend}`);
        return;
      }
      lastError = `status=${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API health did not become ready on ${apiUrl}: ${lastError}`);
}

async function waitForClient(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(clientUrl, { cache: 'no-store' });
      if (response.ok) {
        console.log(`[dev] WEB ready ${clientUrl}`);
        return;
      }
      lastError = `status=${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`WEB did not become ready on ${clientUrl}: ${lastError}`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.killed) child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  }
  if (children.size === 0) process.exit(code);
  setTimeout(() => process.exit(code), 1500).unref();
}

process.once('SIGINT', () => {
  console.log('[dev] shutdown requested cause=SIGINT');
  shutdown(0);
});
process.once('SIGTERM', () => {
  console.log('[dev] shutdown requested cause=SIGTERM');
  shutdown(0);
});

try {
  await runNpm(['run', 'build', '-w', 'shared'], 'SHARED');
  await assertPortFree(apiPort, 'API');
  await assertPortFree(clientPort, 'WEB');
  spawnNpm(['run', 'dev', '-w', 'server'], 'API');
  await waitForHealth(60_000);
  spawnNpm(['run', 'dev', '-w', 'client', '--', '--host', '127.0.0.1', '--port', String(clientPort), '--strictPort'], 'WEB');
  await waitForClient(60_000);
  console.log(`[dev] ready API=${apiUrl} WEB=${clientUrl}`);
  if (smokeDurationMs > 0) {
    const end = Date.now() + smokeDurationMs;
    let checks = 0;
    while (Date.now() < end) {
      const response = await fetch(`${apiUrl}/api/health`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`smoke health failed status=${response.status}`);
      checks += 1;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(`[dev] smoke completed healthChecks=${checks}`);
    shutdown(0);
  }
} catch (error) {
  console.error(`[dev] startup failed: ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
}
