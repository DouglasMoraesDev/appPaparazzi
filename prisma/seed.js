const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
require('dotenv').config()
const prisma = new PrismaClient()

async function main() {
  const senha = process.env.ADMIN_PASSWORD || 'senha123'
  const hash = await bcrypt.hash(senha, 10)

  await prisma.usuario.upsert({
    where: { nome: 'dono' },
    update: {},
    create: {
      nome: 'dono',
      senha: hash,
      papel: 'DONO'
    }
  })

  await prisma.usuario.upsert({
    where: { nome: 'cozinheiro' },
    update: {},
    create: {
      nome: 'cozinheiro',
      senha: hash,
      papel: 'COZINHEIRO'
    }
  })

  const produtos = [
    { nome: 'Ravioli', tipo: 'MASSA', preco: 12.5 },
    { nome: 'Capelete', tipo: 'MASSA', preco: 10.0 },
    { nome: 'Nhoque', tipo: 'MASSA', preco: 9.0 },
    { nome: 'Molho Pomodoro', tipo: 'MOLHO', preco: 6.0 },
    { nome: 'Lasanha Bolonhesa', tipo: 'LASANHA', preco: 25.0 },
    { nome: 'Torta de Frango', tipo: 'TORTA', preco: 18.0 }
  ]

  for (const p of produtos) {
    const existente = await prisma.produto.findFirst({ where: { nome: p.nome } })
    if (existente) {
      await prisma.produto.update({
        where: { id: existente.id },
        data: { preco: p.preco, tipo: p.tipo }
      })
    } else {
      await prisma.produto.create({ data: p })
    }
  }

  console.log('Seed finalizado.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
