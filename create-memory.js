const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function createMemory() {
  const cookie = "arsip_admin=eyJ1c2VyIjoiamFiaXJhbGF3ZmFhIiwiZXhwIjoxNzk2MDI5NzI0NjkyfQ.EcWR5MptZnJUqKk-1n-_cqmwyYF5Bnd40Ma7wMl2wxk";
  const url = "https://ucapan-bersama.vercel.app/api/memories";

  const form = new FormData();
  form.append('name', 'Leni Ayu Pratiwi');
  form.append('code', 'leniayu');
  form.append('slug', 'leniayu');
  form.append('role', 'Orang yang aku cinta');
  form.append('audioSrc', '/audio/leniayu.mp3');
  form.append('songTitle', 'Pandangan Pertama');
  form.append('songArtist', 'RAN');
  form.append('enhancedLrc', `[ti:RAN - Pandangan Pertama (2026) - Official Music Video - RANforyourlife (128k)-[AudioTrimmer.com]]
[length:00:51.85]
[re:enhanced]
[00:01.77]<00:01.77>'Ku <00:02.11>rasa <00:02.67>'ku <00:03.02>t'lah <00:03.57>jatuh <00:04.61>cinta
[00:06.32]<00:06.32>Pada <00:06.82>pandangan <00:08.10>yang <00:08.43>pertama
[00:10.99]<00:10.99>Sulit <00:11.59>bagiku <00:12.64>untuk <00:13.89>bisa
[00:15.62]<00:15.62>Berhenti <00:16.03>mengagumi <00:17.43>dirimu
[00:20.31]<00:20.31>Oh <00:20.62>Tuhan, <00:21.47>tolonglah <00:22.84>diriku
[00:24.78]<00:24.78>'Tuk <00:25.24>membuat <00:26.08>mu <00:27.88>menjadi
[00:29.27]<00:29.27>Milikku <00:30.67>(Sayangku), <00:31.29>oh, <00:31.53>kasihku <00:32.06>(Oh, <00:32.36>cintaku)
[00:34.06]<00:34.06>She's <00:34.37>all <00:34.68>that <00:34.97>I <00:35.24>need`);
  form.append('plainLines', '[]');
  form.append('lineConfig', JSON.stringify([
    {reflection: "Detik pertama mata kita bertemu, dunia seolah berhenti. Aku jatuh cinta tidak karena penampilannya, tapi karena cara dia melihatku.", animationPreset: "blur-fade"},
    {reflection: "Pandangan pertamanya membuka pintu hati yang selama ini terkunci. Tidak ada kata-kata, hanya diam yang berbicara.", animationPreset: "zoom-in"},
    {reflection: "Mencoba bergerak maju, tapi kaki terasa berat. Rasa ini terlalu dalam untuk diabaikan, terlalu tulus untuk disembunyikan.", animationPreset: "3d-flip"},
    {reflection: "Mengaguminya bukan pilihan, tapi kodrat. Setiap gerak, setiap senyum, jadi puisi yang tak terlupakan.", animationPreset: "blur-fade"},
    {reflection: "Doa terdalam dari hati yang gugup. Meminta kekuatan untuk jujur, untuk berani mengungkapkan perasaan.", animationPreset: "zoom-out"},
    {reflection: "Mimpiku sederhana: dia bahagia, bersamaku. Bukan milikku semata, tapi bagian dari hidupmu.", animationPreset: "3d-flip"},
    {reflection: "Kata terakhir yang tak terucap, tapi tersimpan di setiap detik. Dia adalah segalanya yang aku butuhkan.", animationPreset: "blur-fade"}
  ]));
  form.append('svgIcons', JSON.stringify([
    {id: "heart", svg: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'></path></svg>", mode: "fill"},
    {id: "star", svg: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'></polygon></svg>", mode: "outline"},
    {id: "sparkle", svg: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M12 2l1 5h5l-4 3 1 5-5-3-5 3 1-5-4-3h5z'></path></svg>", mode: "fill"}
  ]));
  form.append('iconLayout', 'crowd');
  form.append('accent', '#ff6b6b');
  form.append('accentSoft', '#ff8e53');
  form.append('background', '#1a0f2e');
  form.append('decoration', 'bokeh');
  form.append('themeLabel', 'Interactive Design Canvas & Editorial Motion');
  form.append('finalMessage', 'Leni, terima kasih sudah hadir di hidupku dan mewarnai hari-hariku dengan cinta. Pandangan pertamamu akan selalu jadi kenangan paling indah yang aku simpan. Aku sayang kamu, selamanya.');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        ...form.getHeaders()
      },
      body: form
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

createMemory();