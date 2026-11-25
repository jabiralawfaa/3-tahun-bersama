import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const memories = await prisma.memory.findMany();
  memories.forEach(m => {
    console.log('slug:', m.slug);
    console.log('code:', m.code);
    console.log('name:', m.name);
    console.log('audioSrc:', m.audioSrc);
    console.log('enhancedLrc length:', m.enhancedLrc ? m.enhancedLrc.length : 0);
    console.log('lineConfig:', m.lineConfig);
    console.log('svgIcons:', m.svgIcons);
    console.log('---');
  });
}
main().finally(() => prisma.$disconnect());