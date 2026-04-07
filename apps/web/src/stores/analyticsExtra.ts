import type {
  AccountAnalytics,
  ConversionPoint,
  TrafficSource,
  VideoAnalytics,
} from "@atome/shared";
import { create } from "zustand";
import { useMetricsStore } from "./metrics";

type Period = "7d" | "14d" | "30d";

interface PerformanceKPIs {
  total_views: number;
  avg_views_per_video: number;
  total_link_clicks: number;
  conversion_rate: number;
}

interface AnalyticsExtraState {
  kpis: PerformanceKPIs;
  accountStats: AccountAnalytics[];
  topVideos: VideoAnalytics[];
  trafficSources: TrafficSource[];
  conversionHistory: ConversionPoint[];
  loading: boolean;
  generateDemo: (period: Period) => void;
  clear: () => void;
}

const EMPTY_KPIS: PerformanceKPIs = {
  total_views: 0,
  avg_views_per_video: 0,
  total_link_clicks: 0,
  conversion_rate: 0,
};

const DEMO_ACCOUNTS = [
  "nfl_tactics_01",
  "nba_drama_daily",
  "soccer_hype",
  "mma_clips_hd",
  "f1_edits",
  "tennis_ace",
  "boxing_king",
  "hockey_zone",
  "cricket_daily",
  "golf_tips_pro",
];

function generateDemoAccounts(): AccountAnalytics[] {
  return DEMO_ACCOUNTS.map((username, i) => {
    const views = Math.round(500000 - i * 40000 + (Math.random() - 0.5) * 20000);
    return {
      account_id: `acc_${i + 1}`,
      username,
      platform: "tiktok",
      total_views: views,
      total_likes: Math.round(views * (0.03 + Math.random() * 0.04)),
      link_clicks: Math.round(views * (0.005 + Math.random() * 0.008)),
      avg_views_per_video: Math.round(views / (10 + i * 2)),
    };
  });
}

function generateDemoVideos(): VideoAnalytics[] {
  const titles = [
    "Game-winning play breakdown",
    "Top 10 saves this week",
    "Coach reaction compilation",
    "Behind the scenes training",
    "Match highlights recap",
    "Player interview clips",
    "Workout routine reveal",
    "Fan reactions montage",
    "Season predictions",
    "Draft day analysis",
  ];
  return titles.map((title, i) => ({
    video_id: `vid_${i + 1}`,
    title,
    account_id: DEMO_ACCOUNTS[i % DEMO_ACCOUNTS.length],
    views: Math.round(120000 - i * 10000 + (Math.random() - 0.5) * 8000),
    likes: Math.round(5000 - i * 400 + Math.random() * 300),
    link_clicks: Math.round(800 - i * 60 + Math.random() * 50),
    completion_rate: Math.round(65 - i * 3 + Math.random() * 10),
    published_at: new Date(Date.now() - i * 86_400_000).toISOString(),
  }));
}

function generateDemoTraffic(): TrafficSource[] {
  return [
    { source: "FYP", views: 620000, percentage: 58 },
    { source: "Following", views: 160000, percentage: 15 },
    { source: "Search", views: 107000, percentage: 10 },
    { source: "Profile", views: 86000, percentage: 8 },
    { source: "Hashtag", views: 53000, percentage: 5 },
    { source: "External", views: 43000, percentage: 4 },
  ];
}

function generateDemoConversion(period: Period): ConversionPoint[] {
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const now = Date.now();
  const points: ConversionPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const ts = now - i * 86_400_000;
    const progress = (days - i) / days;
    const r = (d: number) => (Math.random() - 0.5) * 2 * d;
    const views = Math.max(100, Math.round(25000 + progress * 15000 + r(3000)));
    const clicks = Math.max(10, Math.round(views * (0.006 + progress * 0.003 + r(0.001))));
    points.push({
      ts,
      views,
      link_clicks: clicks,
      conversion_rate: +((clicks / views) * 100).toFixed(2),
    });
  }
  return points;
}

export const useAnalyticsExtraStore = create<AnalyticsExtraState>((set) => ({
  kpis: EMPTY_KPIS,
  accountStats: [],
  topVideos: [],
  trafficSources: [],
  conversionHistory: [],
  loading: false,

  generateDemo: (period: Period) => {
    const accounts = generateDemoAccounts();
    const videos = generateDemoVideos();
    const totalViews = accounts.reduce((s, a) => s + a.total_views, 0);
    const totalClicks = accounts.reduce((s, a) => s + a.link_clicks, 0);
    set({
      accountStats: accounts,
      topVideos: videos,
      trafficSources: generateDemoTraffic(),
      conversionHistory: generateDemoConversion(period),
      kpis: {
        total_views: totalViews,
        avg_views_per_video: Math.round(totalViews / (videos.length || 1)),
        total_link_clicks: totalClicks,
        conversion_rate: +((totalClicks / totalViews) * 100).toFixed(2),
      },
    });
  },

  clear: () =>
    set({
      kpis: EMPTY_KPIS,
      accountStats: [],
      topVideos: [],
      trafficSources: [],
      conversionHistory: [],
    }),
}));

// Sync with main demoMode
useMetricsStore.subscribe((state) => {
  const extra = useAnalyticsExtraStore.getState();
  if (state.demoMode) {
    extra.generateDemo("30d");
  } else {
    extra.clear();
  }
});
