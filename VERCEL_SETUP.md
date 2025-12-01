# Tutorial Hosting di Vercel (Terupdate)

Karena fitur "User API Key" sudah ditambahkan ke website, proses deployment menjadi lebih sederhana. Anda **TIDAK PERLU** lagi mengatur Environment Variable di Vercel.

## 1. Persiapan GitHub
1.  Upload kode ini ke GitHub Anda.

## 2. Deploy ke Vercel
1.  Buka [vercel.com](https://vercel.com) dan login.
2.  Klik **"Add New..."** > **"Project"**.
3.  Pilih repository GitHub Anda dan klik **"Import"**.
4.  Di halaman Configure Project, biarkan semua pengaturan default.
    *   **JANGAN** isi Environment Variables (karena key sekarang diinput user di website).
5.  Klik **Deploy**.

## 3. Cara Menggunakan
1.  Buka link website yang diberikan Vercel.
2.  Saat pertama kali dibuka, website akan meminta **API Key**.
3.  User (Anda atau orang lain) harus memasukkan API Key Gemini mereka sendiri.
4.  Key akan tersimpan di browser user tersebut.

Fitur ini mencegah error "White Screen" karena website tidak lagi bergantung pada settingan server yang tersembunyi.