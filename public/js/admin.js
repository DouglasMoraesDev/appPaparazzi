// public/js/admin.js
(function () {
  let token = null
  const api = '/'
  let ws = null
  let chart = null

  function lerJSON(res) { return res.text().then(t => { try { return JSON.parse(t) } catch(e){ return {} } }) }

  // ---------- util de moeda (usa numeroParaBRL/brlParaNumero do utils_moeda.js) ----------
  // parser robusto para números com formatos BR/EN:
  // - aceita "1,5", "1.5", "1.500,25", "1,500" (interpreta vírgula como decimal)
  function parseDecimalFlex(str) {
    if (str == null) return NaN
    let s = String(str).trim()
    if (s === '') return NaN
    s = s.replace(/\s+/g, '') // remove espaços
    const hasDot = s.indexOf('.') !== -1
    const hasComma = s.indexOf(',') !== -1

    if (hasDot && hasComma) {
      // exemplo: "1.234,56" => ponto milhar, vírgula decimal
      // se última vírgula aparece após último ponto => vírgula é decimal
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(/,/g, '.')
      } else {
        // caso oposto: "1,234.56" -> remove vírgulas
        s = s.replace(/,/g, '')
      }
    } else if (hasComma) {
      // só vírgula -> assume decimal
      s = s.replace(/,/g, '.')
    } else if (hasDot) {
      // só ponto -> pode ser decimal (1.5) ou milhar (1.000)
      // heurística: se após último ponto houver exatamente 3 dígitos, provavelmente é milhar -> remover pontos
      const after = s.split('.').pop()
      if (after.length === 3) {
        s = s.replace(/\./g, '')
      }
      // caso contrário, assume ponto decimal e mantém
    }
    const n = Number(s)
    return isNaN(n) ? NaN : n
  }

  // extrai pesos e calcula valores a partir da observação e/ou produto.preco
  function extrairPesosEValor(observacao, precoPorKg, quantidadeEsperada) {
    if (!observacao) return null
    try {
      // normaliza separadores
      const obs = observacao.replace(/\u00A0/g, ' ')
      // tenta encontrar pesos: "Pesos(kg): 1.5, 2.2" ou "Pesos: 1,5;2,2" etc
      const pesosMatch = obs.match(/Pesos\s*(?:\(|\s)*kg(?:\))?\s*[:\-]?\s*([\d\.,;\s|\/\\\-]+)/i)
      const valorMatch = obs.match(/Valor\s*total\s*[:\-]?\s*([0-9\.,]+)/i)
      const result = {}

      if (pesosMatch && pesosMatch[1]) {
        // prepara uma lista de tokens possiveis (separadores: , ; | espaço - /)
        let raw = pesosMatch[1].trim()
        raw = raw.replace(/;/g, ',').replace(/\|/g, ',').replace(/\//g, ',').replace(/\\/g, ',')
        // split por vírgula e por espaços quando não houver vírgula
        let tokens = raw.indexOf(',') !== -1 ? raw.split(',') : raw.split(/\s+/)
        tokens = tokens.map(t => t.trim()).filter(Boolean)
        const pesos = tokens.map(t => parseDecimalFlex(t)).filter(p => !isNaN(p) && p > 0)
        if (pesos.length > 0) result.pesos = pesos
      }

      if (valorMatch && valorMatch[1]) {
        const v = parseDecimalFlex(valorMatch[1])
        if (!isNaN(v)) result.valorTotal = v
      }

      // se não veio valorTotal mas vier pesos e precoPorKg, calcula
      if (!result.valorTotal && Array.isArray(result.pesos) && precoPorKg != null) {
        const soma = result.pesos.reduce((a,b)=> a + b, 0)
        result.valorTotal = Number((soma * Number(precoPorKg)).toFixed(2))
      }

      // se temos pesos e precoPorKg -> calcular valor por unidade (array)
      if (Array.isArray(result.pesos) && precoPorKg != null) {
        result.valoresPorUnidade = result.pesos.map(p => Number((p * Number(precoPorKg)).toFixed(2)))
      }

      // garantir que, se quantidadeEsperada está informada, e pesos length difere, ainda retornamos o que temos
      return Object.keys(result).length ? result : null
    } catch (e) {
      console.error('extrairPesosEValor erro', e)
      return null
    }
  }

  // login
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault()
    const nome = document.getElementById('nome').value.trim()
    const senha = document.getElementById('senha').value
    const res = await fetch(api + 'autenticacao/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ nome, senha }) })
    const d = await lerJSON(res)
    if (res.ok) {
      token = d.token
      document.getElementById('loginCard').style.display = 'none'
      document.getElementById('appArea').style.display = 'block'
      iniciar()
    } else alert(d.erro || 'erro no login')
  })

  // botões
  document.getElementById('btnSair').addEventListener('click', ()=> location.reload())
  const btnPainelEl = document.getElementById('btnPainel')
  if (btnPainelEl) {
    btnPainelEl.addEventListener('click', ()=> {
      document.getElementById('formsArea').innerHTML = ''
      document.getElementById('areaProducao').style.display = 'block'
      const titulo = document.getElementById('tituloPainel')
      if (titulo) titulo.innerText = 'Produção do dia'
      carregarLista(); carregarResumo(); carregarObservacoes()
    })
  }
  document.getElementById('btnProdutos').addEventListener('click', async ()=> { await mostrarProdutos(); })
  document.getElementById('btnCriarLista').addEventListener('click', montarFormularioCriarLista)
  document.getElementById('btnConfig').addEventListener('click', mostrarConfiguracoes)
  document.getElementById('btnNovoProdutoTopo').addEventListener('click', ()=> abrirFormProduto())
  document.getElementById('dataFiltro').addEventListener('change', ()=> { carregarLista(); carregarObservacoes(); carregarResumo(); })

  async function iniciar() {
    document.getElementById('dataFiltro').value = new Date().toISOString().slice(0,10)
    conectarWS()
    mostrarPainel()
  }

  // WebSocket
  function conectarWS() {
    if (ws) ws.close()
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host)
    ws.addEventListener('open', ()=> console.log('WS conectado (admin)'))
    ws.addEventListener('message', (ev)=> {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'item_finalizado' || msg.type === 'lista_atualizada' || msg.type === 'observacao' || msg.type === 'item_adicionado') {
          // atualiza painel
          carregarLista(); carregarResumo(); carregarObservacoes()
        }
      } catch(e) { console.error(e) }
    })
  }

  // ---------- Produtos (cards) ----------
  async function fetchProdutos() {
    const res = await fetch(api + 'produtos', { headers: { 'Authorization': 'Bearer ' + token } })
    if (!res.ok) {
      const err = await lerJSON(res)
      throw new Error(err.erro || 'erro ao buscar produtos')
    }
    return res.json()
  }

  async function mostrarProdutos() {
    document.getElementById('areaProducao').style.display = 'none'
    const area = document.getElementById('formsArea')
    area.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>Produtos</h3>
        <button id="btnVoltarPainelProdutos" class="btn">Voltar ao Painel</button>
      </div>
      <div id="produtosGrid" class="produto-grid"></div>`
    document.getElementById('btnVoltarPainelProdutos').addEventListener('click', mostrarPainel)
    try {
      const produtos = await fetchProdutos()
      const grid = document.getElementById('produtosGrid')
      grid.innerHTML = produtos.map(p=>`
        <div class="produto-card">
          <h4>${p.nome}</h4>
          <div>Tipo: ${p.tipo}</div>
          <div>Unidade: ${p.unidade}</div>
          <div>Preço: ${numeroParaBRL(p.preco)}${p.unidade==='KG' ? ' /kg' : ''}</div>
          <div style="margin-top:8px">
            <button class="btn action-primaria btnEditar" data-id="${p.id}">Editar</button>
            <button class="btn-ghost btnExcluir" data-id="${p.id}">Excluir</button>
          </div>
        </div>
      `).join('')
      document.querySelectorAll('.btnEditar').forEach(b=> b.addEventListener('click', (ev)=> abrirFormProduto(ev.currentTarget.dataset.id)))
      document.querySelectorAll('.btnExcluir').forEach(b=> b.addEventListener('click', async (ev)=> {
        if (!confirm('Excluir produto?')) return
        const id = ev.currentTarget.dataset.id
        try {
          const res = await fetch(api + 'produtos/' + id, { method: 'DELETE', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token } })
          if (res.ok) { alert('Produto excluído'); mostrarProdutos(); } else {
            const d = await lerJSON(res)
            alert(d.erro || 'erro ao excluir (ver servidor)')
          }
        } catch (err) {
          alert('Erro ao excluir: ' + err.message)
        }
      }))
    } catch (e) {
      alert('Erro: ' + e.message)
    }
  }

  function abrirFormProduto(id) {
    const area = document.getElementById('formsArea')
    area.innerHTML = `<h3>${id ? 'Editar' : 'Novo'} Produto</h3>
      <form id="formProduto">
        <input id="pNome" placeholder="Nome" required />
        <select id="pTipo"><option value="MASSA">Massa</option><option value="MOLHO">Molho</option><option value="LASANHA">Lasanha</option><option value="TORTA">Torta</option><option value="OUTRO">Outro</option></select>
        <label>Unidade:
          <select id="pUnidade"><option value="UN">UN (unidade)</option><option value="KG">KG (quilograma)</option></select>
        </label>
        <input id="pPreco" placeholder="Preço (ex: 12,50) — se KG: preço por kg" required />
        <div style="margin-top:8px">
          <button class="btn action-primaria">${id ? 'Salvar' : 'Criar'}</button>
          <button type="button" class="btn-ghost" id="btnVoltarPainel">Voltar</button>
        </div>
      </form>`
    document.getElementById('btnVoltarPainel').addEventListener('click', mostrarPainel)
    if (id) {
      fetch(api + 'produtos/' + id, { headers:{ 'Authorization': 'Bearer ' + token } }).then(async r=>{
        if (!r.ok) { const d = await lerJSON(r); alert(d.erro || 'erro'); return }
        return r.json()
      }).then(p=>{
        if (!p) return
        document.getElementById('pNome').value = p.nome
        document.getElementById('pTipo').value = p.tipo
        document.getElementById('pUnidade').value = p.unidade || 'UN'
        document.getElementById('pPreco').value = String(p.preco).replace('.',',')
      }).catch(e=> console.error(e))
    }
    document.getElementById('formProduto').addEventListener('submit', async (e)=> {
      e.preventDefault()
      const nome = document.getElementById('pNome').value
      const tipo = document.getElementById('pTipo').value
      const unidade = document.getElementById('pUnidade').value
      const precoRaw = document.getElementById('pPreco').value
      const preco = brlParaNumero(precoRaw)
      if (preco == null) { alert('Preço inválido'); return }
      const method = id ? 'PUT' : 'POST'
      const url = api + 'produtos' + (id ? ('/' + id) : '')
      const body = { nome, tipo, preco, unidade }
      try {
        const res = await fetch(url, { method, headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify(body) })
        const d = await lerJSON(res)
        if (res.ok) {
          if (d.unidade && d.unidade !== unidade) {
            alert(`Produto salvo, porém backend retornou unidade diferente: ${d.unidade}. Verifique no servidor.`)
          } else {
            alert('Salvo')
          }
          mostrarProdutos()
        } else {
          alert(d.erro || JSON.stringify(d) || 'erro ao salvar')
        }
      } catch (err) {
        alert('Erro ao salvar: ' + err.message)
      }
    })
  }

  // ---------- Criar lista ----------
  async function montarFormularioCriarLista() {
    document.getElementById('areaProducao').style.display = 'block'
    const produtos = await fetchProdutos()
    const area = document.getElementById('formsArea')
    area.innerHTML = '<h3>Criar Lista de Produção</h3><form id="formLista"><div id="itensArea"></div><div style="margin-top:8px"><button class="btn action-primaria">Salvar Lista</button> <button type="button" id="btnVoltarPainel" class="btn-ghost">Voltar</button></div></form><button id="adicionarItem" class="btn-ghost">Adicionar Item</button>'
    document.getElementById('btnVoltarPainel').addEventListener('click', mostrarPainel)
    const itensArea = document.getElementById('itensArea')
    function adicionarItem() {
      const sel = document.createElement('select')
      sel.innerHTML = produtos.map(p=>`<option value="${p.id}" data-preco="${p.preco}" data-unidade="${p.unidade}">${p.nome} (${p.tipo}) - ${numeroParaBRL(p.preco)}${p.unidade==='KG' ? '/kg' : ''}</option>`).join('')
      const qtd = document.createElement('input'); qtd.type='number'; qtd.value=1; qtd.min=1
      const data = document.createElement('input'); data.type='date'; data.value=new Date().toISOString().slice(0,10)
      const preco = document.createElement('input'); preco.placeholder='Preço (ex: 12,50)'; preco.type='text'; preco.value = String(produtos[0]?.preco || '').replace('.',',')
      sel.addEventListener('change', ()=> { preco.value = String(sel.selectedOptions[0].dataset.preco).replace('.',',') })
      const container = document.createElement('div')
      container.style.marginBottom='8px'
      container.appendChild(sel); container.appendChild(qtd); container.appendChild(preco); container.appendChild(data)
      itensArea.appendChild(container)
    }
    document.getElementById('adicionarItem').addEventListener('click', adicionarItem)
    adicionarItem()
    document.getElementById('formLista').addEventListener('submit', async (e)=> {
      e.preventDefault()
      const nodes = Array.from(itensArea.children)
      const itens = nodes.map(n=>{
        const sel = n.querySelector('select')
        const qtd = n.querySelector('input[type=number]')
        const precoInput = n.querySelector('input[type=text]')
        const data = n.querySelector('input[type=date]')
        const preco = brlParaNumero(precoInput.value)
        return { produtoId: Number(sel.value), quantidade: Number(qtd.value), data: data.value, precoUnitario: preco }
      })
      try {
        const res = await fetch(api + 'producao', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ itens }) })
        const d = await lerJSON(res)
        if (res.ok) { alert('Lista criada'); area.innerHTML = ''; carregarLista(); } else { alert(d.erro || JSON.stringify(d) || 'erro') }
      } catch (err) { alert('Erro: ' + err.message) }
    })
  }

  // ---------- Lista de Produção (tabela) ----------
  async function carregarLista() {
    document.getElementById('areaProducao').style.display = 'block'
    const data = document.getElementById('dataFiltro').value || new Date().toISOString().slice(0,10)
    const res = await fetch(api + 'producao?data=' + data, { headers: { 'Authorization': 'Bearer ' + token } })
    const itens = await res.json()
    const tbody = document.querySelector('#tabelaItens tbody')

    tbody.innerHTML = itens.map(i=>{
      const preco = i.precoUnitario != null ? i.precoUnitario : i.produto.preco
      // extrair pesos/valor (se presente na observação)
      const detalhes = extrairPesosEValor(i.observacao, i.produto.preco, i.quantidade)
      let detalhesHtml = ''
      if (detalhes && detalhes.pesos) {
        // pesos formatados corretamente (pt-BR) com 2 casas
        const pesosFmt = detalhes.pesos.map(p => `${Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`).join(', ')
        // valores por unidade (se calculados)
        let valoresUnidadeHtml = ''
        if (detalhes.valoresPorUnidade) {
          valoresUnidadeHtml = detalhes.valoresPorUnidade.map(v => numeroParaBRL(v)).join(' — ')
        }
        const valorTotalFmt = detalhes.valorTotal != null ? numeroParaBRL(detalhes.valorTotal) : numeroParaBRL(preco * i.quantidade)
        detalhesHtml = `<div class="detalhes-kg" style="font-size:13px;color:#333;margin-top:6px">
          <div><b>Pesos:</b> ${pesosFmt}</div>
          ${valoresUnidadeHtml ? `<div><b>Valor por unidade:</b> ${valoresUnidadeHtml}</div>` : ''}
          <div><b>Valor total (kg):</b> ${valorTotalFmt}</div>
        </div>`
      }

      // valor exibido principal: mostrar total (como antes) mas também o valor por unidade em detalhe
      const valorTotal = i.precoUnitario != null ? (i.precoUnitario * i.quantidade) : (preco * i.quantidade)
      const valorExib = numeroParaBRL(valorTotal)

      return `<tr class="${i.status==='FINALIZADO' ? 'feito' : ''}">
        <td>${i.id}</td>
        <td>
          <div style="display:flex;flex-direction:column">
            <div><strong>${i.produto.nome}${i.produto.unidade==='KG' ? ' (kg)' : ''}</strong> ${i.quantidade ? '('+i.quantidade+')' : ''}</div>
            ${detalhesHtml}
            ${i.observacao && !detalhes ? `<div style="font-size:13px;color:#666;margin-top:6px">${i.observacao}</div>` : ''}
          </div>
        </td>
        <td>${i.produto.tipo}</td>
        <td>${i.quantidade}</td>
        <td>${numeroParaBRL(preco)}${i.produto.unidade==='KG' ? ' /kg' : ''}</td>
        <td>${valorExib}</td>
        <td>${i.status}</td>
        <td>
          ${i.status === 'PENDENTE' ? `<button class="btn-ghost btnEditarItem" data-id="${i.id}">Editar</button> <button class="btn-ghost btnExcluirItem" data-id="${i.id}">Excluir</button>` : ''}
        </td>
      </tr>`
    }).join('')

    document.querySelectorAll('.btnEditarItem').forEach(b => b.addEventListener('click', (ev)=> abrirFormEditarItem(ev.currentTarget.dataset.id)))
    document.querySelectorAll('.btnExcluirItem').forEach(b => b.addEventListener('click', async (ev)=> {
      if (!confirm('Excluir item de produção?')) return
      const id = ev.currentTarget.dataset.id
      try {
        const res = await fetch(api + 'producao/' + id, { method: 'DELETE', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token } })
        if (res.ok) { alert('Excluído'); carregarLista(); } else {
          const d = await lerJSON(res)
          alert(d.erro || JSON.stringify(d) || 'erro')
        }
      } catch (err) { alert('Erro: ' + err.message) }
    }))
  }

  function abrirFormEditarItem(id) {
    const area = document.getElementById('formsArea')
    area.innerHTML = `<h3>Editar Item ${id}</h3>
      <form id="formEditarItem">
        <input id="eQuantidade" type="number" placeholder="Quantidade" required />
        <input id="ePreco" placeholder="Preço (ex: 12,50)" required />
        <input id="eData" type="date" required />
        <div style="margin-top:8px">
          <button class="btn action-primaria">Salvar</button>
          <button type="button" id="btnVoltarPainel" class="btn-ghost">Voltar</button>
        </div>
      </form>`
    document.getElementById('btnVoltarPainel').addEventListener('click', mostrarPainel)
    fetch(api + 'producao?data=' + document.getElementById('dataFiltro').value, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json())
      .then(itens => {
        const item = itens.find(it=> String(it.id) === String(id))
        if (!item) { alert('Item não encontrado'); return }
        document.getElementById('eQuantidade').value = item.quantidade
        const p = item.precoUnitario != null ? item.precoUnitario : item.produto.preco
        document.getElementById('ePreco').value = String(p).replace('.',',')
        const dataStr = new Date(item.data).toISOString().slice(0,10)
        document.getElementById('eData').value = dataStr
      })
    document.getElementById('formEditarItem').addEventListener('submit', async (e)=> {
      e.preventDefault()
      const quantidade = Number(document.getElementById('eQuantidade').value)
      const preco = brlParaNumero(document.getElementById('ePreco').value)
      const data = document.getElementById('eData').value
      try {
        const res = await fetch(api + 'producao/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify({ quantidade, precoUnitario: preco, data }) })
        if (res.ok) { alert('Atualizado'); mostrarPainel(); } else { const d = await lerJSON(res); alert(d.erro || 'erro') }
      } catch (err) { alert('Erro: ' + err.message) }
    })
  }

  // ---------- Observações do dia ----------
  async function carregarObservacoes() {
    const data = document.getElementById('dataFiltro').value || new Date().toISOString().slice(0,10)
    const res = await fetch(api + 'producao/observacoes?data=' + data, { headers: { 'Authorization': 'Bearer ' + token } })
    if (!res.ok) { document.getElementById('listaObservacoes').innerText = 'Erro ao carregar observações'; return }
    const itens = await res.json()
    if (!itens || itens.length === 0) { document.getElementById('listaObservacoes').innerText = 'Nenhuma observação por enquanto.'; return }
    const html = itens.map(i => {
      const detalhes = extrairPesosEValor(i.observacao, i.produto.preco, i.quantidade)
      let extras = ''
      if (detalhes) {
        if (detalhes.pesos) {
          const pesosFmt = detalhes.pesos.map(p => `${Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`).join(', ')
          extras += `<div><b>Pesos:</b> ${pesosFmt}</div>`
        }
        if (detalhes.valoresPorUnidade) {
          extras += `<div><b>Valor por unidade:</b> ${detalhes.valoresPorUnidade.map(v => numeroParaBRL(v)).join(' — ')}</div>`
        }
        if (detalhes.valorTotal != null) extras += `<div><b>Valor total (kg):</b> ${numeroParaBRL(detalhes.valorTotal)}</div>`
      }
      return `<div style="margin-bottom:8px;border-bottom:1px dashed #eee;padding-bottom:6px">
        <b>${i.produto.nome}</b> (${i.quantidade})
        <div style="font-size:13px;color:#333">${i.observacao || ''}</div>
        <div style="font-size:13px;color:#333;margin-top:6px">${extras}</div>
      </div>`
    }).join('')
    document.getElementById('listaObservacoes').innerHTML = html
  }

  // ---------- Resumo e grafico ----------
  async function carregarResumo() {
    const data = document.getElementById('dataFiltro').value || new Date().toISOString().slice(0,10)
    const res = await fetch(api + 'producao/resumo?data=' + data, { headers: { 'Authorization': 'Bearer ' + token } })
    const d = await res.json()
    document.getElementById('totalQtd').innerText = d.totalQuantidade
    document.getElementById('totalValor').innerText = numeroParaBRL(d.totalValor)
    document.getElementById('pendentes').innerText = d.pendentes
    document.getElementById('finalizados').innerText = d.finalizados
    desenharGrafico(d.itens)
  }
  function desenharGrafico(itens) {
    const ctx = document.getElementById('grafico').getContext('2d')
    const agrup = {}
    for (const it of itens) {
      const tipo = it.produto.tipo
      const preco = it.precoUnitario != null ? it.precoUnitario : it.produto.preco
      agrup[tipo] = (agrup[tipo] || 0) + (it.quantidade * preco)
    }
    const labels = Object.keys(agrup)
    const data = Object.values(agrup)
    if (chart) chart.destroy()
    chart = new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data }] } })
  }

  // ---------- Configurações (troca de senha) ----------
  function mostrarConfiguracoes() {
    const area = document.getElementById('formsArea')
    area.innerHTML = `<h3>Configurações</h3>
      <form id="formSenha">
        <label>Senha atual</label><input id="senhaAtual" type="password" required />
        <label>Nova senha</label><input id="senhaNova" type="password" required />
        <label>Confirmar nova senha</label><input id="senhaConfirma" type="password" required />
        <div style="margin-top:8px">
          <button class="btn action-primaria">Alterar senha</button>
          <button type="button" class="btn-ghost" id="btnVoltarPainelConfig">Voltar</button>
        </div>
      </form>`
    document.getElementById('btnVoltarPainelConfig').addEventListener('click', mostrarPainel)
    document.getElementById('areaProducao').style.display = 'none'

    document.getElementById('formSenha').addEventListener('submit', async (e)=> {
      e.preventDefault()
      const atual = document.getElementById('senhaAtual').value
      const nova = document.getElementById('senhaNova').value
      const conf = document.getElementById('senhaConfirma').value
      if (!atual || !nova || !conf) return alert('Preencha todos os campos')
      if (nova !== conf) return alert('Confirmação diferente da nova senha')
      try {
        const res = await fetch(api + 'usuarios/trocar-senha', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }) })
        const d = await lerJSON(res)
        if (res.ok) { alert('Senha alterada com sucesso'); mostrarPainel() } else { alert(d.erro || JSON.stringify(d) || 'erro ao alterar senha') }
      } catch (err) { alert('Erro: ' + err.message) }
    })
  }

  // ---------- Painel (voltar) ----------
  function mostrarPainel() {
    document.getElementById('formsArea').innerHTML = ''
    document.getElementById('areaProducao').style.display = 'block'
    const titulo = document.getElementById('tituloPainel')
    if (titulo) titulo.innerText = 'Produção do dia'
    carregarLista(); carregarResumo(); carregarObservacoes()
  }

  window.__appPaparazzi = { mostrarProdutos, mostrarPainel }

  // inicializa
})();
