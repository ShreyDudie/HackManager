import { app } from "./app";
import { closeDatabase } from "./config/db";
import { env } from "./config/env";

const host = env.HOST || (env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(env.PORT, host, () => console.log(`HackManager API listening on ${host}:${env.PORT}`));

async function shutdown() {
  server.close();
  closeDatabase();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
