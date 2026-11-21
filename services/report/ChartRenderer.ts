import jsPDF from 'jspdf';

export class ChartRenderer {
  static drawTimeline(doc: jsPDF, data: any[], x: number, y: number, width: number, height: number, color: [number, number, number]) {
    if (data.length < 2) return;

    const maxVal = 100;
    const xStep = width / (data.length - 1);
    
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);

    // Draw axes
    doc.setDrawColor(200, 200, 200);
    doc.line(x, y + height, x + width, y + height); // X axis
    doc.line(x, y, x, y + height); // Y axis

    // Draw grid
    doc.setDrawColor(240, 240, 240);
    for (let i = 1; i < 5; i++) {
      const lineY = y + (height * i / 5);
      doc.line(x, lineY, x + width, lineY);
    }

    // Draw data
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(1.5);
    
    let peakX = 0;
    let peakY = 0;
    let maxRisk = 0;

    for (let i = 0; i < data.length - 1; i++) {
      const val1 = data[i].risk || 0;
      const val2 = data[i+1].risk || 0;

      if (val1 > maxRisk) {
        maxRisk = val1;
        peakX = x + (i * xStep);
        peakY = y + height - (val1 / maxVal * height);
      }

      const x1 = x + (i * xStep);
      const y1 = y + height - (val1 / maxVal * height);
      const x2 = x + ((i + 1) * xStep);
      const y2 = y + height - (val2 / maxVal * height);
      doc.line(x1, y1, x2, y2);
    }

    // Highlight Peak
    if (maxRisk > 50) {
      doc.setFillColor(239, 68, 68);
      doc.circle(peakX, peakY, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(239, 68, 68);
      doc.text(`Peak: ${maxRisk.toFixed(1)}`, peakX + 2, peakY - 2);
    }
  }

  static drawBarChart(doc: jsPDF, data: { label: string, value: number, color: [number, number, number] }[], x: number, y: number, width: number, height: number) {
    const barHeight = height / data.length;
    const maxVal = 100; // Normalize to 100%

    data.forEach((item, index) => {
      const barY = y + (index * barHeight);
      const barWidth = (item.value / maxVal) * width;

      // Label
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, x, barY + 5);

      // Background Bar
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x + 80, barY, width - 80, 6, 1, 1, 'F');

      // Value Bar
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.roundedRect(x + 80, barY, Math.max(2, barWidth - 80), 6, 1, 1, 'F');

      // Value Text
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${item.value.toFixed(1)}%`, x + width + 5, barY + 5);
    });
  }
}
