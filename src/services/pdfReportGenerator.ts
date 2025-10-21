/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Современный, структурированный PDF-отчёт на jsPDF.
 * (Версия с исправлениями для никнейма).
 */

import type { Task } from '../types';
import { FONT_DATA_URL } from '../utils/fonts';

declare const window: any;

/* =========================
 * ШРИФТЫ
 * ========================= */

function getJsPDFCtor(): any {
  const ctor =
    (window && window.jspdf && window.jspdf.jsPDF) ||
    (window && window.jsPDF);
  if (!ctor) {
    throw new Error(
      'jsPDF не найден. Убедитесь, что UMD-скрипт jsPDF подключён до React (index.html).'
    );
  }
  return ctor;
}

function extractTtfBase64(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('FONT_DATA_URL должен быть data:URL с TTF (data:...;base64,...)');
  }
  const okMime =
    dataUrl.startsWith('data:font/ttf') ||
    dataUrl.startsWith('data:application/x-font-ttf') ||
    dataUrl.startsWith('data:application/font-sfnt') ||
    dataUrl.startsWith('data:application/octet-stream');
  if (!okMime) {
    throw new Error('В FONT_DATA_URL обнаружен не TTF. Ожидается TTF base64.');
  }
  const marker = 'base64,';
  const i = dataUrl.indexOf(marker);
  if (i === -1) throw new Error('FONT_DATA_URL должен содержать сегмент ";base64,".');
  return dataUrl.slice(i + marker.length);
}

function registerArimoFont(doc: any): void {
  const arimoB64 = extractTtfBase64(FONT_DATA_URL);
  (doc as any).addFileToVFS('Arimo-Regular.ttf', arimoB64);
  (doc as any).addFont('Arimo-Regular.ttf', 'Arimo', 'normal');
}

/* =========================
 * УТИЛИТЫ ВЁРСТКИ
 * ========================= */

type RenderContext = {
  doc: any;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  cursorY: number;
  baseFontSize: number;
  lineHeight: number;
};

function letterIndex(n: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + n);
}

function ensurePageSpace(ctx: RenderContext, needed: number) {
  if (ctx.cursorY + needed > ctx.pageHeight - ctx.margin) {
    ctx.doc.addPage();
    ctx.doc.setFont('Arimo', 'normal');
    ctx.cursorY = renderHeader(ctx.doc, ctx.margin);
  }
}

function wrapText(doc: any, text: string, maxWidth: number, lineHeight: number) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  return { lines, height: lines.length * lineHeight };
}

function drawLines(doc: any, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line: string, i: number) => doc.text(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function drawSentenceWithInlineAnswers(
  ctx: RenderContext,
  parts: Array<{ text: string; isAnswer?: boolean }>,
  answersSource: { userAnswers?: string[]; userAnswer?: string },
  x: number,
  y: number
) {
  const { doc, contentWidth, lineHeight, baseFontSize } = ctx;

  let ansIdx = 0;
  const tokens: Array<{ text: string; isAnswer?: boolean }> = [];
  const answers = answersSource.userAnswers ?? (
    typeof answersSource.userAnswer === 'string' && answersSource.userAnswer.length
      ? [answersSource.userAnswer]
      : []
  );

  parts.forEach((p) => {
    if (p?.isAnswer) {
      const a = (answers[ansIdx] ?? '_____');
      ansIdx++;
      tokens.push({ text: a.length ? a : '_____', isAnswer: true });
    } else if (p?.text) {
      const words = p.text.split(/(\s+)/).filter(Boolean);
      words.forEach((w) => tokens.push({ text: w }));
    }
  });

  let cx = x;
  let cy = y;
  const maxX = x + contentWidth;

  tokens.forEach((t) => {
    const isAns = !!t.isAnswer;
    const text = t.text;

    const fs = baseFontSize;
    doc.setFontSize(fs);

    const tw = doc.getTextWidth(text);

    if (cx + tw > maxX && text.trim().length > 0) {
      cx = x;
      cy += lineHeight;
    }

    if (isAns) {
      doc.setTextColor(14, 53, 120); // спокойный синий
      doc.text(text, cx, cy);
      doc.setTextColor(0, 0, 0);
      cx += tw;
    } else {
      doc.text(text, cx, cy);
      cx += tw;
    }
  });

  return cy + lineHeight;
}

/* =========================
 * ХЕДЕР И НУМЕРАЦИЯ
 * ========================= */

function renderHeader(doc: any, margin: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const barH = 16;

  doc.setFillColor(242, 244, 248);
  doc.setDrawColor(225, 229, 235);
  doc.roundedRect(margin, margin, pageWidth - margin * 2, barH, 3, 3, 'FD');

  const titleX = margin + 6;
  const titleY = margin + 5 + 6;
  doc.setFont('Arimo', 'normal');
  doc.setFontSize(16);
  doc.text('Итоговый отчёт по заданиям', titleX, titleY);

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  const dateStr = new Date().toLocaleString();
  doc.text(dateStr, pageWidth - margin - 6, titleY, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  return margin + barH + 6;
}

function addPageNumbers(doc: any, margin: number): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const footer = `Стр. ${i} / ${total}`;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(footer, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, {
      align: 'right',
    });
    doc.setTextColor(0, 0, 0);
  }
}

