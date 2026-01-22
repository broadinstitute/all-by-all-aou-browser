import path from 'path'

import compression from 'compression'
import elasticsearch from 'elasticsearch'
import express from 'express'
import { graphqlHTTP } from 'express-graphql'
import { GoogleAuth } from 'google-auth-library'
import { GraphQLSchema } from 'graphql'
import cors from 'cors'
import axios from 'axios'

import { RootType } from './schema/root'

const requiredSettings = ['ELASTICSEARCH_URL', 'PORT', 'PYTHON_API_HOST', 'PYTHON_API_PATH']

const missingSettings = requiredSettings.filter(setting => !process.env[setting])
if (missingSettings.length) {
  throw Error(`Missing required environment variables: ${missingSettings.join(', ')}`)
}

// async function ping() {
//   const response = await axios.get(`${process.env.PYTHON_API_HOST}/api/test`, {
//     headers: { Authorization: `Bearer ${process.env.PYTHON_API_TOKEN}` },
//   })

//   console.log(response.status)

//   await new Promise(resolve => setTimeout(resolve, 1000))

//   await ping()
// }

let client: any

const app = express()
app.use(compression())
app.use(cors())
  ; (async () => {
    const elastic = new elasticsearch.Client({
      apiVersion: '5.5',
      host: process.env.ELASTICSEARCH_URL,
    })

    const auth = new GoogleAuth()

    const publicDir = path.resolve(__dirname, 'public')

    app.use(express.static(publicDir))

    const htmlPath = path.join(publicDir, 'index.html')

    /* autocomplete */
    app.use(
      '/search',
      graphqlHTTP({
        schema: new GraphQLSchema({ query: RootType }),
        graphiql: true,
        context: {
          database: {
            elastic,
          },
        },
        customFormatErrorFn: error => {
          const message =
            error.extensions && error.extensions.isUserVisible
              ? error.message
              : 'An unknown error occurred'
          return { message }
        },
      })
    )

    app.use('/api', async (request, response, next) => {
      let headers = {}

      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        if (!client) client = await auth.getIdTokenClient(process.env.PYTHON_API_HOST!)

        const clientHeaders = await client.getRequestHeaders()

        headers = { ...headers, Authorization: clientHeaders['Authorization'] }
      }

      const url = `${process.env.PYTHON_API_HOST}${process.env.PYTHON_API_PATH}${request.url}`

      try {
        const result = await axios.get(url, {
          headers,
        })

        response.send(result.data)

      } catch (error) {
        console.log(error)
        next(error)
      }
    })

    app.get('*', (request: any, response: any) => {
      response.sendFile(htmlPath)
    })

    app.use((request: any, response: any) => {
      response.status(404).sendFile(htmlPath)
    })

    // ping()

    app.listen(process.env.PORT, () => {
      console.log(`Listening on ${process.env.PORT}`)
    })
  })()
