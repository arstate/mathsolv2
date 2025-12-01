
import { GoogleGenAI } from "@google/genai";
import { ExplanationStyle, EducationLevel, Subject } from "../types";

const getCommonConfig = (apiKey: string) => {
    if (!apiKey) throw new Error("API Key tidak ditemukan.");
    return new GoogleGenAI({ apiKey });
};

// --- STUDENT MODE ---
export const solveGeneralProblem = async (
  images: string[], 
  textInputs: string[],
  apiKey: string,
  style: ExplanationStyle,
  level: EducationLevel,
  subject: Subject,
  customSubject?: string
): Promise<string> => {
  try {
    const ai = getCommonConfig(apiKey);
    if ((!images || images.length === 0) && (!textInputs || textInputs.length === 0)) {
        throw new Error("Mohon masukkan gambar atau teks soal.");
    }

    // Determine Subject Name
    const actualSubject = subject === 'Lainnya' && customSubject ? customSubject : subject;

    // 1. Build Context Prompt
    let contextPrompt = "Peranmu adalah 'Asisten Belajar Pribadi' yang sangat cerdas dan suportif.";
    
    // Adjust tone based on Education Level
    if (level === 'TK' || level === 'SD') {
        contextPrompt += ` Tingkat pendidikan pengguna adalah ${level}. Gunakan bahasa yang sangat sederhana, ceria, mudah dipahami anak-anak.`;
    } else if (level === 'Kuliah (S1/D4)') {
        contextPrompt += ` Tingkat pendidikan pengguna adalah Mahasiswa (Kuliah). Gunakan gaya bahasa akademis, formal, kritis, dan mendalam.`;
    } else {
        contextPrompt += ` Tingkat pendidikan pengguna adalah ${level}. Sesuaikan kompleksitas bahasa.`;
    }

    // Adjust instruction based on Subject
    if (actualSubject !== 'Auto') {
        contextPrompt += ` Mata pelajaran: ${actualSubject}.`;
    } else {
        contextPrompt += ` Analisislah soal untuk mendeteksi mata pelajaran secara otomatis.`;
    }

    // Adjust style
    let styleInstruction = "";
    if (style === 'brief') {
        styleInstruction = "Jawab dengan ringkas. Poin-penting saja.";
    } else if (style === 'direct') {
        styleInstruction = "MODE: LANGSUNG JAWABAN. Jangan berikan pengantar. Langsung ke jawaban akhir/kunci.";
    } else {
        styleInstruction = "Berikan penjelasan langkah demi langkah yang komprehensif.";
    }

    const prompt = `
      ${contextPrompt}
      Instruksi: ${styleInstruction}

      PENTING - Format Penulisan:
      1. Gunakan LaTeX untuk rumus matematika/sains: Inline $...$, Block $$...$$
      2. Gunakan Markdown standard.
      3. Jangan gunakan tag HTML.
      
      Bahasa: Bahasa Indonesia.
    `;

    return await callGemini(ai, 'gemini-flash-lite-latest', prompt, images, textInputs);

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Maaf, terjadi kesalahan koneksi ke AI.";
  }
};

// --- TEACHER MODE ---
export const generateTeacherQuestions = async (
    images: string[],
    textInputs: string[],
    apiKey: string,
    style: ExplanationStyle, // Affects the Answer Key detail
    level: EducationLevel,
    subject: Subject,
    customSubject: string | undefined,
    questionCount: number
): Promise<string> => {
    try {
        const ai = getCommonConfig(apiKey);
        const actualSubject = subject === 'Lainnya' && customSubject ? customSubject : subject;

        const prompt = `
        Peranmu adalah seorang GURU PROFESIONAL dan PEMBUAT SOAL (Exam Creator).
        
        Tugas: Buatlah ${questionCount} soal latihan/ujian beserta kunci jawabannya berdasarkan materi input (gambar/teks) yang diberikan.

        Konteks:
        - Jenjang Pendidikan: ${level}
        - Mata Pelajaran: ${actualSubject}
        
        Format Jawaban (Kunci Jawaban):
        ${style === 'brief' ? '- Kunci jawaban singkat dan padat.' : style === 'direct' ? '- Hanya jawaban akhirnya saja.' : '- Sertakan pembahasan detail dan langkah pengerjaan untuk setiap soal.'}

        Struktur Output (Wajib Markdown):
        # Latihan Soal ${actualSubject} (${level})
        
        ## Daftar Pertanyaan
        1. [Pertanyaan 1]
        2. [Pertanyaan 2]
        ...

        ---
        ## Kunci Jawaban & Pembahasan
        1. **Jawaban:** ...
           [Pembahasan sesuai gaya yang diminta]
        
        2. **Jawaban:** ...
        ...

        Aturan:
        - Soal harus relevan dengan materi di input (jika ada). Jika input hanya topik, buat soal seputar topik itu.
        - Gunakan LaTeX untuk rumus ($...$ atau $$...$$).
        - Bahasa Indonesia yang baku dan akademis.
        `;

        return await callGemini(ai, 'gemini-flash-lite-latest', prompt, images, textInputs);

    } catch (error) {
        console.error("Error Gemini Teacher:", error);
        return "Gagal membuat soal. Silakan coba lagi.";
    }
};

// --- HELPER ---
async function callGemini(ai: GoogleGenAI, model: string, systemPrompt: string, images: string[], texts: string[]) {
    const contentParts: any[] = [];

    if (images && images.length > 0) {
        images.forEach(img => {
            const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
            contentParts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
        });
    }

    if (texts && texts.length > 0) {
        texts.forEach((text, index) => {
            contentParts.push({ text: `[Input Materi/Konteks #${index + 1}]: ${text}` });
        });
    }

    contentParts.push({ text: systemPrompt });

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: contentParts }
    });

    return response.text || "Tidak ada respons dari AI.";
}
