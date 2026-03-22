import { app, readyApp } from "./app.js";
import { config } from "./config.js";

readyApp()
  .then(() => {
    const port = Number(config.port) || 5000;
    const server = app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the old backend process or change PORT in server/.env.`);
        process.exit(1);
      }

      console.error("Failed to start server", error);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap server", error);
    process.exit(1);
  });
