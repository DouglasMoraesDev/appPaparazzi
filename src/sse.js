const clientes = []
exports.init = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  const id = Date.now() + Math.random()
  const cliente = { id, res }
  clientes.push(cliente)
  req.on('close', () => {
    const idx = clientes.findIndex(c => c.id === id)
    if (idx !== -1) clientes.splice(idx, 1)
  })
}

exports.publish = (evento, dados) => {
  for (const c of clientes) {
    try {
      c.res.write(`event: ${evento}\n`)
      c.res.write(`data: ${dados}\n\n`)
    } catch (e) {
      // ignore
    }
  }
}
