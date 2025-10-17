// scripts/reset-admin.js
/**
 * Uso:
 *   node scripts/reset-admin.js nomeDoDono novaSenha
 *
 * Exemplo:
 *   node scripts/reset-admin.js dono SenhaRecuperacao123
 */
const bcrypt = require('bcryptjs')
const prisma = require('../src/prismaCliente') // ajuste o caminho se necessário

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.log('Uso: node scripts/reset-admin.js <nome> <senha>')
    process.exit(1)
  }
  const [nome, senha] = args
  const hash = await bcrypt.hash(senha, 10)
  // checar existente
  const existente = await prisma.usuario.findFirst({ where: { nome } })
  if (existente) {
    await prisma.usuario.update({ where: { id: existente.id }, data: { senha: hash, papel: 'DONO' } })
    console.log(`Atualizado usuário ${nome} (id ${existente.id}) com nova senha e papel DONO.`)
  } else {
    const novo = await prisma.usuario.create({ data: { nome, senha: hash, papel: 'DONO' } })
    console.log(`Criado usuário DONO ${nome} (id ${novo.id}) com a senha informada.`)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
