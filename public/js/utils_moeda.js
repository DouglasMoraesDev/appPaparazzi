// public/js/utils_moeda.js
function brlParaNumero(str) {
  if (str == null) return null
  str = String(str).trim().replace(/\s/g, '').replace('R$', '').replace('r$', '')
  str = str.replace(/\./g, '')
  str = str.replace(/,/g, '.')
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function numeroParaBRL(n) {
  if (n == null) return fmtBRL.format(0)
  return fmtBRL.format(Number(n))
}
