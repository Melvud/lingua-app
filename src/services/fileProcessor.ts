declare const window: any;

/**
 * Extracts text from a specific page of a PDF file.
 */
export const extractTextFromPdfPage = async (file: File, pageNumber: number): Promise<string> => {
    if (file.type !== 'application/pdf') {
        throw new Error('Файл не является PDF.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;

    if (pageNumber > pdf.numPages || pageNumber < 1) {
        throw new Error(`Неверный номер страницы. В документе всего ${pdf.numPages} страниц.`);
    }

    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item: any) => 'str' in item ? item.str : '').join(' ');
};

/**
 * Extracts text from various file types (excluding PDF page-specific logic).
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
    // PDF processing is now handled by extractTextFromPdfPage
    if (file.type === 'application/pdf') {
        return "Для работы с PDF укажите номер страницы в запросе.";
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