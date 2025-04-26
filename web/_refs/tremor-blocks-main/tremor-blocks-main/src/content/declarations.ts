export type BlocksCategoryMetadata = {
  id: string;
  name: string;
  thumbnail: string;
  count: string;
  hasCharts?: boolean;
};

export type BlocksMetadata = {
  id: string;
  category: string;
  name: string;
};

export const categoryIds: { [key: string]: any } = {
  AreaCharts: 'area-charts',
  Badges: 'badges',
  Banners: 'banners',
  BarCharts: 'bar-charts',
  BarLists: 'bar-lists',
  BillingUsage: 'billing-usage',
  ChartCompositions: 'chart-compositions',
  ChartTooltips: 'chart-tooltips',
  DonutCharts: 'donut-charts',
  EmptyStates: 'empty-states',
  FeatureSections: 'feature-sections',
  FormLayouts: 'form-layouts',
  FileUpload: 'file-upload',
  Filterbar: 'filterbar',
  GridLists: 'grid-lists',
  KpiCards: 'kpi-cards',
  LineCharts: 'line-charts',
  Logins: 'logins',
  Dialogs: 'dialogs',
  OnboardingFeed: 'onboarding-feed',
  PageShells: 'page-shells',
  PricingSections: 'pricing-sections',
  SparkCharts: 'spark-charts',
  StatusMonitoring: 'status-monitoring',
  Tables: 'tables',
  AccountAndUserManagement: 'account-and-user-management',
  TablePagination: 'table-pagination',
  TableActions: 'table-actions',
};
