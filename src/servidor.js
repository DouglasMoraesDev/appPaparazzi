// src/servidor.js
// Servidor principal (CommonJS) - compatível com npm run dev (nodemon) e Railway (process.env.PORT)
const express = require('express')
const http = require('http')
const path = require('path')
const cors = require('cors')
require('dotenv').config()

const routes = require('./rotas') // index que monta as rotas da API
const wsServidor = require('./wsServidor') // helper WS (setup + broadcast)

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Pasta pública (arquivos estáticos: public/admin.html, cozinha.html, css, js, images, etc.)
const publicPath = path.join(__dirname, '..', 'public')
app.use(express.static(publicPath))

// Redirecionamento raiz -> index (para evitar "Cannot GET /")
app.get('/', (req, res) => {
  // se quiser ir direto para /admin.html, o index faz redirect
  res.sendFile(path.join(publicPath, 'index.html'))
})

// Monta rotas da API na raiz (frontend usa '/autenticacao', '/produtos', '/producao', '/usuarios')
app.use('/', routes)

// fallback 404 JSON para API (se requisitar /api/algo inexistente)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/autenticacao') || req.path.startsWith('/produtos') || req.path.startsWith('/producao') || req.path.startsWith('/usuarios')) {
    return res.status(404).json({ erro: 'rota não encontrada' })
  }
  // senão, deixa o static servir (caso o arquivo exista)
  next()
})

// Criar servidor HTTP e integrar WebSocket (ws)
const port = process.env.PORT || 3333
const server = http.createServer(app)

// criar WebSocket server usando 'ws' e conectar com nosso helper
const WebSocket = require('ws')
const wss = new WebSocket.Server({ server })

// inicializa wsServidor (ele guarda a referência do wss e fornece broadcast)
wsServidor.setup(wss)

server.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${port} (PORT=${port})`)
  console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`)
})
