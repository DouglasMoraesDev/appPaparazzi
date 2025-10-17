let wssRef = null

function setup(wsServer) {
  wssRef = wsServer
  wsServer.on('connection', (ws, req) => {
    // conexão aceita
    ws.on('message', (msg) => {
      // aqui pode receber mensagens do cliente se necessário
      // console.log('WS msg:', msg.toString())
    })
  })
}

function broadcast(obj) {
  if (!wssRef) return
  const txt = JSON.stringify(obj)
  wssRef.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(txt)
    }
  })
}

module.exports = { setup, broadcast }
