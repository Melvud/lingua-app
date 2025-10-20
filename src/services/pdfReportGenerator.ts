import type { Task } from '../types';

declare const window: any;

export const generatePdfReport = (tasks: Task[]): void => {
    console.log('📄 ========== PDF GENERATION START ==========');
    console.log('📋 Received tasks:', tasks);
    console.log('📋 Tasks count:', tasks.length);
    
    try {
        // Шаг 1: Получаем jsPDF
        console.log('Step 1: Getting jsPDF constructor...');
        let jsPDF: any = null;
        
        if (window.jspdf && window.jspdf.jsPDF) {
            console.log('✅ Found at window.jspdf.jsPDF');
            jsPDF = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
            console.log('✅ Found at window.jsPDF');
            jsPDF = window.jsPDF;
        } else {
            console.error('❌ jsPDF not found anywhere!');
            console.log('Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('pdf')));
            throw new Error("jsPDF библиотека не найдена");
        }

        // Шаг 2: Создаем документ
        console.log('Step 2: Creating PDF document...');
        const doc = new jsPDF();
        console.log('✅ Document created:', doc);
        
        // Шаг 3: Проверяем autoTable
        console.log('Step 3: Checking autoTable...');
        console.log('doc.autoTable type:', typeof doc.autoTable);
        console.log('doc.autoTable:', doc.autoTable);
        
        if (typeof doc.autoTable !== 'function') {
            console.error('❌ autoTable is not a function!');
            console.log('Available doc methods:', Object.keys(doc).filter(k => typeof doc[k] === 'function'));
            throw new Error("autoTable plugin не найден");
        }
        console.log('✅ autoTable is available');

        // Шаг 4: Добавляем заголовок (БЕЗ КАСТОМНОГО ШРИФТА)
        console.log('Step 4: Adding header...');
        doc.setFont('helvetica'); // Используем стандартный шрифт
        doc.setFontSize(18);
        doc.text('Отчет о выполненных заданиях', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Студент: Рафаэль', 14, 35);
        doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 14, 42);
        console.log('✅ Header added');

        // Шаг 5: Подготовка данных (УПРОЩЕННАЯ)
        console.log('Step 5: Preparing table data...');
        const tableData: string[][] = [];
        
        tasks.forEach((task, taskIdx) => {
            console.log(`Processing task ${taskIdx + 1}/${tasks.length}:`, task.instruction);
            
            task.items.forEach((item, itemIdx) => {
                console.log(`  Processing item ${itemIdx + 1}:`, item.type);
                
                let taskTitle = task.instruction || 'Без названия';
                let itemContent = 'Нет содержимого';
                let userAnswer = 'Нет ответа';
                
                // Упрощенная обработка
                try {
                    if (item.type === 'fill-in-the-blank') {
                        const text = item.textParts?.map(p => p.text || '').join('') || '';
                        itemContent = text.substring(0, 100); // Ограничиваем длину
                        const answers = item.userAnswers?.filter(a => a?.trim()).join(', ');
                        userAnswer = answers || 'Нет ответа';
                    } else if (item.type === 'translate') {
                        itemContent = item.textParts?.[0]?.text?.substring(0, 100) || '';
                        userAnswer = item.userAnswer?.substring(0, 100) || 'Нет ответа';
                    }
                } catch (err) {
                    console.error('Error processing item:', err);
                    itemContent = 'Ошибка обработки';
                }
                
                // Добавляем в таблицу
                const row = [
                    itemIdx === 0 ? taskTitle : '',
                    itemContent,
                    userAnswer
                ];
                
                console.log(`  Adding row:`, row);
                tableData.push(row);
            });
        });

        console.log('📊 Total table rows:', tableData.length);
        console.log('📊 Table data sample:', tableData.slice(0, 2));

        // Шаг 6: Создаем таблицу (МИНИМАЛЬНЫЕ настройки)
        console.log('Step 6: Creating table...');
        
        try {
            doc.autoTable({
                startY: 55,
                head: [['Задание', 'Содержание', 'Ответ']],
                body: tableData,
                theme: 'grid',
                styles: {
                    font: 'helvetica',
                    fontSize: 10,
                    cellPadding: 3
                },
                headStyles: {
                    fillColor: [41, 128, 185]
                }
            });
            console.log('✅ Table created successfully');
        } catch (tableError) {
            console.error('❌ Error creating table:', tableError);
            throw new Error(`Ошибка создания таблицы: ${tableError instanceof Error ? tableError.message : 'Unknown'}`);
        }

        // Шаг 7: Сохраняем файл
        console.log('Step 7: Saving PDF...');
        const filename = `отчет-${Date.now()}.pdf`;
        console.log('Filename:', filename);
        
        doc.save(filename);
        console.log('✅ PDF saved successfully');
        console.log('📄 ========== PDF GENERATION END ==========');
        
    } catch (error) {
        console.error('❌ ========== PDF GENERATION FAILED ==========');
        console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Error message:', error instanceof Error ? error.message : String(error));
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        
        // Пробрасываем ошибку дальше
        throw error;
    }
};