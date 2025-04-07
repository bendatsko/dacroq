import { blocksMetadata } from './blocks-metadata';
import {
  BlocksCategoryMetadata,
  BlocksMetadata,
  categoryIds,
} from './declarations';

type CategoryCount = Record<string, number>;

const countByCategory = (blocks: BlocksMetadata[]): CategoryCount => {
  return blocks.reduce((acc: CategoryCount, block: BlocksMetadata) => {
    const { category } = block;
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
};

const updateCategoryCounts = (
  categories: Omit<BlocksCategoryMetadata, 'count'>[],
  counts: CategoryCount,
): BlocksCategoryMetadata[] => {
  const countsMap = new Map<string, number>(Object.entries(counts));
  return categories.map((category) => ({
    ...category,
    count: (countsMap.get(category.id) || '0').toString(),
  }));
};

const initializeAndUpdateCategories = (): BlocksCategoryMetadata[] => {
  const categoryCounts = countByCategory(blocksMetadata);
  return updateCategoryCounts(preblocksCategoriesMetadata, categoryCounts);
};

const preblocksCategoriesMetadata: Omit<BlocksCategoryMetadata, 'count'>[] = [
  {
    id: categoryIds.AccountAndUserManagement,
    name: 'Account and User Management',

    thumbnail: '/thumbnails/user-management.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.AreaCharts,
    name: 'Area Charts',

    thumbnail: '/thumbnails/area-charts.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.Badges,
    name: 'Badges',

    thumbnail: '/thumbnails/badges.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.Banners,
    name: 'Banners',

    thumbnail: '/thumbnails/banners.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.BarCharts,
    name: 'Bar Charts',

    thumbnail: '/thumbnails/bar-charts.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.BarLists,
    name: 'Bar Lists',

    thumbnail: '/thumbnails/bar-lists.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.BillingUsage,
    name: 'Billing & Usage',

    thumbnail: '/thumbnails/billing-usage.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.ChartCompositions,
    name: 'Chart Compositions',

    thumbnail: '/thumbnails/chart-compositions.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.ChartTooltips,
    name: 'Chart Tooltips',

    thumbnail: '/thumbnails/chart-tooltips.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.DonutCharts,
    name: 'Donut Charts',

    thumbnail: '/thumbnails/donut-charts.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.Dialogs,
    name: 'Dialogs',

    thumbnail: '/thumbnails/dialogs.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.EmptyStates,
    name: 'Empty States',

    thumbnail: '/thumbnails/empty-states.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.FeatureSections,
    name: 'Feature Sections',

    thumbnail: '/thumbnails/feature-sections.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.FileUpload,
    name: 'File Upload',

    thumbnail: '/thumbnails/file-upload.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.FormLayouts,
    name: 'Form Layouts',

    thumbnail: '/thumbnails/form-layouts.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.Filterbar,
    name: 'Filterbar',

    thumbnail: '/thumbnails/filterbar.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.GridLists,
    name: 'Grid Lists',

    thumbnail: '/thumbnails/grid-lists.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.KpiCards,
    name: 'KPI Cards',

    thumbnail: '/thumbnails/kpi-cards.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.LineCharts,
    name: 'Line Charts',

    thumbnail: '/thumbnails/line-charts.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.Logins,
    name: 'Logins',

    thumbnail: '/thumbnails/logins.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.OnboardingFeed,
    name: 'Onboarding & Feed',

    thumbnail: '/thumbnails/onboarding-feed.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.PageShells,
    name: 'Page Shells',

    thumbnail: '/thumbnails/page-shells.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.PricingSections,
    name: 'Pricing Sections',

    thumbnail: '/thumbnails/pricing-sections.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.SparkCharts,
    name: 'Spark Charts',

    thumbnail: '/thumbnails/spark-charts.webp',
    hasCharts: true,
  },
  {
    id: categoryIds.StatusMonitoring,
    name: 'Status Monitoring',

    thumbnail: '/thumbnails/status-monitoring.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.Tables,
    name: 'Tables',

    thumbnail: '/thumbnails/tables.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.TablePagination,
    name: 'Table Pagination',

    thumbnail: '/thumbnails/table-pagination.webp',
    hasCharts: false,
  },
  {
    id: categoryIds.TableActions,
    name: 'Table Actions',

    thumbnail: '/thumbnails/table-action.webp',
    hasCharts: false,
  },
];

export const blocksCategoriesMetadata = initializeAndUpdateCategories();
