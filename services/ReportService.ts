import { ReportData } from './report/types';
import { ReportLayoutEngine } from './report/ReportLayoutEngine';

export const generatePDFReport = async (data: ReportData) => {
  const engine = new ReportLayoutEngine(data);
  await engine.generate();
};
