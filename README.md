# WisdomEdu

This repo is split for separate client and server deployment.

## Repo structure

- `client/`: React + Vite frontend
- `server/`: Express + MongoDB API
- `server/data/class10-chapters/`: Class 10 chapter JSON library used by the adaptive engine

The client and server can be deployed as two separate Vercel projects from the same GitHub repo by selecting different root directories.

## What is already packaged here

- current live frontend from the working LMS app
- current live backend from the working LMS app
- chapter-wise Class 10 question library bundled into `server/data/class10-chapters`
- separate Vercel config for `client/`
- separate Vercel config for `server/`
- client env support for calling a separately deployed backend using `VITE_API_BASE_URL`

## Local development

### Server

1. Copy `server/.env.example` to `server/.env`
2. Set:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `OPENAI_API_KEY` if AI is enabled
   - `OPENAI_ENABLE_ENHANCED_GENERATION=true` if you want AI generation/insights
3. Install dependencies inside `server/`
4. Run:
   - `npm run dev`

### Client

1. Copy `client/.env.example` to `client/.env`
2. For local dev:
   - keep `VITE_DEV_API_PROXY_TARGET=http://localhost:5000`
3. For separate deployed backend integration:
   - set `VITE_API_BASE_URL=https://your-server-domain.vercel.app`
4. Install dependencies inside `client/`
5. Run:
   - `npm run dev`

## Separate deployment steps

### 1. Push this repo to GitHub

Inside `D:\code\Elder Bro\scratch\github\WisdomEdu`:

```powershell
git status
git add .
git commit -m "Prepare split client/server deploy"
git push origin main
```

### 2. Deploy the server

Create a new Vercel project:

- Import the GitHub repo
- Set root directory to `server`

Set server environment variables:

- `NODE_ENV=production`
- `MONGODB_URI=<your MongoDB Atlas connection string>`
- `JWT_SECRET=<your strong secret>`
- `ENABLE_STARTUP_BOOTSTRAP=false`
- `OPENAI_API_KEY=<optional>`
- `OPENAI_ENABLE_ENHANCED_GENERATION=true` or `false`
- optional:
  - `OPENAI_VARIANT_MODEL`
  - `OPENAI_INSIGHT_MODEL`
  - `OPENAI_EMBEDDING_MODEL`

Deploy it and copy the server URL, for example:

- `https://wisdomedu-server.vercel.app`

### 3. Seed the production database

Before first real usage, seed/import the Class 10 library against production:

```powershell
cd server
$env:MONGODB_URI="your-production-mongodb-uri"
node src/importClass10Library.js
```

This loads the Class 10 concepts, content, and questions from `server/data/class10-chapters`.

### 4. Deploy the client

Create another Vercel project:

- Import the same GitHub repo
- Set root directory to `client`

Set client environment variables:

- `VITE_API_BASE_URL=https://your-server-domain.vercel.app`

Deploy it.

### 5. Integrate both sides

The client is already wired to use:

- relative `/api` locally
- `VITE_API_BASE_URL` in separate deployment mode

So after client deploy:

1. open the client URL
2. try school registration/login
3. verify requests are going to the deployed server URL
4. test:
   - admin login
   - teacher create class + student
   - teacher assign task
   - student opens task and submits batch

## Quick smoke checks after deploy

- `GET /api/health`
- register a school
- create a teacher
- create a class
- add a student
- assign a chapter batch
- student batch submit
- admin dashboard load

## Important notes

- do not commit `server/.env`
- do not commit `client/.env`
- rotate any previously exposed OpenAI key before public push
- production should use MongoDB Atlas, not local Mongo
