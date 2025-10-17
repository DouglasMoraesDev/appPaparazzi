const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const http = require('http')
const WebSocket = require('ws')
const autenticacao = require('./rotas/autenticacao')
const produtos = require('./rotas/produtos')
const producao = require('./rotas/producao')
const resumo = require('./rotas/resumo')
const wsServidor = require('./wsServidor')

dotenv.config()
const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(express.static('public'))

app.use('/autenticacao', autenticacao)
app.use('/produtos', produtos)
app.use('/producao', producao)
app.use('/resumo', resumo)

const PORT = process.env.PORT || 3333
const server = http.createServer(app)

// WebSocket server
const wss = new WebSocket.Server({ server })
wsServidor.setup(wss)

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
