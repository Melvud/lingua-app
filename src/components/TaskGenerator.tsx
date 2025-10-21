// src/components/TaskGenerator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { generateTasksFromText } from '../services/AIGenerator';
import { extractTextUpToPage, extractTextFromFile, convertImageToBase64 } from '../services/fileProcessor';
import type { Task, VocabularyItem } from '../types';

interface TaskGeneratorProps {
  onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void;
  onNavigateToPage: (page: number) => void;
  sharedFiles: Array<{ name: string; url: string }>;
  sharedInstruction: string;
  onUpdateSharedFiles: (files: File[]) => void;
  onUpdateSharedInstruction: (instruction: string) => void;
}

const TaskGenerator: React.FC<TaskGeneratorProps> = ({
  onGenerateTasks,
  onNavigateToPage,
  sharedFiles,
  sharedInstruction,
  onUpdateSharedFiles,
  onUpdateSharedInstruction,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Синхронизация файлов из sharedData
  useEffect(() => {
    if (sharedFiles && sharedFiles.length > 0) {
      // Это только для отображения имен, не сами File объекты
      const files = sharedFiles.map(f => {
        const file = new File([''], f.name, { type: 'application/octet-stream' });
        return file;
      });
      setUploadedFiles(files);
    }
  }, [sharedFiles]);

  // Синхронизация инструкций из sharedData
  useEffect(() => {
    if (sharedInstruction !== undefined && sharedInstruction !== instruction) {
      setInstruction(sharedInstruction);
    }
  }, [sharedInstruction]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newFiles = [...uploadedFiles, ...files];
      setUploadedFiles(newFiles);
      // ИСПРАВЛЕНО: НЕЛЬЗЯ сохранять File объекты в Firestore.
      // onUpdateSharedFiles(newFiles); // Эта строка вызывала ошибку
      setError('');
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    // ИСПРАВЛЕНО: НЕЛЬЗЯ сохранять File объекты в Firestore.
    // onUpdateSharedFiles(newFiles); // Эта строка вызывала ошибку
  };

  const handleInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInstruction(value);
    onUpdateSharedInstruction(value);
  };

  const getPageNumberFromInstruction = (text: string): number | null => {
    const matches = text.match(/стр(?:аница|\.)?\s*(\d+)/gi);
    if (!matches) return null;
    const lastMatch = matches[matches.length - 1];
    const pageNum = lastMatch.match(/\d+/);
    return pageNum ? parseInt(pageNum[0], 10) : null;
  };

  const handleGenerate = async () => {
    if (uploadedFiles.length === 0 && !instruction.trim()) {
      setError('Пожалуйста, загрузите файлы или введите инструкцию');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let contextText = '';
      let imageBase64: string | undefined;
      
      const lastPageMentioned = getPageNumberFromInstruction(instruction);
      const pdfFile = uploadedFiles.find(f => f.type === 'application/pdf');
      const imageFile = uploadedFiles.find(f => f.type.startsWith('image/'));

      if (pdfFile) {
        if (lastPageMentioned) {
          const readUpToPage = lastPageMentioned + 1;
          console.log(`📚 Reading PDF up to page ${readUpToPage}...`);
          contextText = await extractTextUpToPage(pdfFile, readUpToPage);

          if (!contextText.trim()) {
            setError(`Не удалось извлечь текст из PDF до страницы ${readUpToPage}. Возможно, документ пуст.`);
            setLoading(false);
            return;
          }
        } else {
          setError('Для PDF файла необходимо указать номер страницы в инструкции, чтобы ограничить контекст.');
          setLoading(false);
          return;
        }
      }

      // Обрабатываем изображения
      if (imageFile) {
        imageBase64 = await convertImageToBase64(imageFile);
      }

      // Обрабатываем другие файлы
      for (const file of uploadedFiles.filter(f => f.type !== 'application/pdf' && !f.type.startsWith('image/'))) {
        contextText += await extractTextFromFile(file) + '\n';
      }

      if (!contextText.trim() && !imageBase64) {
        contextText = 'Контекст из файла отсутствует. Создай задания только на основе запроса пользователя.';
      }

      const { tasks, vocabulary } = await generateTasksFromText(
        instruction,
        contextText,
        imageBase64
      );

      if (tasks.length === 0 && vocabulary.length === 0) {
        setError('ИИ не смог сгенерировать задания или слова. Попробуйте уточнить запрос или проверьте страницы в файле.');
      } else {
        onGenerateTasks(tasks, vocabulary);
        
        // Очищаем форму после успешной генерации
        setInstruction('');
        setUploadedFiles([]);
        onUpdateSharedInstruction('');
        // onUpdateSharedFiles([]); // Это тоже не нужно
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err: any) {
      console.error('Error generating tasks:', err);
      setError(err.message || 'Произошла неизвестная ошибка.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageNavigate = () => {
    const pageNumber = parseInt(prompt('Введите номер страницы:') || '1', 10);
    if (!isNaN(pageNumber) && pageNumber > 0) {
      onNavigateToPage(pageNumber);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-3xl">🤖</span>
            Генератор заданий
          </h2>
          <button
            onClick={handlePageNavigate}
            className="text-sm bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Перейти к странице
          </button>
        </div>

        {/* Загрузка файлов */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-600">
          <label className="block mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              📎 Загрузить файлы (PDF, DOCX, изображения)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 mt-2
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300
                cursor-pointer"
            />
          </label>

          {uploadedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Загруженные файлы ({uploadedFiles.length}):
              </p>
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                    📄 {file.name}
                  </span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Поле инструкций */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              💭 Инструкция для ИИ (опционально)
            </span>
            <textarea
              value={instruction}
              onChange={handleInstructionChange}
              placeholder="Например: Создай 3 упражнения по тексту на стр 35-36..."
              className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
              rows={4}
            />
          </label>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Кнопка генерации */}
        <button
          onClick={handleGenerate}
          disabled={loading || (uploadedFiles.length === 0 && !instruction.trim())}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Генерация заданий...
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Создать задания
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          ℹ️ Файлы и инструкции видны обоим участникам пары
        </p>
      </div>
    </div>
  );
};

export default TaskGenerator;