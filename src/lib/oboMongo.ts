/**
 * Lazy MongoClient singleton for the YSM OboApp MongoDB database.
 *
 * ysm-api is a read-only consumer of the same MongoDB instance used by the
 * YSM OboApp fork's ingestion pipeline.  The connection is created once and
 * reused across requests.  In development the promise is stored on `global`
 * so that Next.js hot-reloads don't open a new connection on every module
 * evaluation.
 */
import { MongoClient, type Collection, type Document } from 'mongodb'

// Allow the global to survive Next.js hot-reloads in development.
declare global {
  // eslint-disable-next-line no-var
  var __ysm_obo_mongo_client_promise: Promise<MongoClient> | undefined
}

let productionClientPromise: Promise<MongoClient> | null = null

export const SOFIA_LOCALITY = 'bg.sofia'

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.YSM_OBOAPP_MONGODB_URI
  if (!uri) {
    return Promise.reject(new Error('YSM_OBOAPP_MONGODB_URI is not configured'))
  }
  const client = new MongoClient(uri)
  return client.connect()
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global.__ysm_obo_mongo_client_promise) {
      global.__ysm_obo_mongo_client_promise = createClientPromise().catch((err) => {
        global.__ysm_obo_mongo_client_promise = undefined
        throw err
      })
    }
    return global.__ysm_obo_mongo_client_promise
  }
  if (!productionClientPromise) {
    productionClientPromise = createClientPromise().catch((err) => {
      productionClientPromise = null // allow retry on next request
      throw err
    })
  }
  return productionClientPromise
}

export function getOboMongoDatabase(): string {
  return process.env.YSM_OBOAPP_MONGODB_DATABASE ?? 'oboapp'
}

export async function getMessagesCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise()
  return client.db(getOboMongoDatabase()).collection('messages')
}

export async function getSourcesCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise()
  return client.db(getOboMongoDatabase()).collection('sources')
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.YSM_OBOAPP_MONGODB_URI)
}
