import { createApp } from "./app";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[sandboxed-defender-agent] listening on http://localhost:${PORT} (safe simulation, no real actions)`
  );
});
