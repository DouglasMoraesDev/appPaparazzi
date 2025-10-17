// public/js/utils_moeda.js

// converte string BRL (ex: "R$ 12,50" ou "12,50" ou "1.234,56") para number (12.5)
function brlParaNumero(str) {
  if (str == null) return null
  let s = String(str).trim()
  s = s.replace(/\s/g, '').replace('R$', '').replace('r$', '')
  // se formato "1.234,56" -> remove pontos (milhar), troca vírgula por ponto
  if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
    s = s.replace(/\./g, '').replace(/,/g, '.')
  } else {
    s = s.replace(/,/g, '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// formata number para BRL (ex: 12.5 -> "R$ 12,50")
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function numeroParaBRL(n) {
  if (n == null) return fmtBRL.format(0)
  return fmtBRL.format(Number(n))
}
