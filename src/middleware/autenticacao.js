const jwt = require('jsonwebtoken')
require('dotenv').config()

module.exports = function (req, res, next) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ erro: 'token ausente' })
  const partes = auth.split(' ')
  if (partes.length !== 2) return res.status(401).json({ erro: 'token inválido' })
  const token = partes[1]
  try {
    const dec = jwt.verify(token, process.env.JWT_SECRET || 'segredo')
    // dec tem: { usuarioId, nome, papel, iat, exp }
    req.usuario = dec
    next()
  } catch (err) {
    return res.status(401).json({ erro: 'token inválido' })
  }
}
