import { app, readyApp } from "../src/app.js";

export default async function handler(request, response) {
  await readyApp();
  return app(request, response);
}