/* =========================
 * ОТРИСОВКА ЗАДАНИЙ
 * ========================= */

function renderNonTranslateTask(ctx: RenderContext, task: Task, index: number) {
  const { doc, contentWidth, margin, lineHeight } = ctx;

  const padX = 8;
  const padY = 7;
  const boxX = margin;
  let boxY = ctx.cursorY;
  const boxW = contentWidth;

  const title = `${index + 1}. ${task.instruction || 'Задание'}`;
  doc.setFontSize(14);
  const titleMeasure = wrapText(doc, title, boxW - padX * 2, lineHeight);
  let innerHeight = padY + titleMeasure.height + 4;

  if (task.pageNumber || task.exerciseNumber) {
    doc.setFontSize(10);
    const meta = `Стр. ${task.pageNumber || '–'}, Упр. ${task.exerciseNumber || '–'}`;
    const metaMeasure = wrapText(doc, meta, boxW - padX * 2, lineHeight - 1);
    innerHeight += metaMeasure.height + 2;
  }

  const estPerItem = lineHeight * 2.2;
  innerHeight += (task.items?.length || 0) * estPerItem;
  ensurePageSpace(ctx, innerHeight + padY);

  boxY = ctx.cursorY;
  doc.setFillColor(247, 249, 252);
  doc.setDrawColor(224, 229, 236);
  doc.roundedRect(boxX, boxY, boxW, Math.max(innerHeight + padY, 22), 4, 4, 'FD');
  doc.setFillColor(66, 133, 244);
  doc.roundedRect(boxX, boxY, 3, Math.max(innerHeight + padY, 22), 2, 2, 'F');

  let y = boxY + padY;

  doc.setFontSize(14);
  y = drawLines(doc, titleMeasure.lines, boxX + padX, y, lineHeight);

  if (task.pageNumber || task.exerciseNumber) {
    doc.setFontSize(10);
    doc.setTextColor(95, 99, 104);
    const meta = `Стр. ${task.pageNumber || '–'}, Упр. ${task.exerciseNumber || '–'}`;
    const metaMeasure = wrapText(doc, meta, boxW - padX * 2, lineHeight - 1);
    y = drawLines(doc, metaMeasure.lines, boxX + padX, y, lineHeight - 1) + 2;
    doc.setTextColor(0, 0, 0);
  }

  doc.setDrawColor(230, 235, 242);
  doc.line(boxX + padX, y, boxX + boxW - padX, y);
  y += 4;

  doc.setFontSize(ctx.baseFontSize);
  const items = task.items || [];
  items.forEach((item, i) => {
    ensurePageSpace(ctx, lineHeight * 3.5);

    const label = `${letterIndex(i)} — `;
    const labelW = doc.getTextWidth(label);

    doc.setTextColor(80, 80, 80);
    doc.text(label, boxX + padX, y);
    doc.setTextColor(0, 0, 0);

    y = drawSentenceWithInlineAnswers(
      ctx,
      (item as any).textParts || [],
      (item as any),
      boxX + padX + labelW,
      y
    );

    y += 2.5;
  });

  ctx.cursorY = y + 6;
}

