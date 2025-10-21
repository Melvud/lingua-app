// src/components/Tasks.tsx
import React, { useState } from 'react';
// ИСПРАВЛЕНО: Добавлен тип UserAnswersStore
import type { Task, TaskItem, TaskItemPart, UserAnswersStore } from '../types';
import { CheckCircleIcon, PenIcon, TrashIcon } from './Icons';

interface TasksProps {
  tasks: Task[];
  userAnswers: UserAnswersStore; // ИСПРАВЛЕНО: Добавлены ответы пользователя
  onAnswerChange: (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => void;
  onCompleteTask: (taskId: string) => void;
  onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
  onDeleteTask: (taskId: string) => void; 
}

const TaskCard: React.FC<{
  task: Task;
  userAnswers: UserAnswersStore; // ИСПРАВЛЕНО: Добавлены ответы пользователя
  onAnswerChange: (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => void;
  onCompleteTask: (taskId: string) => void;
  onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
  onDeleteTask: (taskId: string) => void; 
}> = ({ task, userAnswers, onAnswerChange, onCompleteTask, onTaskItemTextChange, onDeleteTask }) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const isCompleted = task.status === 'completed';

  const handleDelete = () => {
    if (window.confirm(`Вы уверены, что хотите удалить задание "${task.instruction}"?`)) {
      onDeleteTask(task.id);
    }
  };

  const handleTextSave = (itemIndex: number, newText: string) => {
    const placeholder = '[ответ]';
    const parts = newText.split(placeholder);
    const newTextParts: TaskItemPart[] = [];
    parts.forEach((part, index) => {
      newTextParts.push({ text: part, isAnswer: false });
      if (index < parts.length - 1) {
        newTextParts.push({ text: '', isAnswer: true });
      }
    });
    onTaskItemTextChange(task.id, itemIndex, newTextParts);
  };

  const renderTaskItem = (item: TaskItem, index: number) => {
    const currentItemId = `${task.id}-${index}`;
    const isEditing = editingItemId === currentItemId;

    // Устные задания - только текст
    if (task.type === 'oral') {
      return (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-gray-800 dark:text-gray-200">{item.textParts.map(p => p.text).join('')}</p>
        </div>
      );
    }

    // Редактирование текста задания
    if (isEditing) {
      return (
        <input
          type="text"
          defaultValue={item.textParts.map(p => (p.isAnswer ? '[ответ]' : p.text)).join('')}
          onBlur={(e) => {
            handleTextSave(index, e.target.value);
            setEditingItemId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          autoFocus
          className="flex-grow bg-gray-100 dark:bg-gray-900 border-b-2 border-blue-500 outline-none px-2 py-1"
        />
      );
    }

    // Задание с переводом
    if (item.type === 'translate') {
      const russianText = item.textParts[0]?.text || '';
      // ИСПРАВЛЕНО: Значение берется из userAnswers
      const userAnswer = userAnswers[task.id]?.[index]?.userAnswer || '';
      return (
        <div className="space-y-2">
          <p className="text-gray-800 dark:text-gray-200 font-medium">{russianText}</p>
          <textarea
            value={userAnswer}
            onChange={(e) => onAnswerChange(task.id, index, e.target.value)}
            disabled={isCompleted}
            placeholder="Ваш перевод на испанском..."
            className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            rows={3}
          />
        </div>
      );
    }

    // Задание с пропусками
    if (item.type === 'fill-in-the-blank') {
      let answerIndex = 0;
      return (
        <div className="flex-grow flex flex-wrap items-baseline">
          {item.textParts.map((part, partIndex) => {
            if (part.isAnswer) {
              const currentAnswerIndex = answerIndex++;
              // ИСПРАВЛЕНО: Значение берется из userAnswers
              const userAnswer = userAnswers[task.id]?.[index]?.userAnswers?.[currentAnswerIndex] || '';
              return (
                <input
                  key={partIndex}
                  type="text"
                  value={userAnswer}
                  onChange={(e) => onAnswerChange(task.id, index, e.target.value, currentAnswerIndex)}
                  disabled={isCompleted}
                  placeholder="..."
                  className="inline-block w-32 mx-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-500 focus:border-blue-500 outline-none px-2 py-1 disabled:opacity-50"
                />
              );
            }
            return <span key={partIndex}>{part.text}</span>;
          })}
        </div>
      );
    }

    // Plain text
    return <p className="text-gray-800 dark:text-gray-200">{item.textParts.map(p => p.text).join('')}</p>;
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${
        isCompleted ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'
      } shadow-md`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{task.instruction}</h3>
        {(task.pageNumber || task.exerciseNumber) && (
          <span className="text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full flex-shrink-0 ml-2">
            Стр. {task.pageNumber || '—'}, Упр. {task.exerciseNumber || '—'}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {task.items.map((item, index) => {
          const currentItemId = `${task.id}-${index}`;
          const isEditing = editingItemId === currentItemId;

          if (task.type === 'oral') {
            return <div key={index}>{renderTaskItem(item, index)}</div>;
          }

          return (
            <div key={currentItemId} className="pl-3 border-l-2 border-gray-200 dark:border-gray-600">
              <div className="flex items-center group text-base">
                <span className="mr-2 text-gray-500 font-medium">{index + 1}.</span>
                {renderTaskItem(item, index)}
                {!isCompleted && item.type !== 'translate' && (
                  <button
                    onClick={() => setEditingItemId(isEditing ? null : currentItemId)}
                    className="ml-2 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Редактировать"
                  >
                    <PenIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {task.type !== 'oral' && (
        <div className="mt-4 flex justify-end items-center gap-2">
          <button
            onClick={handleDelete}
            className="bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-md text-sm hover:bg-red-200 transition-colors flex items-center gap-2"
            title="Удалить задание"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => onCompleteTask(task.id)}
            disabled={isCompleted}
            className="bg-green-500 text-white font-semibold py-2 px-4 rounded-md text-sm hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isCompleted ? (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                Завершено
              </>
            ) : (
              'Завершить задание'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

const Tasks: React.FC<TasksProps> = ({ tasks, userAnswers, onAnswerChange, onCompleteTask, onTaskItemTextChange, onDeleteTask }) => {
  const writtenTasks = tasks.filter((t) => t.type === 'written');
  const completedCount = writtenTasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow overflow-y-auto space-y-4 pr-2">
        {tasks.length > 0 && writtenTasks.length > 0 && (
          <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 py-2 z-10 mb-2">
            <div className="text-right text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 pr-2">
              Выполнено письменных: {completedCount} из {writtenTasks.length}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${writtenTasks.length > 0 ? (completedCount / writtenTasks.length) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            userAnswers={userAnswers} // ИСПРАВЛЕНО: Передаем ответы
            onAnswerChange={onAnswerChange}
            onCompleteTask={onCompleteTask}
            onTaskItemTextChange={onTaskItemTextChange}
            onDeleteTask={onDeleteTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-6 mb-4">
              <svg className="w-16 h-16 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Нет заданий</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
              Загрузите файлы и создайте задания с помощью генератора выше
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;