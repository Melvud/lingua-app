import type { Task } from '../types';
import { FONT_DATA_URL } from '../utils/fonts';

declare const window: any;

const loadFont = (): string => {
    if (!FONT_DATA_URL || !FONT_DATA_URL.includes(',')) return '';
    return FONT_DATA_URL.split(',')[1];
};

export const generatePdfReport = (tasks: Task[]): void => {
    try {
        const { jsPDF } = window.jspdf;
        
        if (!jsPDF) {
            throw new Error("jsPDF not loaded");
        }

        const doc = new jsPDF();
        
        // Загрузка шрифта
        const fontBase64 = loadFont();
        if (fontBase64) {
            try {
                doc.addFileToVFS('Arimo-Regular.ttf', fontBase64);
                doc.addFont('Arimo-Regular.ttf', 'Arimo', 'normal');
                doc.setFont('Arimo');
            } catch (fontError) {
                console.warn("Font could not be loaded, using default font:", fontError);
                doc.setFont('helvetica');
            }
        } else {
            doc.setFont('helvetica');
        }

        // Заголовок
        doc.setFontSize(18);
        doc.text('Отчет о выполненных заданиях', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Студент: Рафаэль`, 14, 35);
        doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 14, 42);

        // Подготовка данных для таблицы
        const tableData = tasks.flatMap((task) => 
            task.items.map((item, itemIndex) => {
                let itemContent = '';
                let userAnswerContent = item.userAnswer || 'Нет ответа';
                
                let taskTitle = task.instruction;
                if (task.pageNumber || task.exerciseNumber) {
                    taskTitle = `(Стр. ${task.pageNumber || '–'}, Упр. ${task.exerciseNumber || '–'}) ${task.instruction}`;
                }

                switch (item.type) {
                    case 'fill-in-the-blank':
                        itemContent = item.textParts?.map(p => p.isAnswer ? `[ ... ]` : p.text).join('') || '';
                        break;
                    case 'translate':
                        itemContent = `Перевести: "${item.textParts?.[0]?.text || ''}"`;
                        break;
                    case 'plain-text':
                        itemContent = item.textParts?.map(p => p.text).join('\n') || '';
                        if (task.type === 'oral') {
                           userAnswerContent = `(Устное задание)`;
                        }
                        break;
                    default:
                        itemContent = 'Неизвестный тип задания';
                }
                
                const finalTitle = itemIndex === 0 ? taskTitle : '';

                return [finalTitle, itemContent, userAnswerContent];
            })
        );

        // Проверка наличия autoTable
        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: 55,
                head: [['Задание', 'Содержание', 'Ответ студента']],
                body: tableData,
                theme: 'grid',
                styles: {
                    font: fontBase64 ? 'Arimo' : 'helvetica',
                    cellPadding: 3,
                    fontSize: 10,
                },
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                    fontStyle: 'bold',
                },
                columnStyles: {
                    0: { cellWidth: 70 }, 
                    1: { cellWidth: 65 }, 
                    2: { cellWidth: 'auto' }, 
                },
            });
        } else {
            throw new Error("autoTable plugin not available");
        }

        doc.save('co-study-hub-report-final.pdf');
        
    } catch (error) {
        console.error('Detailed PDF generation error:', error);
        alert(`Ошибка при генерации PDF: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}. Проверьте консоль для деталей.`);
    }
};