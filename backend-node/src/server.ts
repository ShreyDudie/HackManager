import { app } from "./app";
import { closeDatabase } from "./config/db";
import { env } from "./config/env";

const server = app.listen(env.PORT, () => console.log(`HackManager API listening on ${env.PORT}`));

async function shutdown() {
  server.close();
  closeDatabase();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
