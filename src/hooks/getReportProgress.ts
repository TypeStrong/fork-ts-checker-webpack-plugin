type ReportProgress = (progress: number, message: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getReportProgress(context: any): ReportProgress | undefined {
  return context && context.reportProgress;
}

export { getReportProgress };
