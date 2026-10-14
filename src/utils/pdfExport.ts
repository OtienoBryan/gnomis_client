import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Renders an element to an A4 PDF and downloads it.
 *
 * The element is drawn once and sliced into A4 pages. A page is only added when real content
 * spills onto it: a sub-millimetre overflow (padding/rounding) is ignored, which is what used to
 * produce a trailing blank page.
 */
export const exportElementToA4Pdf = async (element: HTMLElement, filename: string): Promise<void> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    scrollX: 0,
    scrollY: -window.scrollY, // keeps the capture aligned when the page is scrolled
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth(); // 210
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  const pages = Math.max(1, Math.ceil((imgHeight - 1) / pageHeight));
  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, -i * pageHeight, pageWidth, imgHeight);
  }

  pdf.save(filename);
};
