import { GoogleGenAI } from "@google/genai";
import { ExplanationStyle } from "../types";

export const solveMathProblem = async (
  images: string[], 
  apiKey: string,
  style: ExplanationStyle
): Promise<string> => {
  try {
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    if (!images || images.length === 0) throw new Error("Tidak ada gambar untuk diproses.");

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
      Kamu adalah asisten ahli matematika.
      Tugasmu adalah menganalisa gambar-gambar soal matematika yang diberikan.
      User mungkin mengupload 1 gambar atau lebih (potongan soal). Gabungkan konteksnya jika perlu.
      
      Instruksi Gaya Jawaban: ${styleInstruction}

      Format Output:
      1. Tulis ulang soalnya (jika terbaca).
      2. Jika pilihan ganda, analisa opsi jawaban.
      3. Berikan jawaban/penjelasan sesuai instruksi gaya di atas dalam Bahasa Indonesia.
      4. Gunakan format Markdown (LaTeX untuk rumus matematik).
      5. Jawaban Akhir harus dicetak TEBAL (Bold).
    `;

    // Prepare content parts for multiple images
    const imageParts = images.map(img => {
      // Clean base64 header if exists
      const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
      return {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      };
    });

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: {
        parts: [
          ...imageParts,
          { text: prompt }
        ]
      }
    });

    return response.text || "Maaf, saya tidak dapat menghasilkan jawaban saat ini.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Maaf, terjadi kesalahan saat menghubungkan ke kecerdasan AI. Periksa kembali API Key Anda atau koneksi internet.";
  }
};