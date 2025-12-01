import { GoogleGenAI } from "@google/genai";

// Removed global initialization to prevent startup crashes if key is missing
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const solveMathProblem = async (base64Image: string, apiKey: string): Promise<string> => {
  try {
    if (!apiKey) throw new Error("API Key tidak ditemukan.");

    // Initialize client dynamically with the user's key
    const ai = new GoogleGenAI({ apiKey });

    // Clean the base64 string if it contains the header
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const prompt = `
      Kamu adalah asisten ahli matematika dan guru privat yang sabar. 
      Tugasmu adalah melihat gambar soal matematika yang diberikan, lalu:
      1. Identifikasi soalnya (tulis ulang soalnya dalam teks).
      2. Jika ini soal pilihan ganda (ABCD), analisislah setiap opsi dan tentukan mana yang benar.
      3. Berikan langkah-langkah penyelesaian yang sangat jelas, terstruktur, dan mudah dipahami dalam Bahasa Indonesia.
      4. Gunakan format Markdown untuk penulisan matematika (misalnya LaTeX sederhana untuk rumus).
      5. Berikan jawaban akhir dengan tebal (Bold).

      Jangan bertele-tele, langsung ke inti penyelesaian namun tetap ramah.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    return response.text || "Maaf, saya tidak dapat menghasilkan jawaban saat ini.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Maaf, terjadi kesalahan saat menghubungkan ke kecerdasan AI. Periksa kembali API Key Anda atau koneksi internet.";
  }
};