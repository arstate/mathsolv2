
import { GoogleGenAI } from "@google/genai";
import { ExplanationStyle, EducationLevel, Subject } from "../types";

export const solveGeneralProblem = async (
  images: string[], 
  textInputs: string[],
  apiKey: string,
  style: ExplanationStyle,
  level: EducationLevel,
  subject: Subject
): Promise<string> => {
  try {
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    if ((!images || images.length === 0) && (!textInputs || textInputs.length === 0)) {
        throw new Error("Mohon masukkan gambar atau teks soal.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Build Context Prompt based on inputs
    let contextPrompt = "Peranmu adalah 'Asisten Belajar Pribadi' yang sangat cerdas dan suportif.";
    
    // Adjust tone based on Education Level
    if (level === 'TK' || level === 'SD') {
        contextPrompt += ` Tingkat pendidikan pengguna adalah ${level}. Gunakan bahasa yang sangat sederhana, ceria, mudah dipahami anak-anak, dan analogi sehari-hari. Hindari istilah teknis yang rumit.`;
    } else if (level === 'SMP') {
        contextPrompt += ` Tingkat pendidikan pengguna adalah SMP. Gunakan bahasa yang jelas, terstruktur, namun tetap santai.`;
    } else if (level === 'SMA/SMK') {
        contextPrompt += ` Tingkat pendidikan pengguna adalah SMA/SMK. Berikan penjelasan akademis yang tepat namun mudah dicerna.`;
    } else if (level === 'Kuliah (S1/D4)') {
        contextPrompt += ` Tingkat pendidikan pengguna adalah Mahasiswa (Kuliah). Gunakan gaya bahasa akademis, formal, kritis, dan mendalam.`;
    } else {
        contextPrompt += ` Sesuaikan tingkat kesulitan bahasa berdasarkan kompleksitas soal yang terdeteksi (Auto-detect level).`;
    }

    // Adjust instruction based on Subject
    if (subject !== 'Auto') {
        contextPrompt += ` Mata pelajaran fokus saat ini adalah: ${subject}.`;
    } else {
        contextPrompt += ` Analisislah soal untuk mendeteksi mata pelajaran secara otomatis.`;
    }

    // Adjust style
    let styleInstruction = "";
    if (style === 'brief') {
        styleInstruction = "Jawab dengan ringkas dan padat. Berikan poin-poin penting saja tanpa penjelasan bertele-tele.";
    } else if (style === 'direct') {
        styleInstruction = "MODE: LANGSUNG JAWABAN. SANGAT PENTING: Jangan berikan kata pengantar, sapaan, atau penjelasan langkah-langkah. HANYA berikan jawaban akhir atau kunci jawaban. Jika soal pilihan ganda, tulis huruf dan teks jawabannya saja.";
    } else {
        // Detailed
        styleInstruction = "Berikan penjelasan langkah demi langkah yang komprehensif. Jika soal hitungan, uraikan rumusnya. Jika soal esai, berikan argumen yang kuat dan latar belakang.";
    }

    const prompt = `
      ${contextPrompt}
      
      Instruksi Output Khusus: ${styleInstruction}

      PENTING - Format Penulisan:
      1. Jika ada rumus matematika/fisika/kimia, WAJIB gunakan LaTeX format:
         - Inline: $E = mc^2$
         - Block: $$ x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} $$
      2. Gunakan Markdown standard (Bold **teks**, Heading ##, List -).
      3. Jangan gunakan tag HTML.

      Struktur Jawaban (Sesuaikan dengan tipe soal):
      - Jika soal hitungan: Diketahui -> Ditanya -> Langkah Penyelesaian -> Jawaban Akhir.
      - Jika soal hafalan/teori: Ringkasan Konsep -> Penjelasan Detail -> Kesimpulan.
      - Jika soal bahasa: Terjemahan/Analisis -> Penjelasan Grammar/Konteks.
      
      Bahasa: Bahasa Indonesia.
    `;

    const contentParts: any[] = [];

    // Add Images
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

    // Add Texts
    if (textInputs && textInputs.length > 0) {
        textInputs.forEach((text, index) => {
            contentParts.push({
                text: `[Pertanyaan/Konteks #${index + 1}]: ${text}`
            });
        });
    }

    contentParts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: {
        parts: contentParts
      }
    });

    return response.text || "Maaf, AI tidak memberikan respons. Coba ulangi.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Maaf, terjadi kesalahan koneksi ke AI. Periksa internet atau API Key Anda.";
  }
};
