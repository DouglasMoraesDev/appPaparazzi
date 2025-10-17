// src/rotas/index.js
const express = require('express')
const router = express.Router()

// Importar rotas existentes (ajuste nomes/caminhos se seus arquivos estiverem em locais diferentes)
const path = require('path')
const rota = (p) => {
  try {
    return require(path.join(__dirname, p))
  } catch (e) {
    console.warn('rota não encontrada:', p, e.message)
    return null
  }
}

const autenticacao = rota('autenticacao')        // src/rotas/autenticacao.js
const produtos = rota('produtos')                // src/rotas/produtos.js
const producao = rota('producao')                // src/rotas/producao.js
const usuarios = rota('usuarios')                // src/rotas/usuarios.js

if (autenticacao) router.use('/autenticacao', autenticacao)
if (produtos) router.use('/produtos', produtos)
if (producao) router.use('/producao', producao)
if (usuarios) router.use('/usuarios', usuarios)

// rota de sanity-check
router.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }))

module.exports = router
