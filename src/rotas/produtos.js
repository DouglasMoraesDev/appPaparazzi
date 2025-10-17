// src/rotas/produtos.js
const express = require('express')
const router = express.Router()
const prisma = require('../prismaCliente')
const auth = require('../middleware/autenticacao')
const { Prisma } = require('@prisma/client')

// valores permitidos para unidade (ajuste se seu enum tiver outros)
const UNIDADES_VALIDAS = ['UN', 'KG']

// Criar produto (apenas DONO)
router.post('/', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode criar produtos' })

    const { nome, tipo, preco, unidade } = req.body
    if (!nome || !tipo || preco == null) return res.status(400).json({ erro: 'campos faltando: nome, tipo e preco são obrigatórios' })

    const unidadeFinal = (unidade && UNIDADES_VALIDAS.includes(String(unidade).toUpperCase())) ? String(unidade).toUpperCase() : 'UN'

    const criado = await prisma.produto.create({
      data: {
        nome,
        tipo,
        preco: Number(preco),
        unidade: unidadeFinal
      }
    })

    return res.json(criado)
  } catch (e) {
    console.error('Erro criar produto:', e)
    return res.status(500).json({ erro: 'erro interno ao criar produto' })
  }
})

// Listar produtos (autenticado)
router.get('/', auth, async (req, res) => {
  try {
    const { tipo } = req.query
    const filtro = tipo ? { where: { tipo } } : {}
    const produtos = await prisma.produto.findMany(filtro)
    res.json(produtos)
  } catch (e) {
    console.error('Erro listar produtos:', e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

// Buscar 1 produto
router.get('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const p = await prisma.produto.findUnique({ where: { id } })
    if (!p) return res.status(404).json({ erro: 'produto não encontrado' })
    res.json(p)
  } catch (e) {
    console.error('Erro buscar produto:', e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

// Atualizar (apenas DONO)
router.put('/:id', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode editar' })

    const id = Number(req.params.id)
    const { nome, tipo, preco, unidade } = req.body

    const dadosParaAtualizar = {}
    if (nome != null) dadosParaAtualizar.nome = nome
    if (tipo != null) dadosParaAtualizar.tipo = tipo
    if (preco != null) dadosParaAtualizar.preco = Number(preco)
    if (unidade != null) {
      const u = String(unidade).toUpperCase()
      dadosParaAtualizar.unidade = UNIDADES_VALIDAS.includes(u) ? u : 'UN'
    }

    const atualizado = await prisma.produto.update({ where: { id }, data: dadosParaAtualizar })
    res.json(atualizado)
  } catch (e) {
    console.error('Erro atualizar produto:', e)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return res.status(404).json({ erro: 'produto não encontrado' })
    }
    res.status(500).json({ erro: 'erro interno' })
  }
})

// Deletar (apenas DONO)
router.delete('/:id', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode deletar' })
    const id = Number(req.params.id)
    await prisma.produto.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error('Erro deletar produto:', e)
    // tratamento para produto referenciado (FK)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return res.status(400).json({ erro: 'Não é possível excluir produto: existem itens de produção referenciando esse produto.' })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return res.status(404).json({ erro: 'produto não encontrado' })
    }
    res.status(500).json({ erro: 'erro interno' })
  }
})

module.exports = router
