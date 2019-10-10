import * as express from 'express'
// import * as path from 'path'
import {env} from '@shared/environment'
import * as txCtrl from '@api/ctrl/tx'
import {sha256} from 'ethereumjs-util'
import * as bodyParser from 'body-parser'

const envPr = env()

const app = express()

interface IRequestWithRawBody extends express.Request {
  rawBody?: Buffer
}
const captureRawBody = (
  req: IRequestWithRawBody,
  res: express.Response,
  buf: Buffer
) => {
  req.rawBody = buf
  return true
}

app.use(
  bodyParser.json({
    type: '*/*',
    verify: captureRawBody,
    limit: '10mb', // https://stackoverflow.com/a/19965089/1165441
  })
)

// kick out unauthenticated requests
app.use(async (req, res, next) => {
  let e = await envPr
  const token_hash = sha256(req.headers.api_token as string).toString('hex')
  // const webhookDef = e.webhooks[req.headers.app_name]
  // Backwards compatibility - in the future probably each app should need to use its own key, gotta make them specify their name first
  const webhookHashes = Object.keys(e.webhooks).map(w => e.webhooks[w].keySha)
  if (webhookHashes.indexOf(token_hash) === -1) {
    res.status(403).send('{"success":false,"message":"Unauthorized"}')
  } else {
    next()
  }
})

app.get('/', (req, res) => {
  res.json({success: true, message: 'Successfully authenticated.'})
})

app.get('/api/txs', txCtrl.index)
app.post('/api/txs', txCtrl.create)
app.get('/api/txs/:id', txCtrl.show)
app.delete('/api/txs/:id', txCtrl.destroy)

app.listen(13000, () => console.log('App listening on port 13000'))

export default app
