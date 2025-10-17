const express = require('express')
const router = express.Router()
const prisma = require('../prismaCliente')
const auth = require('../middleware/autenticacao')

router.get('/', auth, async (req, res) => {
  try {
    const data = req.query.data ? new Date(req.query.data) : new Date()
    const inicio = new Date(data); inicio.setHours(0,0,0,0)
    const fim = new Date(data); fim.setHours(23,59,59,999)
    const itens = await prisma.itemProducao.findMany({ where: { data: { gte: inicio, lte: fim } }, include: { produto: true } })
    const totalQuantidade = itens.reduce((acc, i) => acc + i.quantidade, 0)
    const totalValor = itens.reduce((acc, i) => acc + (i.quantidade * (i.precoUnitario || i.produto.preco)), 0)
    const pendentes = itens.filter(i => i.status === 'PENDENTE').length
    const finalizados = itens.filter(i => i.status === 'FINALIZADO').length
    res.json({ totalQuantidade, totalValor, pendentes, finalizados, itens })
  } catch (e) {
    console.error(e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

module.exports = router
