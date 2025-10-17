// src/rotas/autenticacao.js
require('dotenv').config()
const express = require('express')
const router = express.Router()
const prisma = require('../prismaCliente')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// Login por nome + senha
router.post('/login', async (req, res) => {
  try {
    const { nome, senha } = req.body
    if (!nome || !senha) return res.status(400).json({ erro: 'nome e senha são necessários' })

    // findUnique funciona se "nome" for unique no schema
    const usuario = await prisma.usuario.findFirst({ where: { nome } })
    if (!usuario) return res.status(401).json({ erro: 'credenciais inválidas' })

    const ok = await bcrypt.compare(senha, usuario.senha)
    if (!ok) return res.status(401).json({ erro: 'credenciais inválidas' })

    const payload = { usuarioId: usuario.id, nome: usuario.nome, papel: usuario.papel }
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'segredo', { expiresIn: process.env.JWT_EXPIRATION || '8h' })

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel } })
  } catch (e) {
    console.error('erro /autenticacao/login:', e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

module.exports = router
