// public/js/cadastro-usuario.js
(function(){
  const formLogin = document.getElementById('formLogin')
  const formCriar = document.getElementById('formCriar')
  const areaCriar = document.getElementById('areaCriar')
  const saida = document.getElementById('saida')
  const btnListar = document.getElementById('btnListar')
  const api = '/' // base

  function escreve(msg){ saida.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2) }

  formLogin.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const nome = document.getElementById('nomeLogin').value.trim()
    const senha = document.getElementById('senhaLogin').value
    try {
      const res = await fetch(api + 'autenticacao/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ nome, senha }) })
      const d = await res.json()
      if (!res.ok) return escreve('erro login: ' + (d.erro || JSON.stringify(d)))
      localStorage.setItem('paparazzi_token', d.token)
      areaCriar.style.display = 'block'
      escreve('logado com sucesso.')
    } catch (e) {
      escreve('erro: ' + String(e))
    }
  })

  formCriar.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const nome = document.getElementById('novoNome').value.trim()
    const senha = document.getElementById('novaSenha').value
    const papel = document.getElementById('novoPapel').value
    const token = localStorage.getItem('paparazzi_token')
    if (!token) return escreve('faça login como dono primeiro')
    try {
      const res = await fetch(api + 'usuarios', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ nome, senha, papel }) })
      const d = await res.json()
      if (!res.ok) return escreve('erro: ' + (d.erro || JSON.stringify(d)))
      escreve('criado: ' + JSON.stringify(d, null, 2))
      formCriar.reset()
    } catch (e) { escreve('erro: ' + String(e)) }
  })

  btnListar.addEventListener('click', async () => {
    const token = localStorage.getItem('paparazzi_token')
    if (!token) return escreve('faça login como dono primeiro')
    try {
      const res = await fetch(api + 'usuarios', { headers: { 'Authorization': 'Bearer ' + token } })
      const d = await res.json()
      if (!res.ok) return escreve('erro: ' + (d.erro || JSON.stringify(d)))
      escreve(d)
    } catch (e) { escreve('erro: ' + String(e)) }
  })
})();
