// src/components/TaskGenerator.tsx
import React, { useState, useRef, useEffect } from 'react';
// Импортируем функцию с кэшированием
import { getCachedOrGenerateTasks } from '../services/AIGenerator'; 
import { extractTextUpToPage, extractTextFromFile, convertImageToBase64 } from '../services/fileProcessor';
import type { Task, VocabularyItem } from '../types';

// Импорты для работы с Firebase Storage и Firestore
import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';


interface TaskGeneratorProps {
  onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void;
  onNavigateToPage: (page: number) => void;
  sharedFiles: Array<{ name: string; url: string }>;
  sharedInstruction: string;
  onUpdateSharedFiles: (files: File[]) => void;
  onUpdateSharedInstruction: (instruction: string) => void;
}

// Интерфейс для учебника из Firestore
interface Textbook {
  id: string;
  fileName: string;
  downloadURL: string;
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
  
  // Состояния для библиотеки учебников
  const [availableTextbooks, setAvailableTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<string | null>(null);
  const [loadingTextbooks, setLoadingTextbooks] = useState(false);

  // Синхронизация инструкций из sharedData
  useEffect(() => {
    if (sharedInstruction !== undefined && sharedInstruction !== instruction) {
      setInstruction(sharedInstruction);
    }
  }, [sharedInstruction]);
  
  // Загрузка списка учебников из Firestore при первом рендере
  useEffect(() => {
    const fetchTextbooks = async () => {
      setLoadingTextbooks(true);
      try {
        // Запрос к Firestore, отсортированный по дате
        const q = query(collection(db, "textbooks"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const books = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Textbook));
        setAvailableTextbooks(books);
      } catch (err: any) {
        console.error("Ошибка загрузки учебников:", err);
        // Эта ошибка возникала из-за отсутствия индекса Firestore
        setError("Не удалось загрузить библиотеку учебников. Проверьте индексы Firestore.");
      }
      setLoadingTextbooks(false);
    };
    fetchTextbooks();
  }, []);

  // Обработчик загрузки локальных файлов
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Сбрасываем выбор из библиотеки, если загружаем новый файл
      setSelectedTextbookId(null);
      const newFiles = [...uploadedFiles, ...files];
      setUploadedFiles(newFiles);
      setError('');
    }
  };

  // Обработчик удаления локального файла из списка
  const handleRemoveFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
  };
  
  // Сохранение PDF в библиотеку (Storage + Firestore)
  const handleSaveToLibrary = async (file: File, index: number) => {
    setLoading(true);
    setError('');
    try {
        // 1. Загружаем файл в Firebase Storage
        const storagePath = `textbooks/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // 2. Сохраняем метаданные в Firestore
        const docRef = await addDoc(collection(db, 'textbooks'), {
            fileName: file.name,
            storagePath: storagePath,
            downloadURL: downloadURL,
            createdAt: serverTimestamp(), // Используем серверное время
        });
        
        // 3. Обновляем UI (добавляем новую книгу в начало списка)
        setAvailableTextbooks(prev => [{ id: docRef.id, fileName: file.name, downloadURL }, ...prev]);
        
        // 4. Удаляем файл из локальной загрузки
        handleRemoveFile(index);
        
        // 5. Сразу выбираем этот учебник
        setSelectedTextbookId(docRef.id);

    } catch (err: any) {
        console.error("Ошибка сохранения в библиотеку:", err);
        setError("Не удалось сохранить файл в библиотеку: " + err.message);
    }
    setLoading(false);
  };
  
  // Обработчик выбора учебника из выпадающего списка
  const handleSelectTextbook = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const bookId = e.target.value;
      if (bookId) {
          setSelectedTextbookId(bookId);
          // Очищаем локальные файлы, если выбрали из библиотеки
          setUploadedFiles([]); 
      } else {
          setSelectedTextbookId(null);
      }
  };

  // Обработчик изменения текста инструкции
  const handleInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInstruction(value);
    onUpdateSharedInstruction(value);
  };

  // Функция-парсер для извлечения номера страницы
  const getPageNumberFromInstruction = (text: string): number | null => {
    const matches = text.match(/стр(?:аница|\.)?\s*(\d+)/gi);
    if (!matches) return null;
    const lastMatch = matches[matches.length - 1];
    const pageNum = lastMatch.match(/\d+/);
    return pageNum ? parseInt(pageNum[0], 10) : null;
  };

  // ГЛАВНАЯ ФУНКЦИЯ: Генерация заданий
  const handleGenerate = async () => {
    // Валидация: нужен либо файл, либо инструкция
    if (uploadedFiles.length === 0 && !instruction.trim() && !selectedTextbookId) {
      setError('Пожалуйста, загрузите файлы, выберите учебник или введите инструкцию');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let contextText = '';
      let imageBase64: string | undefined;
      
      const lastPageMentioned = getPageNumberFromInstruction(instruction);
      
      let pdfFile: File | undefined;

      // ---------------------------------------------
      // 1. ОПРЕДЕЛЯЕМ ИСТОЧНИК PDF
      // ---------------------------------------------
      if (selectedTextbookId) {
        // Сценарий 1: Учебник выбран из библиотеки
        console.log("📚 Загружаем PDF из Firebase Storage...");
        const book = availableTextbooks.find(b => b.id === selectedTextbookId);
        if (!book) throw new Error("Выбранный учебник не найден.");
        
        // Загружаем файл по URL из Storage
        const response = await fetch(book.downloadURL);
        if (!response.ok) throw new Error(`Не удалось загрузить учебник: ${response.statusText}`);
        
        const blob = await response.blob();
        
        // "Восстанавливаем" File объект, который ожидает `extractTextUpToPage`
        pdfFile = new File([blob], book.fileName, { type: 'application/pdf' });

      } else {
        // Сценарий 2: Файл загружен локально
        pdfFile = uploadedFiles.find(f => f.type === 'application/pdf');
      }
      
      // Ищем локально загруженное изображение
      const imageFile = uploadedFiles.find(f => f.type.startsWith('image/'));

      // ---------------------------------------------
      // 2. ИЗВЛЕКАЕМ ТЕКСТ ИЗ ФАЙЛОВ
      // ---------------------------------------------
      
      // Обработка PDF
      if (pdfFile) {
        if (lastPageMentioned) {
          // +1, т.к. extractTextUpToPage не включает последнюю страницу
          const readUpToPage = lastPageMentioned + 1; 
          console.log(`📚 Reading PDF up to page ${readUpToPage}...`);
          contextText = await extractTextUpToPage(pdfFile, readUpToPage);

          if (!contextText.trim()) {
            setError(`Не удалось извлечь текст из PDF до страницы ${readUpToPage}. Возможно, документ пуст или страницы зашифрованы.`);
            setLoading(false);
            return;
          }
        } else {
          setError('Для PDF файла необходимо указать номер страницы в инструкции (например, "стр 35"), чтобы ограничить контекст.');
          setLoading(false);
          return;
        }
      }

      // Обработка изображений
      if (imageFile) {
        imageBase64 = await convertImageToBase64(imageFile);
      }

      // Обработка других файлов (например, .docx, .txt)
      for (const file of uploadedFiles.filter(f => f.type !== 'application/pdf' && !f.type.startsWith('image/'))) {
        contextText += await extractTextFromFile(file) + '\n';
      }

      // Если контекста нет, ИИ будет работать только по инструкции
      if (!contextText.trim() && !imageBase64) {
        contextText = 'Контекст из файла отсутствует. Создай задания только на основе запроса пользователя.';
      }

      // ---------------------------------------------
      // 3. ВЫЗЫВАЕМ ИИ С КЭШИРОВАНИЕМ
      // ---------------------------------------------
      const { tasks, vocabulary } = await getCachedOrGenerateTasks(
        instruction,
        contextText,
        imageBase64
      );

      // ---------------------------------------------
      // 4. ОБРАБАТЫВАЕМ РЕЗУЛЬТАТ
      // ---------------------------------------------
      if (tasks.length === 0 && vocabulary.length === 0) {
        setError('ИИ не смог сгенерировать задания или слова. Попробуйте уточнить запрос или проверьте страницы в файле.');
      } else {
        onGenerateTasks(tasks, vocabulary);
        
        // Очищаем форму после успешной генерации
        setInstruction('');
        setUploadedFiles([]);
        setSelectedTextbookId(null); // Сбрасываем выбор учебника
        onUpdateSharedInstruction('');
        
        // Очищаем input[type=file]
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

  // Навигация по страницам (для Textbook.tsx)
  const handlePageNavigate = () => {
    const pageNumber = parseInt(prompt('Введите номер страницы:') || '1', 10);
    if (!isNaN(pageNumber) && pageNumber > 0) {
      onNavigateToPage(pageNumber);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Заголовок и кнопка "Перейти к странице" */}
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
        
        {/* Блок: Выбор учебника из библиотеки */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              📚 Выбрать учебник из библиотеки
            </span>
            <select
              value={selectedTextbookId || ''}
              onChange={handleSelectTextbook}
              disabled={loadingTextbooks || uploadedFiles.length > 0 || loading}
              className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">{loadingTextbooks ? "Загрузка..." : "-- Загрузить новый файл --"}</option>
              {availableTextbooks.map(book => (
                <option key={book.id} value={book.id}>
                  {book.fileName}
                </option>
              ))}
            </select>
          </label>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          ИЛИ
        </p>

        {/* Блок: Загрузка новых файлов */}
        <div 
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 ${selectedTextbookId ? 'opacity-50' : ''}`}
        >
          <label className="block mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              📎 Загрузить новые файлы (PDF, DOCX, изображения)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={!!selectedTextbookId || loading} // Блокируем, если выбран учебник
              className="block w-full text-sm text-gray-500 dark:text-gray-400 mt-2
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300
                cursor-pointer disabled:cursor-not-allowed"
            />
          </label>

          {/* Список загруженных локально файлов */}
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
                  <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                    {/* Кнопка "Сохранить в библиотеку" (только для PDF) */}
                    {file.type === 'application/pdf' && (
                      <button
                        onClick={() => handleSaveToLibrary(file, index)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                        title="Сохранить в библиотеку"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                    )}
                    {/* Кнопка "Удалить" */}
                    <button
                      onClick={() => handleRemoveFile(index)}
                      disabled={loading}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Поле для инструкций */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              💭 Инструкция для ИИ (обязательно для PDF)
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

        {/* Блок для вывода ошибок */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Кнопка "Создать задания" */}
        <button
          onClick={handleGenerate}
          disabled={loading || (uploadedFiles.length === 0 && !instruction.trim() && !selectedTextbookId)}
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
              {selectedTextbookId ? "Загрузка учебника..." : "Генерация заданий..."}
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