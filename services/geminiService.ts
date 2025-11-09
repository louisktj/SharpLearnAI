
import { GoogleGenAI, Type } from "@google/genai";
import { ClassifiedCourseResult, QuizQuestion } from "../types";

// Helper function to get a fresh AI client instance
const getAiClient = () => {
    if (!process.env.API_KEY) {
        // This should ideally not be hit if the app flow is correct, but it's a good safeguard.
        throw new Error("API_KEY environment variable not set. Please select an API key in the application.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const geminiService = {
  structureNotes: async (text: string): Promise<string> => {
    if (!text.trim()) return "";
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a note-taking assistant for a university student. Your task is to listen to a raw transcript from a lecture and structure it into clear, concise, and well-organized notes in clean, semantic HTML format. The output will be directly injected into a div, so do not include <html> or <body> tags.

**Formatting Rules:**
- Use <h2> for main topics and <h3> for sub-topics.
- Use <ul> and <li> for bullet points.
- Use <strong> to highlight all key concepts, definitions, and important terms.
- Use <blockquote class="definition"> to highlight key **Definitions**. Start the content with <p><strong>Definition:</strong> ...</p>.
- Use <blockquote class="remember"> for critical takeaways. Start the content with an <h2>⚡ To Remember</h2> title.
- Use <em> to provide illustrative **Examples**.

**Content Rules:**
- Keep the notes concise and to the point.
- Organize information logically as it appears in the transcript.
- Do not add any commentary, just the structured notes.
- Ensure all HTML tags are valid and properly closed.

Here is the transcript segment to process:
\n\n---\n${text}\n---`,
      });
      return response.text;
    } catch (error) {
      console.error("Error structuring notes:", error);
      throw error;
    }
  },

  generateFinalSummary: async (fullTranscript: string, subject: string): Promise<string> => {
    if (!fullTranscript.trim()) return "No content to summarize.";
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a master educator and academic AI assistant. Your mission is to transform a raw, messy lecture transcript into a perfect, well-structured, and visually appealing study guide in clean, semantic HTML format. The document must be exceptionally clear, logical, and optimized for student learning and retention. It will be injected directly into a div, so do not include <html> or <body> tags.

The subject of the lecture is: ${subject || 'To be determined from context'}.

From the transcript provided below, create a comprehensive study guide that includes the following mandatory HTML elements in this exact order:

1.  **Course Title:** An <h1> element with a short, precise, and engaging title.
2.  **Subtitle:** A <p> with a class "subtitle" containing a single sentence summarizing the main idea of the lecture.
3.  **Lesson Plan:** A <ul> list of the 4-7 main sections of the study guide.
4.  **Structured Course Breakdown:** For each section from the plan:
    *   Use clear, hierarchical headings (<h2>Section Title</h2>). Use headings for the special sections below as well.
    *   Write short, easy-to-read paragraphs (<p>).
    *   Use unordered lists (<ul><li>...</li></ul>) for key ideas.
    *   Use <strong> tags for all important concepts, definitions, and results.
    *   Use <blockquote class="definition"> to highlight key **Definitions**. Start the content with <p><strong>Definition:</strong> ...</p>.
    *   Use <em> tags to present **Examples**.
    *   At the end of each major section, include a <blockquote class="remember"> containing an <h2>⚡ To Remember</h2> title followed by a <ul> of 3-5 bullet points summarizing the section's core takeaways.
5.  **Final Synthesis:** A concluding section starting with <h2>Final Synthesis</h2> followed by a <ul> with 5-7 bullet points that summarize the most critical ideas.
6.  **Keywords:** A section starting with <h2>Keywords</h2> followed by a paragraph of comma-separated key terms.
7.  **❓ Questions for the Professor:** A section starting with <h2>❓ Questions for the Professor</h2> with a <ul> of 2-5 insightful questions. If none, state that.
8.  **✅ Quick Checks:** A section starting with <h2>✅ Quick Checks</h2> with a mini-quiz of 3-5 questions. Provide the brief answers immediately after each question, perhaps in an <em> tag.
9.  **📝 Action Tasks:** A section starting with <h2>📝 Action Tasks</h2> with a short list of actionable tasks for the student.

**Quality Rules:**
- **Fidelity:** Stick strictly to the information in the transcript. Do not invent facts.
- **Clarity:** Use simple language. One idea per line where possible in lists.
- **Progression:** Structure the content logically.
- **Tone:** Be pedagogical, calm, and confident.
- **Valid HTML:** Ensure all tags are properly opened and closed.

---
Transcript:
${fullTranscript}
---`,
      });
      return response.text;
    } catch (error) {
      console.error("Error generating summary:", error);
      throw error;
    }
  },

  identifySubject: async (text: string): Promise<string> => {
    if (!text.trim()) return "Unknown";
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze the following text from a lecture and identify the academic subject. Respond with only the subject name (e.g., "Biology", "Mathematics", "History", "Computer Science").\n\n---\n${text}\n---`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: "The academic subject of the lecture.",
              },
            },
            required: ["subject"],
          },
        },
      });
      const jsonStr = response.text.trim();
      if (jsonStr) {
        const result = JSON.parse(jsonStr);
        return result.subject || "Unknown";
      }
      return "Unknown";
    // FIX: Added curly braces to the catch block to correctly scope the error variable.
    } catch (error) {
      console.error("Error identifying subject:", error);
      throw error;
    }
  },
  
  analyzeFocus: async (imageBase64: string): Promise<{ score: number; reason: string }> => {
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              text: `Analyze the user's focus level based on the image provided, for the context of an online university lecture. Provide a JSON response with "focusScore" (a number from 0 to 100) and a brief "reason".

Scoring criteria:
- **100 (Attentive):** User is looking straight ahead or slightly upwards, indicating they are watching the professor or the board. Normal posture.
- **80 (Slightly Distracted):** User is looking down, below the desk level (e.g., at a phone or another object not related to the course).
- **50 (Distracted):** User's head is turned significantly to the left or right, they have their eyes closed for an extended period (not just blinking), or their body is mostly out of the camera's frame.
- **0 (Not Present):** No face is visible in the frame.

Base your score strictly on these visual cues. Respond only with the JSON object.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              focusScore: {
                type: Type.NUMBER,
              },
              reason: {
                type: Type.STRING,
              },
            },
            required: ["focusScore", "reason"],
          },
        },
      });
      const jsonStr = response.text.trim();
      if (jsonStr) {
        const result = JSON.parse(jsonStr);
        return { score: result.focusScore, reason: result.reason };
      }
      return { score: 0, reason: "Could not analyze image." };
    } catch (error) {
      console.error("Error analyzing focus:", error);
      throw error;
    }
  },

  generateFlashcard: async (courseContent: string): Promise<string> => {
    if (!courseContent.trim()) return "No content to create a flashcard from.";
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert in creating study materials. Based on the following lecture notes, generate a concise, schematic 'flashcard' in clean, semantic HTML. The flashcard should summarize the key concepts, definitions, and main points in a highly organized and easy-to-digest format. Use <h2>, <h3> for headings, <ul> and <li> for bullet points, and <strong> to structure the information for quick learning and revision. Do not include <html> or <body> tags. The output should be ready to be displayed.\n\n---\n${courseContent}\n---`,
      });
      return response.text;
    } catch (error) {
      console.error("Error generating flashcard:", error);
      throw error;
    }
  },

  classifyCourse: async (transcript: string, classList: string[]): Promise<ClassifiedCourseResult | null> => {
    if (!transcript.trim() || classList.length === 0) return null;
    const ai = getAiClient();

    const prompt = `Tu es un assistant qui écoute un cours et comprend le thème abordé. Ton objectif est de dire clairement :

quel est le sujet principal du passage entendu,

quel cours (parmi une liste fournie) est en train d’être enregistré,

si tu es sûr ou non de ton choix.

Contexte

L’application enregistre des séances de cours.

Nous avons déjà une liste de cours existants (voir ci-dessous).

Tu dois analyser uniquement ce qui est dit pour décider du bon cours et résumer le sujet.

Liste des cours (à adapter)
${classList.map(c => `« ${c} »`).join('\n')}

Ce que tu dois produire

Sujet principal : une phrase courte, précise.

Cours détecté : exactement un cours de la liste.

Certitude : un nombre de 0 à 100 %.

Motifs : 2–4 mots-clés entendus qui t’ont aidé à décider.

Si tu n’es pas sûr (< 70 %) : propose une seule question courte à poser à l’étudiant pour lever le doute (sinon, écris « Aucune »).

Règles

Appuie-toi sur les concepts, définitions, exercices, exemples ou auteurs cités pour reconnaître le cours.

S’il y a des mots communs à plusieurs cours, privilégie les notions spécifiques (ex. « élasticité-prix », « MPS/multiplicateur », « arbres AVL », « hash table », « test de convergence », « thèse/antithèse », « 4P », « CAPM »).

Ne crée jamais de nouveau cours. Choisis toujours dans la liste.

Si le passage mélange deux matières, choisis celle la plus dominante dans l’extrait.

Style : clair, concis, sans abréviations obscures.

Format de sortie (exact)

Sujet : …
Cours : …
Certitude : … %
Motifs : …, …, …
Question si incertain : …

---
Extrait du cours à analyser:
${transcript.substring(0, 8000)}
---`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = response.text;

      const subjectMatch = text.match(/Sujet\s*:\s*(.*)/i);
      const courseMatch = text.match(/Cours\s*:\s*(.*)/i);
      const certaintyMatch = text.match(/Certitude\s*:\s*([\d.]+)\s*%/i);
      const reasoningMatch = text.match(/Motifs\s*:\s*(.*)/i);
      const questionMatch = text.match(/Question si incertain\s*:\s*(.*)/i);

      if (courseMatch && subjectMatch && certaintyMatch) {
        const courseName = courseMatch[1].trim().replace(/^«|»$/g, '').trim();
        return {
          subject: subjectMatch[1].trim(),
          course: courseName,
          certainty: parseFloat(certaintyMatch[1]),
          reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
          question: questionMatch ? questionMatch[1].trim() : 'Aucune',
        };
      }
      console.warn("Could not parse course classification response:", text);
      return null;

    } catch (error) {
      console.error("Error classifying course:", error);
      throw error;
    }
  },

  generateClassNameFromTranscript: async (transcript: string): Promise<string> => {
    if (!transcript.trim()) return "Untitled Recording";
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on the following lecture transcript, suggest a suitable and concise university-level course name.

For example, if the transcript is about Newton's laws, a good name would be "Introduction to Classical Mechanics".
If it's about the fall of the Roman Empire, suggest "History of Ancient Rome".

Respond with only a JSON object containing "className". The name should be engaging and professional.

---
Transcript:
${transcript.substring(0, 8000)}
---`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              className: {
                type: Type.STRING,
                description: "A suitable, concise course name (e.g., Introduction to Classical Mechanics).",
              },
            },
            required: ["className"],
          },
        },
      });
      const jsonStr = response.text.trim();
      if (jsonStr) {
        const result = JSON.parse(jsonStr);
        return result.className || "Untitled Recording";
      }
      return "Untitled Recording";
    } catch (error) {
      console.error("Error generating class name:", error);
      throw error;
    }
  },

  sendFocusAlertToTeacher: async (className: string): Promise<{ success: boolean }> => {
    const IFTTT_URL = 'https://maker.ifttt.com/trigger/focus_lost/with/key/ftIr665CaYRpyl7KCe1rtzcW2iAt6BNhw-ENNs7G8zU';
    console.log(`[IFTTT] Triggering focus alert for class: ${className}`);
    
    try {
      const response = await fetch(IFTTT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value1: `Focus lost in class: ${className}` }),
      });

      if (response.ok) {
        const responseText = await response.text();
        console.log(`[IFTTT] SUCCESS: Webhook triggered successfully. Response: ${responseText}`);
        return { success: true };
      } else {
        const responseText = await response.text();
        console.error(`[IFTTT] FAILED: Webhook trigger failed with status ${response.status}. Response: ${responseText}`);
        return { success: false };
      }
    } catch (error) {
      console.error("[IFTTT] FAILED: Error sending request to IFTTT.", error);
      return { success: false };
    }
  },

  generateQuiz: async (courseContent: string): Promise<QuizQuestion[]> => {
    if (!courseContent.trim()) return [];
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert educator specializing in creating effective learning assessments. Based on the provided lecture summary, generate a multiple-choice quiz with exactly 5 questions to test a student's understanding of the key concepts.

The output must be a valid JSON array. Each object in the array represents a question and must have the following properties:
- "question": A string containing the question text.
- "options": An array of 4 strings representing the possible answers.
- "correctAnswer": A string that exactly matches one of the values in the "options" array.
- "explanation": A brief string explaining why the correct answer is right.

Ensure the questions cover different aspects of the summary and are challenging but fair.

---
Lecture Summary:
${courseContent}
---`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        },
      });
      const jsonStr = response.text.trim();
      if (jsonStr) {
        const result = JSON.parse(jsonStr);
        return result;
      }
      return [];
    } catch (error) {
      console.error("Error generating quiz:", error);
      throw error;
    }
  },
};