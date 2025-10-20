import { GoogleGenAI, Type } from "@google/genai";
import type { Task } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = 'gemini-2.5-flash';

const taskGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        tasks: {
            type: Type.ARRAY,
            description: "Список сгенерированных учебных заданий.",
            items: {
                type: Type.OBJECT,
                properties: {
                    instruction: { type: Type.STRING, description: "Исходная инструкция для всего упражнения (например, 'Вставьте правильный глагол')." },
                    type: { type: Type.STRING, enum: ['written', 'oral'], description: "Тип задания: 'written' для письменных, 'oral' для устных." },
                    items: {
                        type: Type.ARRAY,
                        description: "Список под-заданий внутри одного упражнения.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['fill-in-the-blank', 'translate', 'plain-text'], description: "Тип под-задания." },
                                textParts: {
                                    type: Type.ARRAY,
                                    description: "Массив частей текста. Для 'fill-in-the-blank' чередуются текст и место для ответа.",
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            text: { type: Type.STRING, description: "Часть текста." },
                                            isAnswer: { type: Type.BOOLEAN, description: "True, если эта часть является местом для ввода ответа." }
                                        },
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
        }
    },
    required: ['tasks']
};

export const generateTasksFromText = async (
    userPrompt: string,
    contextText: string,
    imageBase64?: string
): Promise<{ tasks: Task[] }> => {
    
    const contents: any[] = [{ text: `
        Проанализируй запрос пользователя и контекст ниже. Твоя задача — создать учебные задания по испанскому языку в формате JSON.
        
        ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${userPrompt}"
        
        КОНТЕКСТ (текст из учебника или файла): 
        ---
        ${contextText}
        ---

        ПРАВИЛА:
        1.  **Точность:** Создавай задания СТРОГО на основе запроса пользователя. Если в запросе указано "стр 27 упр 5", найди именно это упражнение в контексте и работай только с ним. Не придумывай задания из других частей текста.
        2.  **Структура:** Каждое упражнение должно быть отдельным объектом в массиве 'tasks'.
        3.  **Интерактивность:** Разбей каждое упражнение на под-пункты ('items'). Для заданий типа "вставьте пропущенное слово" ('fill-in-the-blank'), используй массив 'textParts', где чередуется текст и место для ответа (isAnswer: true). Для заданий на перевод используй тип 'translate'.
        4.  **Тип задания:** Определи, является ли задание устным ('oral', например, "прочитайте", "прослушайте") или письменным ('written').
        5.  **Не добавляй ответы.** Поля для ответов должны быть пустыми.
    ` }];

    if (imageBase64) {
        contents.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
            },
        });
    }

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts: contents },
            config: {
                responseMimeType: "application/json",
                responseSchema: taskGenerationSchema,
            },
        });

        const jsonResponse = JSON.parse(response.text);

        const tasks: Task[] = (jsonResponse.tasks || []).map((task: any, index: number) => ({
            ...task,
            id: `task-${Date.now()}-${index}`,
            status: 'incomplete',
            items: task.items.map((item: any) => ({ ...item, userAnswer: '' })) // Initialize userAnswer
        }));

        return { tasks };

    } catch (error) {
        console.error('Error generating tasks:', error);
        throw new Error("Не удалось сгенерировать задания. Проверьте ваш запрос и попробуйте снова.");
    }
};