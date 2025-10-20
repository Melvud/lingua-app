import type { Task } from '../types';
import { FONT_DATA_URL } from '../utils/fonts';

declare const window: any;

const loadFont = (): string => {
    if (!FONT_DATA_URL || !FONT_DATA_URL.includes(',')) return '';
    return FONT_DATA_URL.split(',')[1];
};

export const generatePdfReport = (tasks: Task[]): void => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        console.error("jsPDF not loaded");
        return;
    }

    const doc = new jsPDF();
    const fontBase64 = loadFont();
    if (fontBase64) {
        doc.addFileToVFS('PTSans-Regular.ttf', fontBase64);
        doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal');
        doc.setFont('PTSans');
    } else {
        console.warn("Font could not be loaded for PDF.");
    }

    doc.setFontSize(18);
    doc.text('Отчет о выполненных заданиях', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Студент: Рафаэль`, 14, 35);
    doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 14, 42);

    let y = 60;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    tasks.forEach((task, taskIndex) => {
        if (y > pageHeight - margin * 2) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(14);
        doc.setFont('PTSans', 'normal');
        doc.setTextColor(40);
        
        const taskTitle = `Задание ${taskIndex + 1}: ${task.instruction}`;
        const titleLines = doc.splitTextToSize(taskTitle, 180);
        doc.text(titleLines, 14, y);
        y += titleLines.length * 7 + 5;
        
        doc.setDrawColor(200);
        doc.line(14, y - 3, 196, y - 3);


        task.items.forEach((item, itemIndex) => {
             if (y > pageHeight - margin) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(12);

            if (item.type === 'fill-in-the-blank') {
                const text = item.textParts?.map(p => p.isAnswer ? `[ ${item.userAnswer || '...'} ]` : p.text).join('') || '';
                const itemLines = doc.splitTextToSize(`${itemIndex + 1}. ${text}`, 170);
                doc.text(itemLines, 20, y);
                y += itemLines.length * 7 + 4;
            } else if (item.type === 'translate') {
                const sourceText = `Исходный текст: "${item.textParts?.[0].text}"`;
                const answerText = `Ваш перевод: ${item.userAnswer || 'Нет ответа'}`;
                
                const sourceLines = doc.splitTextToSize(sourceText, 170);
                doc.text(sourceLines, 20, y);
                y += sourceLines.length * 7 + 1;
                
                const answerLines = doc.splitTextToSize(answerText, 170);
                doc.text(answerLines, 20, y);
                y += answerLines.length * 7 + 4;
            }
        });
        
        y += 10; // Space between tasks
    });


    doc.save('co-study-hub-report-final.pdf');
};