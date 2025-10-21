// src/services/fileProcessor.ts
import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import mammoth from 'mammoth';

// ИСПРАВЛЕНО: Настраиваем воркер ИЗОЛИРОВАННО, используя версию из import'а.
// Это предотвращает конфликт версий с 'react-pdf' (который использует Textbook.tsx)
// pdfjsLib.version будет та, что у вас в package-lock.json (например, 4.4.168)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;


/**
 * Extracts text from a PDF file from the beginning up to a specified page number.
 */
export const extractTextUpToPage = async (file: File, pageLimit: number): Promise<string> => {
    if (file.type !== 'application/pdf') {
        throw new Error('Файл не является PDF.');
    }
    const arrayBuffer = await file.arrayBuffer();

    // ИСПРАВЛЕНО: Используем импортированный 'pdfjsLib', а не 'window.pdfjsLib'
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    // Определяем, до какой страницы считывать, но не больше, чем есть в документе
    const lastPageToRead = Math.min(pageLimit, pdf.numPages);
    
    if (pageLimit > pdf.numPages) {
        console.warn(`Запрошенная страница (${pageLimit}) превышает количество страниц в документе (${pdf.numPages}). Будут обработаны все страницы.`);
    }

    let fullText = '';
    for (let i = 1; i <= lastPageToRead; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        // ИСПРАВЛЕНО: Правильная типизация для 'item'
        const pageText = content.items.map((item) => (item as TextItem).str).join(' ');
        fullText += `--- START PAGE ${i} ---\n${pageText}\n--- END PAGE ${i} ---\n\n`;
    }

    return fullText;
};

/**
 * Extracts text from various file types (e.g., .docx, .txt).
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // .docx
        const arrayBuffer = await file.arrayBuffer();
        // ИСПРАВЛЕНО: Используем импортированный 'mammoth', а не 'window.mammoth'
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }
    if (file.type.startsWith('text/')) {
        return file.text();
    }
    if (file.type === 'application/pdf') {
        // PDF теперь обрабатывается через extractTextUpToPage
        return "Для работы с PDF укажите номер страницы в запросе, чтобы определить диапазон сканирования.";
    }
    throw new Error('Неподдерживаемый тип файла.');
};


export const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
             if (typeof reader.result !== 'string') {
                return reject(new Error('Could not read file as data URL.'));
            }
            // Убираем префикс data:*/*;base64,
            resolve(reader.result.substring(reader.result.indexOf(',') + 1));
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};