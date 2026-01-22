import path from 'path'

import compression from 'compression'
import express from 'express'
import cors from 'cors'
import proxy from 'express-http-proxy'

const requiredSettings = ['PORT', 'PYTHON_API_HOST', 'PYTHON_API_PATH']

const PORT = process.env.PORT || '8080';
const PYTHON_API_HOST = process.env.PYTHON_API_HOST;
const PYTHON_API_PATH = process.env.PYTHON_API_PATH;

const missingSettings = requiredSettings.filter(setting => !process.env[setting])
if (missingSettings.length) {
  throw Error(`Missing required environment variables: ${missingSettings.join(', ')}`)
}

const app = express()

app.use(compression())

app.use(cors())
  ; (async () => {
    const publicDir = path.resolve(__dirname, 'public')

    app.use(express.static(publicDir))

    const htmlPath = path.join(publicDir, 'index.html')

    app.use(
      '/api',
      proxy(PYTHON_API_HOST!, {
        proxyReqOptDecorator(proxyReqOpts: any) {
          if (process.env.PYTHON_API_TOKEN) {
            return { ...proxyReqOpts, Authorization: `Bearer ${process.env.PYTHON_API_TOKEN}` };
          }
          return proxyReqOpts;
        },
        proxyReqPathResolver(request: any) {
          return `${process.env.PYTHON_API_PATH}${request.url}`;
        },
        proxyErrorHandler(err: any, _1: any, next: any) {
          next(err);
        },
      })
    );

    app.get('*', (_: any, response: any) => {
      response.sendFile(htmlPath)
    })

    app.use((_: any, response: any) => {
      response.status(404).sendFile(htmlPath)
    })

    app.listen(PORT, () => {
      console.log(`Listening on ${PORT}`)
    })
  })()
