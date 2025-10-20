import { GoogleGenAI, Type } from "@google/genai";
import type { Task, VocabularyItem } from '../types';

console.log('🔑 API Key from env:', process.env.API_KEY ? 'EXISTS' : 'NOT FOUND');

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
                    instruction: { type: Type.STRING }, 
                    type: { type: Type.STRING, enum: ['written', 'oral'] },
                    pageNumber: { type: Type.STRING }, 
                    exerciseNumber: { type: Type.STRING },
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
                                        properties: { 
                                            text: { type: Type.STRING }, 
                                            isAnswer: { type: Type.BOOLEAN } 
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            const isLastAttempt = i === maxRetries - 1;
            const isRetryableError = 
                error?.message?.includes('503') || 
                error?.message?.includes('overloaded') ||
                error?.message?.includes('UNAVAILABLE') ||
                error?.message?.includes('429');

            if (isLastAttempt || !isRetryableError) {
                throw error;
            }

            const delayMs = baseDelay * Math.pow(2, i);
            console.log(`⏳ Попытка ${i + 1}/${maxRetries} не удалась. Повтор через ${delayMs}ms...`);
            await delay(delayMs);
        }
    }
    throw new Error('Max retries reached');
}

export const generateTasksFromText = async (
    userPrompt: string,
    contextText: string,
    imageBase64?: string
): Promise<AIResponse> => {
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    console.log('🤖 generateTasksFromText called');
    console.log('📝 User prompt:', userPrompt);
    console.log('📄 Context text length:', contextText.length);
    console.log('🖼️ Has image:', !!imageBase64);
    
    const contents: any[] = [{ text: `
ТЫ — ИИ-АССИСТЕНТ ПРЕПОДАВАТЕЛЯ. Твоя задача — точно создавать учебные материалы для изучения испанского языка.

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${userPrompt}"
КОНТЕКСТ (текст учебника): 
---
${contextText}
---

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА ДЛЯ ТИПОВ ЗАДАНИЙ:

1. **fill-in-the-blank** (Вставить пропущенное слово):
   - В textParts чередуются обычный текст и пропуски
   - Пропуск обозначается: { "text": "", "isAnswer": true }
   - Пример: [
       { "text": "Él es ", "isAnswer": false },
       { "text": "", "isAnswer": true },
       { "text": ". Ellos son ", "isAnswer": false },
       { "text": "", "isAnswer": true },
       { "text": ".", "isAnswer": false }
     ]
   - НЕ ПИШИ ПРАВИЛЬНЫЕ ОТВЕТЫ В text! Только пустые строки для isAnswer: true

2. **translate** (Перевести на испанский):
   - textParts содержит ТОЛЬКО ОДНУ часть с русским текстом
   - Пример: [{ "text": "Я дома, я доволен.", "isAnswer": false }]
   - НИКОГДА не включай испанский перевод в textParts!
   - Студент сам напишет перевод

3. **plain-text** (Информация или устное задание):
   - Только текст для чтения или устного выполнения
   - Пример: [{ "text": "Прочитайте диалог на странице 35", "isAnswer": false }]

ПРАВИЛА ФОРМАТИРОВАНИЯ:
- Воспроизводи испанский текст точно: á, é, í, ó, ú, ü, ñ, ¿, ¡
- НЕ добавляй нумерацию в text
- Извлекай pageNumber и exerciseNumber из запроса

АНАЛИЗ ЗАПРОСА:
- Если "учить слова" → заполни vocabulary, tasks можно не создавать
- Для остальных → создавай tasks

ПРИМЕРЫ ПРАВИЛЬНЫХ ЗАДАНИЙ:

Пример 1 - fill-in-the-blank:
{
  "instruction": "Образуйте множественное число",
  "type": "written",
  "pageNumber": "36",
  "exerciseNumber": "6",
  "items": [
    {
      "type": "fill-in-the-blank",
      "textParts": [
        { "text": "Él es alemán. Ellos son ", "isAnswer": false },
        { "text": "", "isAnswer": true },
        { "text": ".", "isAnswer": false }
      ]
    }
  ]
}

Пример 2 - translate:
{
  "instruction": "Переведите на испанский язык",
  "type": "written",
  "pageNumber": "36",
  "exerciseNumber": "7",
  "items": [
    {
      "type": "translate",
      "textParts": [
        { "text": "Я дома, я доволен.", "isAnswer": false }
      ]
    },
    {
      "type": "translate",
      "textParts": [
        { "text": "Мы преподаватели, мы из Китая.", "isAnswer": false }
      ]
    }
  ]
}

Пример 3 - oral (устное):
{
  "instruction": "Прочитайте текст и ответьте на вопросы",
  "type": "oral",
  "pageNumber": "37",
  "exerciseNumber": "8",
  "items": [
    {
      "type": "plain-text",
      "textParts": [
        { "text": "Прочитайте текст на странице 37 и устно ответьте на вопросы после текста", "isAnswer": false }
      ]
    }
  ]
}

ПОМНИ: 
- В fill-in-the-blank пропуски ВСЕГДА пустые строки
- В translate ТОЛЬКО русский текст, БЕЗ испанского перевода
- Студент сам заполнит ответы!
` }];

    if (imageBase64) {
        contents.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }

    try {
        console.log('🌐 Calling Gemini API with retry logic...');
        
        const response = await retryWithBackoff(async () => {
            return await ai.models.generateContent({
                model,
                contents: { parts: contents },
                config: { 
                    responseMimeType: "application/json", 
                    responseSchema,
                    temperature: 0.7
                }
            });
        }, 3, 2000);

        console.log('✅ API Response received');
        
        let jsonResponse: AIResponse;
        try {
            jsonResponse = JSON.parse(response.text);
        } catch (parseError) {
            console.error('❌ Failed to parse JSON response:', response.text);
            throw new Error('Получен некорректный ответ от AI. Попробуйте еще раз.');
        }
        
        console.log('📊 Parsed JSON:', jsonResponse);

        const tasks: Task[] = (jsonResponse.tasks || []).map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`,
            status: 'incomplete' as const,
            items: task.items.map(item => ({ ...item, userAnswer: '', userAnswers: [] }))
        }));

        const vocabulary: VocabularyItem[] = (jsonResponse.vocabulary || []).map((item, index) => ({
            ...item,
            id: `vocab-${Date.now()}-${index}`
        }));

        console.log('✅ Final tasks:', tasks);
        console.log('✅ Final vocabulary:', vocabulary);

        return { tasks, vocabulary };

    } catch (error: any) {
        console.error('❌ ERROR in generateTasksFromText:', error);
        
        let errorMessage = 'Не удалось сгенерировать задания.';
        
        if (error?.message?.includes('503') || error?.message?.includes('overloaded')) {
            errorMessage = 'Сервис AI временно перегружен. Пожалуйста, попробуйте через 1-2 минуты.';
        } else if (error?.message?.includes('429')) {
            errorMessage = 'Превышен лимит запросов. Подождите немного и попробуйте снова.';
        } else if (error?.message?.includes('401') || error?.message?.includes('API key')) {
            errorMessage = 'Ошибка API ключа. Проверьте настройки.';
        } else if (error?.message?.includes('400')) {
            errorMessage = 'Некорректный запрос. Попробуйте изменить текст инструкции.';
        } else if (error?.message) {
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
};