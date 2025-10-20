declare const window: any;

/**
 * Extracts text from a PDF file from the beginning up to a specified page number.
 */
export const extractTextUpToPage = async (file: File, pageLimit: number): Promise<string> => {
    if (file.type !== 'application/pdf') {
        throw new Error('Файл не является PDF.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;

    // Определяем, до какой страницы считывать, но не больше, чем есть в документе
    const lastPageToRead = Math.min(pageLimit, pdf.numPages);
    
    if (pageLimit > pdf.numPages) {
        console.warn(`Запрошенная страница (${pageLimit}) превышает количество страниц в документе (${pdf.numPages}). Будут обработаны все страницы.`);
    }

    let fullText = '';
    for (let i = 1; i <= lastPageToRead; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Собираем текст со страницы и добавляем разделитель для ясности
        const pageText = content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
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
        const result = await window.mammoth.extractRawText({ arrayBuffer });
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
            resolve(reader.result.substring(reader.result.indexOf(',') + 1));
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};