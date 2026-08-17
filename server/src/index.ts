import type { Server } from "node:http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { GoogleSheetsBelgaRepository } from "./belga/GoogleSheetsBelgaRepository.js";

type RuntimeState = {
  server?: Server;
  shuttingDown: boolean;
  handlersRegistered: boolean;
  shutdownCause?: string;
};

const runtimeHost = globalThis as typeof globalThis & {
  __belgaWoodServerRuntime?: RuntimeState;
};
const runtime = (runtimeHost.__belgaWoodServerRuntime ??= {
  shuttingDown: false,
  handlersRegistered: false,
});

function reasonText(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  return String(reason);
}

function shutdown(cause: string, exitCode = 0): void {
  if (runtime.shuttingDown) {
    console.log(
      `[server] shutdown ignore cause=${cause} activeCause=${runtime.shutdownCause ?? "unknown"}`,
    );
    return;
  }
  runtime.shuttingDown = true;
  runtime.shutdownCause = cause;
  const server = runtime.server;
  console.log(
    `[server] shutdown requested cause=${cause} pid=${process.pid} listening=${server?.listening ?? false}`,
  );

  const finish = (code: number) => {
    console.log(
      `[server] stopped cause=${cause} code=${code} pid=${process.pid}`,
    );
    process.exit(code);
  };
  if (!server?.listening) {
    setImmediate(() => finish(exitCode));
    return;
  }

  const timeout = setTimeout(() => {
    console.error(`[server] délai d'arrêt dépassé cause=${cause}`);
    server.closeAllConnections?.();
    finish(1);
  }, 25_000);
  timeout.unref();
  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error(`[server] erreur pendant l'arrêt cause=${cause}`, error);
      finish(1);
      return;
    }
    finish(exitCode);
  });
}

function registerProcessHandlers(): void {
  if (runtime.handlersRegistered) return;
  runtime.handlersRegistered = true;
  process.once("SIGTERM", () => {
    console.log(`[process] SIGTERM pid=${process.pid}`);
    shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    console.log(`[process] SIGINT pid=${process.pid}`);
    shutdown("SIGINT");
  });
  process.once("uncaughtException", (error) => {
    console.error(`[server] uncaughtException ${reasonText(error)}`, error);
    shutdown("uncaughtException", 1);
  });
  process.once("unhandledRejection", (reason) => {
    console.error(`[server] unhandledRejection ${reasonText(reason)}`, reason);
    shutdown("unhandledRejection", 1);
  });
}

async function start(): Promise<void> {
  registerProcessHandlers();
  runtime.shuttingDown = false;
  runtime.shutdownCause = undefined;
  const repository = new GoogleSheetsBelgaRepository();
  await repository.initialize();
  const app = createApp(repository);
  const server = app.listen(env.port, "127.0.0.1");
  runtime.server = server;
  server.once("listening", () => {
    console.log(
      `[server] démarré pid=${process.pid} url=http://127.0.0.1:${env.port}`,
    );
  });
  server.once("close", () => {
    console.log(
      `[server] close pid=${process.pid} cause=${runtime.shutdownCause ?? "none"}`,
    );
  });
  server.once("error", (error: NodeJS.ErrnoException) => {
    console.error(
      `[server] erreur listen code=${error.code ?? "UNKNOWN"} port=${env.port}`,
      error,
    );
    shutdown(`listen:${error.code ?? "UNKNOWN"}`, 1);
  });
}

void start().catch((error: unknown) => {
  console.error(`[server] démarrage impossible ${reasonText(error)}`, error);
  shutdown("startup", 1);
});
