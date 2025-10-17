// src/servidor.js
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')

dotenv.config()

const autenticacao = require('./rotas/autenticacao')
const produtos = require('./rotas/produtos') || require('./rotas/produtos') // manter se existir
const producao = require('./rotas/producao') || require('./rotas/producao')
const resumo = require('./rotas/resumo') || require('./rotas/resumo')
const wsServidor = require('./wsServidor') // arquivo simples (ex.: src/wsServidor.js)

const app = express()

app.use(cors())
app.use(express.json()) // substitui body-parser
app.use(express.static(path.join(__dirname, '..', 'public')))

// Rotas
app.use('/autenticacao', autenticacao)
if (produtos) app.use('/produtos', produtos)
if (producao) app.use('/producao', producao)
if (resumo) app.use('/resumo', resumo)

// healthcheck
app.get('/ping', (req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3333
const server = http.createServer(app)

// WebSocket server (se existir implementação)
try {
  const wss = new WebSocket.Server({ server })
  if (wsServidor && typeof wsServidor.setup === 'function') {
    wsServidor.setup(wss)
  }
} catch (e) {
  console.warn('WebSocket não iniciado:', e.message)
}

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
