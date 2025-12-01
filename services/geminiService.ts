import { GoogleGenAI } from "@google/genai";
import { ExplanationStyle } from "../types";

// Helper untuk membersihkan base64
const prepareImagePart = (base64String: string) => {
  // Deteksi MimeType dari string data:image/...
  const mimeMatch = base64String.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  // Bersihkan header untuk mendapatkan data raw
  const data = base64String.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  
  return {
    inlineData: {
      mimeType,
      data
    }
  };
};

export const solveMathProblem = async (
  images: string[], 
  apiKey: string,
  style: ExplanationStyle
): Promise<string> => {
  if (!apiKey) throw new Error("API Key kosong. Silakan input ulang.");
  if (!images || images.length === 0) throw new Error("Tidak ada gambar untuk diproses.");

  const ai = new GoogleGenAI({ apiKey });

  // Instruksi gaya jawaban
  let styleInstruction = "";
  switch (style) {
    case 'brief':
      styleInstruction = "Jawab dengan SINGKAT dan PADAT. Langsung ke inti penyelesaian.";
      break;
    case 'direct':
      styleInstruction = "Hanya berikan JAWABAN AKHIR (Kunci Jawaban). Tanpa penjelasan.";
      break;
    case 'detailed':
    default:
      styleInstruction = "Berikan langkah penyelesaian yang SANGAT RINCI, tahap demi tahap, jelaskan rumus yang dipakai.";
      break;
  }

  const prompt = `
    Kamu adalah guru matematika ahli.
    Tugas: Selesaikan soal matematika dari gambar yang diberikan.
    
    Instruksi Khusus:
    1. ${styleInstruction}
    2. Jika ada banyak gambar, anggap itu satu kesatuan soal (sambungan).
    3. Gunakan Bahasa Indonesia.
    4. Gunakan format Markdown / LaTeX yang rapi untuk rumus.
    5. Cetak tebal jawaban akhir.
  `;

  const imageParts = images.map(prepareImagePart);

  // Strategi Fallback Model:
  // Coba model terbaru (2.5), jika gagal coba model stabil (1.5)
  try {
    try {
      // Percobaan 1: Gemini 2.5 Flash (Terbaru)
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [...imageParts, { text: prompt }]
        }
      });
      return response.text || "Tidak ada respons teks dari AI (Model 2.5).";

    } catch (err25) {
      console.warn("Gemini 2.5 gagal, mencoba fallback ke 1.5...", err25);
      
      // Percobaan 2: Gemini 1.5 Flash (Stabil / Versi Lama)
      const responseFallback = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [...imageParts, { text: prompt }]
        }
      });
      return responseFallback.text || "Tidak ada respons teks dari AI (Model 1.5).";
    }
  } catch (finalError: any) {
    console.error("Critical AI Error:", finalError);
    // Tampilkan pesan error ASLI dari Google agar user tau penyebabnya
    let errorMessage = finalError.message || "Terjadi kesalahan tidak diketahui.";
    
    if (errorMessage.includes("400")) errorMessage += " (Request Invalid - Coba crop gambar lebih rapi)";
    if (errorMessage.includes("403")) errorMessage += " (API Key Ditolak / Lokasi Dilarang)";
    if (errorMessage.includes("404")) errorMessage += " (Model AI Sedang Gangguan)";
    if (errorMessage.includes("500")) errorMessage += " (Server Google Error)";

    throw new Error(errorMessage);
  }
};