function renderTranslateTask(ctx: RenderContext, task: Task, index: number) {
  const { doc, contentWidth, margin, lineHeight, baseFontSize } = ctx;

  const padX = 8;
  const padY = 7;
  const boxX = margin;
  let boxY = ctx.cursorY;
  const boxW = contentWidth;

  const title = `${index + 1}. ${task.instruction || 'Задание'}`;
  doc.setFontSize(14);
  const titleMeasure = wrapText(doc, title, boxW - padX * 2, lineHeight);
  let innerHeight = padY + titleMeasure.height + 4;

  if (task.pageNumber || task.exerciseNumber) {
    doc.setFontSize(10);
    const meta = `Стр. ${task.pageNumber || '–'}, Упр. ${task.exerciseNumber || '–'}`;
    const metaMeasure = wrapText(doc, meta, boxW - padX * 2, lineHeight - 1);
    innerHeight += metaMeasure.height + 2;
  }

  const rows = (task.items || []).map((item: any) => {
    const source = (item.textParts || []).map((p: any) => p?.text ?? '').join('').replace(/\s+/g, ' ').trim();
    const target = (item.userAnswer || '').trim();
    return { source, target };
  });

  const col1W = Math.floor(boxW * 0.48);
  const col2W = boxW - col1W - padX * 2 - 2;

  let rowsHeight = 0;
  doc.setFontSize(baseFontSize);
  rows.forEach((r) => {
    const h1 = wrapText(doc, r.source || '—', col1W, lineHeight).height;
    const h2 = wrapText(doc, r.target || '—', col2W, lineHeight).height;
    rowsHeight += Math.max(h1, h2) + 4;
  });

  innerHeight += rowsHeight + 8;
  ensurePageSpace(ctx, innerHeight + padY);

  boxY = ctx.cursorY;
  doc.setFillColor(247, 249, 252);
  doc.setDrawColor(224, 229, 236);
  doc.roundedRect(boxX, boxY, boxW, innerHeight + padY, 4, 4, 'FD');
  doc.setFillColor(66, 133, 244);
  doc.roundedRect(boxX, boxY, 3, innerHeight + padY, 2, 2, 'F');

  let y = boxY + padY;

  doc.setFontSize(14);
  y = drawLines(doc, titleMeasure.lines, boxX + padX, y, lineHeight);

  if (task.pageNumber || task.exerciseNumber) {
    doc.setFontSize(10);
    doc.setTextColor(95, 99, 104);
    const meta = `Стр. ${task.pageNumber || '–'}, Упр. ${task.exerciseNumber || '–'}`;
    const metaMeasure = wrapText(doc, meta, boxW - padX * 2, lineHeight - 1);
    y = drawLines(doc, metaMeasure.lines, boxX + padX, y, lineHeight - 1) + 3;
    doc.setTextColor(0, 0, 0);
  }

  const headerH = 8;
  doc.setFillColor(238, 242, 248);
  doc.setDrawColor(224, 229, 236);
  doc.roundedRect(boxX + padX, y, boxW - padX * 2, headerH, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setTextColor(70, 70, 80);
  doc.text('Исходный текст', boxX + padX + 3, y + 5.5);
  doc.text('Перевод', boxX + padX + 3 + col1W + 6, y + 5.5);
  doc.setTextColor(0, 0, 0);

  y += headerH + 3;

  doc.setFontSize(baseFontSize);
  rows.forEach((r) => {
    const left = wrapText(doc, r.source || '—', col1W, lineHeight);
    const right = wrapText(doc, r.target || '—', col2W, lineHeight);
    const rowH = Math.max(left.height, right.height) + 2;

    ensurePageSpace(ctx, rowH + 8);

    doc.setFillColor(252, 253, 255);
    doc.setDrawColor(234, 238, 245);
    doc.roundedRect(boxX + padX, y, boxW - padX * 2, rowH, 2, 2, 'FD');

    let cy = y + 5;
    drawLines(doc, left.lines, boxX + padX + 3, cy, lineHeight);
    drawLines(doc, right.lines, boxX + padX + 3 + col1W + 6, cy, lineHeight);

    y += rowH + 3;
  });

  ctx.cursorY = y + 6;
}

/* =========================
 * ОСНОВНАЯ ФУНКЦИЯ
 * ========================= */

// ИСПРАВЛЕНО: Принимаем 'nickname' для имени файла
export function generatePdfReport(tasks: Task[], nickname: string): void {
  const jsPDF = getJsPDFCtor();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  registerArimoFont(doc);
  doc.setFont('Arimo', 'normal');

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  const ctx: RenderContext = {
    doc,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    cursorY: renderHeader(doc, margin),
    baseFontSize: 12.5,
    lineHeight: 6.4
  };

  const list = (tasks || []).filter(Boolean);
  list.forEach((task, i) => {
    const isTranslate =
      (task as any).type === 'translate' ||
      (task.items || []).some((it: any) => it?.type === 'translate');
    if (isTranslate) {
      renderTranslateTask(ctx, task, i);
    } else {
      renderNonTranslateTask(ctx, task, i);
    }
  });

  addPageNumbers(doc, margin);

  // ИСПРАВЛЕНО: Используем никнейм в имени файла
  const safeNickname = nickname.replace(/[^a-z0-9]/gi, '_') || 'user';
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`report_${safeNickname}_${dateStr}.pdf`);
}