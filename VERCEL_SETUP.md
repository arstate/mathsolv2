# Tutorial Setup Website & API Key di Vercel

Berikut adalah langkah-langkah untuk meng-hosting website Matematika Solver ini di Vercel dan mengatur API Key Gemini agar website dapat berfungsi dengan cerdas.

## 1. Persiapan GitHub
1.  Buat repository baru di GitHub Anda.
2.  Upload/Push semua file yang dihasilkan oleh kode ini ke repository tersebut.

## 2. Deploy ke Vercel
1.  Buka [vercel.com](https://vercel.com) dan login.
2.  Klik tombol **"Add New..."** > **"Project"**.
3.  Pilih repository GitHub yang baru saja Anda buat, lalu klik **"Import"**.

## 3. Konfigurasi API Key (PENTING)
Agar kecerdasan buatan (Gemini) berjalan, Anda harus memasukkan API Key di pengaturan Vercel.

1.  Pada halaman **Configure Project** di Vercel (sebelum klik Deploy):
2.  Cari bagian **Environment Variables**.
3.  Masukkan data berikut:
    *   **Key**: `API_KEY`
    *   **Value**: (Tempelkan API Key Gemini Anda di sini: `AIzaSy...`)
4.  Klik tombol **Add**.
5.  Pastikan variabel tersebut sudah muncul di daftar di bawahnya.

## 4. Selesaikan Deploy
1.  Klik tombol **Deploy**.
2.  Tunggu proses build selesai (biasanya 1-2 menit).
3.  Setelah selesai, Vercel akan memberikan link website Anda (contoh: `matematika-pintar.vercel.app`).

## Catatan
*   Jika Anda lupa menambahkan API Key saat deploy awal:
    1.  Masuk ke dashboard project di Vercel.
    2.  Klik tab **Settings** > **Environment Variables**.
    3.  Tambahkan Key: `API_KEY` dan Value API key Anda.
    4.  Pergi ke tab **Deployments**, klik titik tiga pada deployment terakhir, lalu pilih **Redeploy** agar settingan baru aktif.
