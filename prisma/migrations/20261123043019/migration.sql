-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Teman Kelas',
    "themeLabel" TEXT NOT NULL DEFAULT 'Interactive Design Canvas & Editorial Motion',
    "accent" TEXT NOT NULL DEFAULT '#e8a23d',
    "accentSoft" TEXT NOT NULL DEFAULT '#d96a4f',
    "background" TEXT NOT NULL DEFAULT '#13131f',
    "decoration" TEXT NOT NULL DEFAULT 'bezier',
    "audioSrc" TEXT NOT NULL,
    "songTitle" TEXT NOT NULL,
    "songArtist" TEXT NOT NULL,
    "enhancedLrc" TEXT NOT NULL DEFAULT '',
    "plainLines" TEXT NOT NULL DEFAULT '[]',
    "lineConfig" TEXT NOT NULL DEFAULT '[]',
    "svgIcons" TEXT NOT NULL DEFAULT '[]',
    "iconLayout" TEXT NOT NULL DEFAULT 'crowd',
    "finalMessage" TEXT NOT NULL,
    "finalFrameLabel" TEXT NOT NULL DEFAULT 'Final_Confession.tsx',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Memory_code_key" ON "Memory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Memory_slug_key" ON "Memory"("slug");
