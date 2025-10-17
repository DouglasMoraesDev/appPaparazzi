// src/rotas/producao.js
const express = require('express')
const router = express.Router()
const prisma = require('../prismaCliente')
const auth = require('../middleware/autenticacao')
const wsServidor = require('../wsServidor')

// Criar lista de produção (apenas DONO)
router.post('/', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode criar lista' })
    const { itens } = req.body
    if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'itens inválidos' })

    const criados = []
    for (const it of itens) {
      const preco = it.precoUnitario != null ? Number(it.precoUnitario) : undefined
      const dataItem = new Date(it.data)
      const criado = await prisma.itemProducao.create({
        data: {
          produtoId: Number(it.produtoId),
          quantidade: Number(it.quantidade),
          data: dataItem,
          precoUnitario: preco != null ? preco : undefined,
          criadoPorId: usuario.usuarioId
        },
        include: { produto: true }
      })
      criados.push(criado)
      wsServidor.broadcast({ type: 'item_adicionado', item: criado })
    }

    wsServidor.broadcast({ type: 'lista_atualizada', message: 'Nova lista de produção criada' })
    res.json(criados)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// criar 1 item isolado (opcional)
router.post('/item', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode criar item' })
    const { produtoId, quantidade, data, precoUnitario } = req.body
    if (!produtoId || !quantidade) return res.status(400).json({ erro: 'produtoId e quantidade são necessários' })
    const criado = await prisma.itemProducao.create({
      data: {
        produtoId: Number(produtoId),
        quantidade: Number(quantidade),
        data: data ? new Date(data) : new Date(),
        precoUnitario: precoUnitario != null ? Number(precoUnitario) : undefined,
        criadoPorId: usuario.usuarioId
      },
      include: { produto: true }
    })
    wsServidor.broadcast({ type: 'item_adicionado', item: criado })
    res.json(criado)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Listar itens por data
router.get('/', auth, async (req, res) => {
  try {
    const data = req.query.data ? new Date(req.query.data) : new Date()
    const inicio = new Date(data); inicio.setHours(0,0,0,0)
    const fim = new Date(data); fim.setHours(23,59,59,999)
    const itens = await prisma.itemProducao.findMany({
      where: { data: { gte: inicio, lte: fim } },
      include: { produto: true },
      orderBy: { id: 'asc' }
    })
    res.json(itens)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Observações do dia (itens com observacao não nula)
router.get('/observacoes', auth, async (req, res) => {
  try {
    const data = req.query.data ? new Date(req.query.data) : new Date()
    const inicio = new Date(data); inicio.setHours(0,0,0,0)
    const fim = new Date(data); fim.setHours(23,59,59,999)
    const itens = await prisma.itemProducao.findMany({
      where: { data: { gte: inicio, lte: fim }, NOT: { observacao: null } },
      include: { produto: true },
      orderBy: { finalizadoEm: 'asc' }
    })
    res.json(itens)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Atualizar item (apenas DONO)
router.put('/:id', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode editar' })
    const id = Number(req.params.id)
    const { quantidade, precoUnitario, data } = req.body
    const dados = {}
    if (quantidade != null) dados.quantidade = Number(quantidade)
    if (precoUnitario != null) dados.precoUnitario = Number(precoUnitario)
    if (data) dados.data = new Date(data)
    const atualizado = await prisma.itemProducao.update({ where: { id }, data: dados })
    res.json(atualizado)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Deletar item (apenas DONO)
router.delete('/:id', auth, async (req, res) => {
  try {
    const usuario = req.usuario
    if (usuario.papel !== 'DONO') return res.status(403).json({ erro: 'apenas dono pode deletar' })
    const id = Number(req.params.id)
    await prisma.itemProducao.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Finalizar item — aceita observacao e, para produtos KG, aceita array "pesos" (kg)
router.put('/:id/finalizar', auth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { observacao, pesos } = req.body // pesos: [0.5, 1.2, ...] (um por unidade)
    const item = await prisma.itemProducao.findUnique({ where: { id }, include: { produto: true } })
    if (!item) return res.status(404).json({ erro: 'item não encontrado' })

    let precoUnitario = item.precoUnitario != null ? item.precoUnitario : (item.produto ? item.produto.preco : 0)
    if (item.produto.unidade === 'KG') {
      if (!Array.isArray(pesos) || pesos.length === 0) {
        return res.status(400).json({ erro: 'para produtos em KG é necessário enviar array "pesos" com um valor por unidade' })
      }
      if (pesos.length !== item.quantidade) {
        return res.status(400).json({ erro: `forneça ${item.quantidade} pesos (um por unidade)` })
      }
      const pesosNum = pesos.map(p => Number(p))
      if (pesosNum.some(p => isNaN(p) || p <= 0)) return res.status(400).json({ erro: 'pesos inválidos' })
      const somaPesos = pesosNum.reduce((a,b) => a + b, 0)
      const precoPorKg = Number(item.produto.preco)
      const valorTotal = precoPorKg * somaPesos
      precoUnitario = valorTotal / item.quantidade
      const obsPesos = (observacao ? observacao + ' | ' : '') + `Pesos(kg): ${pesosNum.join(', ')}; Valor total: ${valorTotal.toFixed(2)}`
      const atualizado = await prisma.itemProducao.update({
        where: { id },
        data: { status: 'FINALIZADO', finalizadoEm: new Date(), observacao: obsPesos, precoUnitario }
      })
      wsServidor.broadcast({ type: 'item_finalizado', item: atualizado })
      return res.json(atualizado)
    } else {
      const atualizado = await prisma.itemProducao.update({
        where: { id },
        data: { status: 'FINALIZADO', finalizadoEm: new Date(), observacao: observacao || undefined, precoUnitario: precoUnitario }
      })
      wsServidor.broadcast({ type: 'item_finalizado', item: atualizado })
      return res.json(atualizado)
    }
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Enviar observacao sem finalizar
router.post('/:id/observacao', auth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { observacao } = req.body
    if (!observacao) return res.status(400).json({ erro: 'observacao vazia' })
    const atualizado = await prisma.itemProducao.update({ where: { id }, data: { observacao } })
    wsServidor.broadcast({ type: 'observacao', item: atualizado })
    res.json(atualizado)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

// Resumo (total, pendentes, finalizados, e lista de itens) — usa precoUnitario quando presente
router.get('/resumo', auth, async (req, res) => {
  try {
    const data = req.query.data ? new Date(req.query.data) : new Date()
    const inicio = new Date(data); inicio.setHours(0,0,0,0)
    const fim = new Date(data); fim.setHours(23,59,59,999)
    const itens = await prisma.itemProducao.findMany({
      where: { data: { gte: inicio, lte: fim } },
      include: { produto: true }
    })
    let totalQuantidade = 0
    let totalValor = 0
    let pendentes = 0
    let finalizados = 0
    for (const it of itens) {
      const precoUnit = it.precoUnitario != null ? Number(it.precoUnitario) : Number(it.produto.preco || 0)
      const valorItem = precoUnit * Number(it.quantidade)
      totalQuantidade += Number(it.quantidade)
      totalValor += valorItem
      if (it.status === 'PENDENTE') pendentes++
      if (it.status === 'FINALIZADO') finalizados++
    }
    res.json({ totalQuantidade, totalValor, pendentes, finalizados, itens })
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

module.exports = router
