import { GoogleGenAI } from "@google/genai";
import { ExplanationStyle } from "../types";

export const solveMathProblem = async (
  images: string[], 
  textInputs: string[] = [], // New parameter
  apiKey: string,
  style: ExplanationStyle
): Promise<string> => {
  try {
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    // Update validation: allow logic if EITHER images OR text exists
    if ((!images || images.length === 0) && (!textInputs || textInputs.length === 0)) {
        throw new Error("Mohon masukkan gambar atau teks soal untuk diproses.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Define style instruction
    let styleInstruction = "";
    switch (style) {
      case 'brief':
        styleInstruction = "Berikan penjelasan yang singkat, padat, dan langsung pada intinya. Jangan terlalu bertele-tele.";
        break;
      case 'direct':
        styleInstruction = "Hanya berikan jawaban akhir (kunci jawaban) saja. Jangan berikan penjelasan langkah-langkah.";
        break;
      case 'detailed':
      default:
        styleInstruction = "Berikan langkah-langkah penyelesaian yang sangat rinci, jabarkan setiap konsep, rumus yang digunakan, dan logika di balik setiap langkah.";
        break;
    }

    const prompt = `
      Kamu adalah asisten ahli matematika yang sangat cerdas.
      Tugasmu adalah menganalisa soal matematika yang diberikan (baik berupa gambar maupun teks) dan memberikan solusinya.
      
      Instruksi Gaya Jawaban: ${styleInstruction}

      PENTING - Format Penulisan Matematika (LaTeX):
      1. Gunakan simbol '$' tunggal untuk matematika dalam baris (inline). Contoh: $x^2 + 5$.
      2. Gunakan simbol '$$' ganda untuk matematika blok (display/persamaan terpisah). Contoh: $$ \\frac{a}{b} = c $$.
      3. JANGAN gunakan tanda kurung siku '\\[' atau '\\(' untuk LaTeX. Gunakan tanda dollar ($).
      4. Gunakan Markdown standard untuk judul (##) dan bold (**teks**).

      Format Output Jawaban:
      1. **Analisis Soal**: Tulis ulang apa yang diketahui dan ditanya dari soal (gabungkan informasi dari gambar dan teks jika ada).
      2. **Langkah Penyelesaian**: Jelaskan tahap demi tahap dengan jelas.
      3. **Jawaban Akhir**: Tulis jawaban akhir dengan jelas dan cetak TEBAL.

      Bahasa: Bahasa Indonesia.
    `;

    const contentParts: any[] = [];

    // 1. Add Image Parts
    if (images && images.length > 0) {
        images.forEach(img => {
            const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
            contentParts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64
                }
            });
        });
    }

    // 2. Add Text Question Parts
    if (textInputs && textInputs.length > 0) {
        textInputs.forEach((text, index) => {
            contentParts.push({
                text: `[Input Soal Teks #${index + 1}]: ${text}`
            });
        });
    }

    // 3. Add System Prompt
    contentParts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: {
        parts: contentParts
      }
    });

    return response.text || "Maaf, saya tidak dapat menghasilkan jawaban saat ini.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Maaf, terjadi kesalahan saat menghubungkan ke kecerdasan AI. Periksa kembali API Key Anda atau koneksi internet.";
  }
};