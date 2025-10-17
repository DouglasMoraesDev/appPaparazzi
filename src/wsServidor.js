// src/wsServidor.js
// Helper simples para armazenar a referência ao servidor WS e broadcastar mensagens JSON
let wssRef = null

function setup(wsServer) {
  wssRef = wsServer
  wsServer.on('connection', (ws, req) => {
    console.log('WS: cliente conectado. total:', wsServer.clients.size)
    ws.on('close', () => {
      console.log('WS: cliente desconectado. total:', wsServer.clients.size)
    })
    ws.on('error', (err) => {
      console.error('WS erro:', err && err.message)
    })
    // opcional: responder pings/pongs se necessário
    ws.on('message', (msg) => {
      // console.log('WS msg recebida', String(msg))
    })
  })
}

// envia objeto para todos clientes conectados (stringify)
function broadcast(obj) {
  if (!wssRef) return
  const txt = JSON.stringify(obj)
  wssRef.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      try { client.send(txt) } catch (e) { /* ignore */ }
    }
  })
}

module.exports = { setup, broadcast }
