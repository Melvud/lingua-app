import { GoogleGenAI, Type } from "@google/genai";
import type { Task, VocabularyItem } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = 'gemini-2.5-flash';

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        tasks: {
            type: Type.ARRAY,
            description: "Список сгенерированных учебных заданий.",
            items: {
                type: Type.OBJECT,
                properties: {
                    instruction: { type: Type.STRING }, type: { type: Type.STRING, enum: ['written', 'oral'] },
                    pageNumber: { type: Type.STRING }, exerciseNumber: { type: Type.STRING },
                    items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['fill-in-the-blank', 'translate', 'plain-text'] },
                                textParts: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: { text: { type: Type.STRING }, isAnswer: { type: Type.BOOLEAN } },
                                        required: ['text', 'isAnswer']
                                    }
                                }
                            },
                            required: ['type', 'textParts']
                        }
                    }
                },
                required: ['instruction', 'type', 'items']
            }
        },
        vocabulary: {
            type: Type.ARRAY,
            description: "Список слов для словаря, если был такой запрос.",
            items: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING, description: "Слово или фраза на испанском." },
                    translation: { type: Type.STRING, description: "Перевод на русский." },
                    context: { type: Type.STRING, description: "Пример использования в предложении из текста." }
                },
                required: ['word', 'translation', 'context']
            }
        }
    }
};

interface AIResponse {
    tasks: Task[];
    vocabulary: VocabularyItem[];
}

export const generateTasksFromText = async (
    userPrompt: string,
    contextText: string,
    imageBase64?: string
): Promise<AIResponse> => {
    
    const contents: any[] = [{ text: `
        ТЫ — ИИ-АССИСТЕНТ ПРЕПОДАВАТЕЛЯ. Твоя задача — точно и аккуратно создавать учебные материалы.

        ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${userPrompt}"
        КОНТЕКСТ (текст с конкретной страницы учебника): 
        ---
        ${contextText}
        ---

        ПРАВИЛА:
        1.  **ТОЧНОСТЬ:** Воспроизводи текст из КОНТЕКСТА **буква в букву**. Особое внимание на испанские символы (á, é, í, ó, ú, ü, ñ, ¿, ¡).
        2.  **АНАЛИЗ ЗАПРОСА:**
            -   Если запрос содержит "учить слова" (например, "учим слова стр 27 упр 5"), твоя главная задача — извлечь из указанного упражнения слова и их перевод. Заполни массив 'vocabulary'. В 'context' добавь предложение, где это слово используется. Задания 'tasks' в этом случае можно не создавать.
            -   Для всех остальных запросов создавай задания в массиве 'tasks', как и раньше.
        3.  **ИЗВЛЕЧЕНИЕ МЕТАДАННЫХ:** Извлеки 'pageNumber' и 'exerciseNumber' из запроса.
        4.  **БЕЗ НУМЕРАЦИИ:** НЕ добавляй нумерацию ("1.", "2.") в поле 'text'.
    ` }];

    if (imageBase64) {
        contents.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts: contents },
            config: { responseMimeType: "application/json", responseSchema }
        });

        const jsonResponse: AIResponse = JSON.parse(response.text);

        const tasks: Task[] = (jsonResponse.tasks || []).map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`,
            status: 'incomplete',
            items: task.items.map(item => ({ ...item, userAnswer: '' }))
        }));

        return { tasks, vocabulary: jsonResponse.vocabulary || [] };

    } catch (error) {
        console.error('Error generating tasks:', error);
        throw new Error("Не удалось сгенерировать задания. Проверьте ваш запрос и попробуйте снова.");
    }
};