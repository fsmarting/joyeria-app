import { prisma } from './src/helpers/dbActions.js';

async function main() {
  console.log('Seed pendiente: se completa cuando esten definidos los modelos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
