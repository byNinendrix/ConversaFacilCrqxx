type MetricName = "bookingAttempts" | "bookingFailures" | "slotConflicts";

type MetricBucket = {
  bookingAttempts: number;
  bookingFailures: number;
  slotConflicts: number;
};

type MetricLabels = {
  companyId?: number;
  serviceId?: number;
};

const createBucket = (): MetricBucket => ({
  bookingAttempts: 0,
  bookingFailures: 0,
  slotConflicts: 0
});

const totals: MetricBucket = createBucket();
const byCompanyAndService = new Map<string, MetricBucket>();

const getLabelKey = ({ companyId, serviceId }: MetricLabels): string =>
  `${Number(companyId || 0)}:${Number(serviceId || 0)}`;

const incrementMetric = (metric: MetricName, labels: MetricLabels = {}): void => {
  totals[metric] += 1;

  const key = getLabelKey(labels);
  const bucket = byCompanyAndService.get(key) || createBucket();
  bucket[metric] += 1;
  byCompanyAndService.set(key, bucket);
};

export const trackBookingAttemptMetric = (labels: MetricLabels): void => {
  incrementMetric("bookingAttempts", labels);
};

export const trackBookingFailureMetric = (labels: MetricLabels): void => {
  incrementMetric("bookingFailures", labels);
};

export const trackSlotConflictMetric = (labels: MetricLabels): void => {
  incrementMetric("slotConflicts", labels);
};

export const getSchedulingMetricsSnapshot = () => ({
  totals: { ...totals },
  byCompanyAndService: Array.from(byCompanyAndService.entries()).map(
    ([key, value]) => ({
      key,
      ...value
    })
  )
});

