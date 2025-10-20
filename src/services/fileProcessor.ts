// All external libraries (mammoth, pdfjs) are loaded from CDN and available on the window object.
declare const window: any;

/**
 * Extracts text from various file types.
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // .docx
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }
    if (file.type === 'application/msword') { // .doc
        return Promise.resolve(`К сожалению, устаревший формат .doc не может быть обработан автоматически. Пожалуйста, пересохраните файл в формате .docx или скопируйте текст вручную.`);
    }
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => 'str' in item ? item.str : '').join(' ') + '\n';
        }
        return text;
    }
    if (file.type.startsWith('text/')) {
        return file.text();
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
            // remove "data:image/jpeg;base64," prefix
            resolve(reader.result.substring(reader.result.indexOf(',') + 1));
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};