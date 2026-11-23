/**
 * scripts/seed.ts
 * ------------------------------------------------------------------
 * Mengisi DB dengan entri awal (starla) jika belum ada.
 * Jalankan: bun run scripts/seed.ts
 * ------------------------------------------------------------------ */
import { db } from "../src/lib/db";
import { STARLA_SEED } from "../src/data/memories";

async function main() {
  const existing = await db.memory.findUnique({
    where: { slug: STARLA_SEED.slug },
  });
  if (existing) {
    console.log(`Seed: entri "${STARLA_SEED.slug}" sudah ada, lewati.`);
    return;
  }
  await db.memory.create({
    data: {
      code: STARLA_SEED.code,
      slug: STARLA_SEED.slug,
      name: STARLA_SEED.name,
      role: STARLA_SEED.role,
      themeLabel: STARLA_SEED.theme.label,
      accent: STARLA_SEED.theme.accent,
      accentSoft: STARLA_SEED.theme.accentSoft,
      background: STARLA_SEED.theme.background,
      decoration: STARLA_SEED.theme.decoration,
      audioSrc: STARLA_SEED.audioSrc,
      songTitle: STARLA_SEED.songTitle,
      songArtist: STARLA_SEED.songArtist,
      enhancedLrc: STARLA_SEED.enhancedLrc,
      lineConfig: JSON.stringify(STARLA_SEED.lineConfig),
      svgIcons: JSON.stringify(STARLA_SEED.svgIcons),
      iconLayout: STARLA_SEED.iconLayout,
      finalMessage: STARLA_SEED.finalMessage,
      finalFrameLabel: STARLA_SEED.finalFrameLabel,
    },
  });
  console.log(`Seed: entri "${STARLA_SEED.slug}" dibuat.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
