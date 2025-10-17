// src/rotas/usuarios.js
require('dotenv').config()
const express = require('express')
const router = express.Router()
const prisma = require('../prismaCliente')
const bcrypt = require('bcryptjs')
const auth = require('../middleware/autenticacao')

// util: verifica se o papel é válido (ajuste se tiver mais papeis)
const PAPEIS_VALIDOS = ['DONO', 'COZINHA', 'COZINHEIRO', 'ADMIN']

// --------------------------------------------------
// Rota segura: criar usuário (apenas DONO)
// --------------------------------------------------
router.post('/', auth, async (req, res) => {
  try {
    // middleware `auth` deve popular req.usuario com { usuarioId, nome, papel }
    if (!req.usuario || String(req.usuario.papel).toUpperCase() !== 'DONO') {
      return res.status(403).json({ erro: 'apenas dono pode criar usuários' })
    }
    const { nome, senha, papel } = req.body
    if (!nome || !senha) return res.status(400).json({ erro: 'nome e senha são obrigatórios' })

    // checar existente
    const existente = await prisma.usuario.findFirst({ where: { nome } })
    if (existente) return res.status(400).json({ erro: 'nome já cadastrado' })

    const papelFinal = papel && PAPEIS_VALIDOS.includes(String(papel).toUpperCase()) ? String(papel).toUpperCase() : 'COZINHA'
    const hash = await bcrypt.hash(senha, 10)
    const novo = await prisma.usuario.create({
      data: { nome, senha: hash, papel: papelFinal }
    })
    // não retornar a senha
    const { senha: s, ...ret } = novo
    res.json(ret)
  } catch (e) {
    console.error('erro criar usuario:', e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

// --------------------------------------------------
// Trocar senha (usuário autenticado) - PUT /usuarios/trocar-senha
// --------------------------------------------------
router.put('/trocar-senha', auth, async (req, res) => {
  try {
    const { senhaAtual, novaSenha, confirmarSenha } = req.body
    if (!senhaAtual || !novaSenha || !confirmarSenha) return res.status(400).json({ erro: 'preencha todas as senhas' })
    if (novaSenha !== confirmarSenha) return res.status(400).json({ erro: 'confirmação de senha não confere' })

    const usuarioId = (req.usuario && (req.usuario.usuarioId || req.usuario.id || req.usuario.userId))
    if (!usuarioId) return res.status(401).json({ erro: 'não autenticado' })

    const usuario = await prisma.usuario.findUnique({ where: { id: Number(usuarioId) } })
    if (!usuario) return res.status(404).json({ erro: 'usuario não encontrado' })

    const ok = await bcrypt.compare(senhaAtual, usuario.senha)
    if (!ok) return res.status(401).json({ erro: 'senha atual incorreta' })

    const hash = await bcrypt.hash(novaSenha, 10)
    await prisma.usuario.update({ where: { id: usuario.id }, data: { senha: hash } })

    res.json({ ok: true, mensagem: 'senha alterada com sucesso' })
  } catch (e) {
    console.error('erro trocar senha:', e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

// --------------------------------------------------
// Rota pública opcional para registrar (bootstrap)
// - se houver usuários no banco: só permite com REGISTRAR_CODIGO correto
// - se não houver usuários: permite criar primeiro usuário (bootstrap)
// --------------------------------------------------
router.post('/registrar', async (req, res) => {
  try {
    const { nome, senha, codigoRegistro } = req.body
    if (!nome || !senha) return res.status(400).json({ erro: 'nome e senha são obrigatórios' })

    const total = await prisma.usuario.count()
    const codigoEnv = process.env.REGISTRAR_CODIGO || ''

    if (total > 0) {
      // já existem usuários -> exige código
      if (!codigoEnv) return res.status(403).json({ erro: 'registro desabilitado' })
      if (!codigoRegistro || codigoRegistro !== codigoEnv) return res.status(403).json({ erro: 'codigo de registro inválido' })
    }

    const existente = await prisma.usuario.findFirst({ where: { nome } })
    if (existente) return res.status(400).json({ erro: 'nome já cadastrado' })

    // se for o primeiro usuário, damos papel DONO (bootstrap)
    const papel = total === 0 ? 'DONO' : 'COZINHA'
    const hash = await bcrypt.hash(senha, 10)
    const novo = await prisma.usuario.create({ data: { nome, senha: hash, papel } })
    const { senha: s, ...ret } = novo
    res.json(ret)
  } catch (e) {
    console.error('erro registrar usuario:', e)
    res.status(500).json({ erro: 'erro interno' })
  }
})

// opcional: listar usuários (apenas DONO)
router.get('/', auth, async (req, res) => {
  try {
    if (!req.usuario || String(req.usuario.papel).toUpperCase() !== 'DONO') return res.status(403).json({ erro: 'apenas dono' })
    const users = await prisma.usuario.findMany({ select: { id: true, nome: true, papel: true, criadoEm: true } })
    res.json(users)
  } catch (e) {
    console.error(e); res.status(500).json({ erro: 'erro interno' })
  }
})

module.exports = router
