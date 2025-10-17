// public/js/cozinha.js
(function () {
  document.addEventListener('DOMContentLoaded', () => {
  let token = null
  const apiCandidates = ['/api/', '/']

  async function fetchApi(path, opts) {
    for (const base of apiCandidates) {
      try {
        const res = await fetch(base + path, opts)
        if (res.status !== 404) return res
      } catch (e) {}
    }
    throw new Error('Falha ao acessar API')
  }

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  function brl(n) { return fmt.format(Number(n || 0)) }

  document.getElementById('formLogin').addEventListener('submit', async (e)=> {
    e.preventDefault()
    const nome = document.getElementById('nome').value
    const senha = document.getElementById('senha').value
    try {
      const res = await fetchApi('autenticacao/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ nome, senha }) })
      const data = await res.json()
      if (res.ok) {
        token = data.token
        document.getElementById('loginCard').style.display = 'none'
        document.getElementById('appArea').style.display = 'block'
        document.getElementById('dataFiltro').value = new Date().toISOString().slice(0,10)
        carregarLista()
        conectarWS()
      } else alert(data.erro || 'erro')
    } catch (err) { alert('Erro: ' + err.message) }
  })

  document.getElementById('dataFiltro').addEventListener('change', ()=> carregarLista())

  async function carregarLista() {
    const data = document.getElementById('dataFiltro').value || new Date().toISOString().slice(0,10)
    const res = await fetchApi('producao?data=' + data, { headers: { 'Authorization': 'Bearer '+token } })
    if (!res.ok) { alert('Erro ao carregar lista'); return }
    const itens = await res.json()
    const lista = document.getElementById('listaItens')
    lista.innerHTML = ''
    for (const i of itens.filter(it=>it.status === 'PENDENTE')) {
      const preco = i.precoUnitario != null ? i.precoUnitario : i.produto.preco
      const li = document.createElement('li')
      li.className = 'app-card'
      li.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <b>${i.produto.nome}</b>
          <div>Qtd: ${i.quantidade} — ${i.produto.unidade === 'KG' ? '(Preço por kg) ' + brl(i.produto.preco) : brl(preco)}</div>
          <div style="margin-top:6px"><small>${i.observacao ? 'Obs: '+i.observacao.split('Pesos')[0].trim() : ''}</small></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn confirmar"
                  data-id="${i.id}"
                  data-unidade="${i.produto.unidade}"
                  data-quant="${i.quantidade}"
                  data-tipo="${i.produto.tipo}"
                  data-nome="${i.produto.nome.replace(/"/g,'&quot;')}">Confirmar</button>
          <button data-id="${i.id}" class="btn-ghost obs">Obs</button>
        </div>
      </div>`
      lista.appendChild(li)
    }

    lista.querySelectorAll('.confirmar').forEach(b=> b.addEventListener('click', async (ev)=> {
      const btn = ev.currentTarget
      const id = btn.dataset.id
      const unidade = (btn.dataset.unidade || '').toUpperCase()
      const quant = Number(btn.dataset.quant)
      const tipo = (btn.dataset.tipo || '').toUpperCase()
      let obs = prompt('Observação (opcional) — deixe vazio se não houver:')
      let body = {}

      // pedir pesos quando é KG OU quando o tipo é LASANHA (exceção específica)
      if (unidade === 'KG' || tipo === 'LASANHA') {
        const pesos = []
        for (let i=0;i<quant;i++) {
          let entrada = prompt(`Informe o peso em kg da unidade ${i+1} (ex: 1,25):`, '')
          if (entrada == null) { alert('Finalização cancelada'); return }
          entrada = entrada.replace(/\./g,'').replace(',','.')
          const num = Number(entrada)
          if (isNaN(num) || num <= 0) { alert('Peso inválido'); i--; continue }
          pesos.push(num)
        }
        body.pesos = pesos
        if (obs) body.observacao = obs
      } else {
        if (obs) body.observacao = obs
      }

      try {
        const res = await fetchApi('producao/' + id + '/finalizar', { method:'PUT', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify(body) })
        if (res.ok) { alert('Item marcado como finalizado'); carregarLista() } else { const d = await res.json().catch(()=>({})); alert(d.erro || JSON.stringify(d) || 'erro') }
      } catch (err) {
        alert('Erro ao finalizar: ' + err.message)
      }
    }))

    lista.querySelectorAll('.obs').forEach(b=> b.addEventListener('click', async (ev)=> {
      const id = ev.currentTarget.dataset.id
      const obs = prompt('Digite sua observação:')
      if (!obs) return
      try {
        const res = await fetchApi('producao/' + id + '/observacao', { method:'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify({ observacao: obs }) })
        if (res.ok) { alert('Observação enviada'); carregarLista() } else { const d = await res.json().catch(()=>({})); alert(d.erro || JSON.stringify(d) || 'erro') }
      } catch (err) {
        alert('Erro ao enviar observação: ' + err.message)
      }
    }))
  }

  function conectarWS() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
    const ws = new WebSocket(proto + location.host)
    ws.addEventListener('open', ()=> console.log('WS conectado (cozinha)'))
    ws.addEventListener('message', (ev)=> {
      try {
        const msg = JSON.parse(ev.data)
        if (['lista_atualizada','item_adicionado','item_finalizado','observacao'].includes(msg.type)) {
          carregarLista()
        }
      } catch(e) { console.error(e) }
    })
  }

  window.__cozinha = { carregarLista }
  }) // DOMContentLoaded
})();
