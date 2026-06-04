import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportData, ReportLanguage, RiskAnalysis } from './types';
import { LocalizationManager } from './LocalizationManager';
import { RiskAnalysisEngine } from './RiskAnalysisEngine';
import { NarrativeGenerator } from './NarrativeGenerator';
import { ChartRenderer } from './ChartRenderer';

export class ReportLayoutEngine {
  private doc: jsPDF;
  private data: ReportData;
  private analysis: RiskAnalysis;
  private strings: any;
  private margin = 20;
  private pageWidth: number;
  private pageHeight: number;
  private yPos = 0;

  constructor(data: ReportData) {
    this.data = data;
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.width;
    this.pageHeight = this.doc.internal.pageSize.height;
    this.strings = LocalizationManager.getStrings(data.language);
    
    // Perform Risk Analysis
    this.analysis = RiskAnalysisEngine.analyze(data.state, data.history);

    // Fallback Summary if AI failed
    if (!data.aiSummary || data.aiSummary.includes("unavailable")) {
      this.data.aiSummary = NarrativeGenerator.generateFallback(data.language, this.analysis, data.context);
    }
  }

  public async generate(): Promise<void> {
    const { onProgress } = this.data;
    const reportProgress = (p: number) => onProgress && onProgress(p);

    reportProgress(10);
    this.renderCoverPage();
    
    await this.yieldToMain();
    reportProgress(30);
    // Combine Executive Summary, Context, and Timeline on one page if possible, or tightly packed
    this.renderExecutiveDashboard();

    await this.yieldToMain();
    reportProgress(60);
    // Combine Risk Breakdown, XAI, and Recommendations
    this.renderDetailedAnalysis();

    this.addFooter();
    reportProgress(100);
    
    this.doc.save(`VRU_Report_${this.data.language}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  private renderCoverPage() {
    // ... existing cover page code ...
    // Background
    this.doc.setFillColor(15, 23, 42); // Slate 900
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F');

    // Logo
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(32);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('SENTINEL', this.margin, 50);
    
    this.doc.setFontSize(14);
    this.doc.setTextColor(56, 189, 248); // Light Blue
    this.doc.text('AI SAFETY SYSTEM', this.margin, 58);

    // Title
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(24);
    this.doc.text(this.strings.cover.title, this.margin, 100, { maxWidth: this.pageWidth - (this.margin * 2) });
    
    this.doc.setFontSize(14);
    this.doc.setTextColor(148, 163, 184); // Slate 400
    this.doc.text(this.strings.cover.subtitle, this.margin, 115);

    // Session Info
    this.yPos = 160;
    const addRow = (label: string, value: string) => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(label.toUpperCase(), this.margin, this.yPos);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(value, this.margin + 60, this.yPos);
      this.yPos += 12;
    };

    const userAgent = this.data.state.vrus.find(v => v.isUserControlled);
    const lat = userAgent?.position.lat.toFixed(6) || "N/A";
    const lng = userAgent?.position.lng.toFixed(6) || "N/A";

    addRow(this.strings.cover.sessionID, Math.random().toString(36).substr(2, 9).toUpperCase());
    addRow(this.strings.cover.date, new Date().toLocaleString(this.data.language === 'FR' ? 'fr-FR' : 'en-US'));
    addRow(this.strings.cover.mode, "Simulation / Digital Twin");
    addRow(this.strings.cover.environment, `${this.data.context.environment} (${this.data.context.weather})`);
    
    this.yPos += 10;
    this.doc.setDrawColor(56, 189, 248);
    this.doc.line(this.margin, this.yPos - 5, this.margin + 100, this.yPos - 5);
    
    addRow(this.strings.cover.location, this.data.context.environment);
    addRow(this.strings.cover.coordinates, `${lat}, ${lng}`);

    // Footer Confidential
    this.doc.setFontSize(10);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(this.strings.cover.confidential, this.margin, this.pageHeight - 20);
  }

  private renderExecutiveDashboard() {
    this.doc.addPage();
    this.renderSidebar(); // Add sidebar for "Special" look
    
    const contentMargin = this.margin + 10; // Shift content right due to sidebar
    this.yPos = 20;

    // 1. Executive Summary
    this.renderHeader(this.strings.executive.title, contentMargin);
    
    this.doc.setFillColor(241, 245, 249);
    this.doc.roundedRect(contentMargin, this.yPos, this.pageWidth - contentMargin - this.margin, 35, 2, 2, 'F');
    
    this.doc.setFontSize(9);
    this.doc.setTextColor(30, 41, 59);
    const summaryText = this.doc.splitTextToSize(this.data.aiSummary, this.pageWidth - contentMargin - this.margin - 10);
    this.doc.text(summaryText, contentMargin + 5, this.yPos + 8);
    this.yPos += 45;

    // 2. Key Metrics (Compact Grid)
    const metrics = [
      { label: this.strings.executive.safetyIndex, value: `${this.analysis.safetyIndex.toFixed(1)}`, color: [34, 197, 94] },
      { label: this.strings.executive.riskLevel, value: this.analysis.riskLevel, color: this.getRiskColor(this.analysis.metrics.avgRisk) },
      { label: this.strings.executive.confidence, value: `${this.analysis.riskConfidence.toFixed(1)}%`, color: [37, 99, 235] },
      { label: this.strings.executive.alerts, value: this.analysis.metrics.totalAlerts.toString(), color: [239, 68, 68] }
    ];

    let x = contentMargin;
    const width = (this.pageWidth - contentMargin - this.margin) / 4;
    
    metrics.forEach(m => {
      this.doc.setFillColor(255, 255, 255);
      this.doc.setDrawColor(226, 232, 240);
      this.doc.roundedRect(x, this.yPos, width - 4, 25, 2, 2, 'FD');

      this.doc.setFontSize(7);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text(m.label.toUpperCase(), x + 4, this.yPos + 8);

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(m.color[0], m.color[1], m.color[2] as number);
      this.doc.text(m.value, x + 4, this.yPos + 18);
      
      x += width;
    });
    this.yPos += 35;

    // 3. Timeline Graph (Compact)
    this.renderHeader(this.strings.timeline.title, contentMargin);
    ChartRenderer.drawTimeline(this.doc, this.data.history, contentMargin, this.yPos, this.pageWidth - contentMargin - this.margin, 50, [37, 99, 235]);
    this.yPos += 60;

    // 4. Context Analysis (Horizontal Grid)
    this.renderHeader(this.strings.context.title, contentMargin);
    
    const contextItems = [
      { title: this.strings.context.topology, desc: "Intersection: 12m" },
      { title: this.strings.context.density, desc: `${this.analysis.dominantFactor.value.toFixed(2)} VRU/m²` },
      { title: this.strings.context.sensor, desc: `RMSE: ${this.data.state.metrics.avgError.toFixed(3)}m` }
    ];

    let ctxX = contentMargin;
    const ctxWidth = (this.pageWidth - contentMargin - this.margin) / 3;

    contextItems.forEach(item => {
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(15, 23, 42);
        this.doc.text(item.title, ctxX, this.yPos);
        
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(71, 85, 105);
        this.doc.text(item.desc, ctxX, this.yPos + 5);
        ctxX += ctxWidth;
    });
  }

  private renderDetailedAnalysis() {
    this.doc.addPage();
    this.renderSidebar();
    const contentMargin = this.margin + 10;
    this.yPos = 20;

    // 1. Risk Breakdown Table
    this.renderHeader(this.strings.breakdown.title, contentMargin);

    const userAgent = this.data.state.vrus.find(v => v.isUserControlled);
    const factors = userAgent?.riskFactors || {
      dynamic: { agentDistance: 0, relativeSpeed: 0, localDensity: 0 },
      topology: { totalScore: 0 },
      compatibility: { infrastructureMismatch: 0 },
      sensor: { gpsAccuracy: 0, reliabilityScore: 0 }
    };
    const config = this.data.state.riskScoreConfig || { w1_distance: 30, w2_relativeSpeed: 20, w3_density: 15, w4_topology: 15, w5_infrastructureMismatch: 10, w6_sensorUncertainty: 10 };

    const rows = [
      [this.strings.factors.distance, factors.dynamic.agentDistance.toFixed(2), config.w1_distance, `${(factors.dynamic.agentDistance * config.w1_distance).toFixed(1)}%`, 'LOW'],
      [this.strings.factors.relativeSpeed, factors.dynamic.relativeSpeed.toFixed(2), config.w2_relativeSpeed, `${(factors.dynamic.relativeSpeed * config.w2_relativeSpeed).toFixed(1)}%`, 'MEDIUM'],
      [this.strings.factors.density, factors.dynamic.localDensity.toFixed(2), config.w3_density, `${(factors.dynamic.localDensity * config.w3_density).toFixed(1)}%`, 'LOW'],
      [this.strings.factors.topology, factors.topology.totalScore.toFixed(2), config.w4_topology, `${(factors.topology.totalScore * config.w4_topology).toFixed(1)}%`, 'LOW'],
      [this.strings.factors.infrastructure, factors.compatibility.infrastructureMismatch.toFixed(2), config.w5_infrastructureMismatch, `${(factors.compatibility.infrastructureMismatch * config.w5_infrastructureMismatch).toFixed(1)}%`, 'LOW'],
      [this.strings.factors.sensor, ((factors.sensor.gpsAccuracy + factors.sensor.reliabilityScore)/2).toFixed(2), config.w6_sensorUncertainty, `${(((factors.sensor.gpsAccuracy + factors.sensor.reliabilityScore)/2) * config.w6_sensorUncertainty).toFixed(1)}%`, 'LOW']
    ];

    autoTable(this.doc, {
      startY: this.yPos,
      margin: { left: contentMargin },
      head: [this.strings.breakdown.headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    this.yPos = (this.doc as any).lastAutoTable.finalY + 15;

    // AI Risk Analysis
    if (this.data.aiRiskAnalysis) {
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(15, 23, 42);
        this.doc.text("AI RISK INTERPRETATION:", contentMargin, this.yPos);
        this.yPos += 5;

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'italic');
        this.doc.setTextColor(51, 65, 85);
        const analysisText = this.doc.splitTextToSize(this.data.aiRiskAnalysis, this.pageWidth - contentMargin - this.margin - 10);
        this.doc.text(analysisText, contentMargin, this.yPos);
        this.yPos += (analysisText.length * 4) + 15;
    } else {
        this.yPos += 5;
    }

    // 2. XAI
    this.renderHeader(this.strings.xai.title, contentMargin);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(71, 85, 105);
    this.doc.text(`${this.strings.xai.formula}: RiskScore = w1*D + w2*V + w3*ρ + w4*T + w5*I + w6*U`, contentMargin, this.yPos);
    this.yPos += 20;

    // 3. Recommendations
    this.renderHeader(this.strings.recommendations.title, contentMargin);

    if (this.data.strategicRecommendation) {
        const strat = this.data.strategicRecommendation;
        
        // Action Box
        this.doc.setFillColor(240, 249, 255);
        this.doc.setDrawColor(37, 99, 235);
        this.doc.roundedRect(contentMargin, this.yPos, this.pageWidth - contentMargin - this.margin, 20, 2, 2, 'FD');
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 58, 138);
        this.doc.text(`STRATEGIC ACTION: ${strat.action}`, contentMargin + 5, this.yPos + 8);
        
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(30, 64, 175);
        this.doc.text(`PROPOSED SOLUTION: ${strat.solution}`, contentMargin + 5, this.yPos + 14);
        
        this.yPos += 25;

        // Technical Reasoning
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(15, 23, 42);
        this.doc.text("TECHNICAL JUSTIFICATION:", contentMargin, this.yPos);
        this.yPos += 5;
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(51, 65, 85);
        const reasonText = this.doc.splitTextToSize(strat.technicalReasoning, this.pageWidth - contentMargin - this.margin);
        this.doc.text(reasonText, contentMargin, this.yPos);
        this.yPos += (reasonText.length * 4) + 10;

        // Prediction
        this.doc.setFillColor(240, 253, 244); // Green tint
        this.doc.setDrawColor(22, 163, 74);
        this.doc.roundedRect(contentMargin, this.yPos, this.pageWidth - contentMargin - this.margin, 18, 2, 2, 'FD');
        
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(21, 128, 61);
        this.doc.text(`PREDICTED OUTCOME:`, contentMargin + 5, this.yPos + 7);
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`Expected RMSE: ${strat.prediction.expectedRMSE} | Risk Level: ${strat.prediction.expectedRisk}`, contentMargin + 5, this.yPos + 12);
        
    } else {
        // Fallback to simple recommendation
        this.doc.setFillColor(240, 249, 255);
        this.doc.setDrawColor(37, 99, 235);
        this.doc.roundedRect(contentMargin, this.yPos, this.pageWidth - contentMargin - this.margin, 30, 2, 2, 'FD');

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(15, 23, 42);
        const recText = this.doc.splitTextToSize(this.data.recommendation, this.pageWidth - contentMargin - this.margin - 10);
        this.doc.text(recText, contentMargin + 5, this.yPos + 8);
    }
  }

  private renderSidebar() {
    // Draw a colored sidebar on the left
    this.doc.setFillColor(248, 250, 252); // Very light slate
    this.doc.rect(0, 0, this.margin + 5, this.pageHeight, 'F');
    
    // Accent line
    this.doc.setDrawColor(56, 189, 248); // Light Blue
    this.doc.setLineWidth(2);
    this.doc.line(this.margin + 5, 0, this.margin + 5, this.pageHeight);
  }

  private renderHeader(title: string, x: number) {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42);
    this.doc.text(title.toUpperCase(), x, this.yPos);
    this.yPos += 8;
    
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.5);
    this.doc.line(x, this.yPos, this.pageWidth - this.margin, this.yPos);
    this.yPos += 10;
  }

  private addFooter() {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(148, 163, 184);
      this.doc.text(
        `${this.strings.footer.text} | ${this.strings.footer.page} ${i} / ${totalPages}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
    }
  }

  private getRiskColor(risk: number): [number, number, number] {
    if (risk > 80) return [239, 68, 68]; // Red
    if (risk > 50) return [249, 115, 22]; // Orange
    if (risk > 20) return [234, 179, 8]; // Yellow
    return [34, 197, 94]; // Green
  }

  private yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
}
