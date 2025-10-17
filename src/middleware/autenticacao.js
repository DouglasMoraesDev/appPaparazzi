// src/middleware/autenticacao.js  (opcional, mais seguro)
const jwt = require('jsonwebtoken')
const prisma = require('../prismaCliente')
require('dotenv').config()

module.exports = async function (req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ erro: 'token ausente' })
  const token = auth.split(' ')[1]
  try {
    const dec = jwt.verify(token, process.env.JWT_SECRET || 'segredo')
    const usuario = await prisma.usuario.findUnique({ where: { id: Number(dec.usuarioId) } })
    if (!usuario) return res.status(401).json({ erro: 'usuario não encontrado' })
    // não expor senha
    const { senha, ...usuarioClean } = usuario
    req.usuario = usuarioClean
    next()
  } catch (err) {
    console.error('auth error', err)
    return res.status(401).json({ erro: 'token inválido' })
  }
}
