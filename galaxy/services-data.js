/**
 * Microservice topology data
 * Each service has orbital params, metrics, and sub-services
 */

export const SERVICES = [
    {
        id: 'api-gateway',
        name: 'API Gateway',
        type: 'gateway',
        color: [0.38, 0.65, 0.98],   // blue
        orbitRadius: 9.0,
        orbitTiltX: 1.2,
        orbitTiltY: 0.5,
        orbitSpeed: 0.25,
        orbitPhase: 0,
        size: 0.35,
        metrics: { latency: '8ms', load: '72%', rps: '14.2k', errors: '0.01%' },
        subs: [
            { name: 'Rate Limiter', status: 'healthy', color: '#34d399' },
            { name: 'Auth Proxy', status: 'healthy', color: '#34d399' },
            { name: 'Load Balancer', status: 'healthy', color: '#34d399' },
        ]
    },
    {
        id: 'auth-service',
        name: 'Auth Service',
        type: 'microservice',
        color: [0.75, 0.55, 0.99],   // purple
        orbitRadius: 11.5,
        orbitTiltX: -1.0,
        orbitTiltY: -0.8,
        orbitSpeed: 0.20,
        orbitPhase: 1.2,
        size: 0.30,
        metrics: { latency: '12ms', load: '45%', rps: '3.8k', errors: '0.00%' },
        subs: [
            { name: 'JWT Issuer', status: 'healthy', color: '#34d399' },
            { name: 'OAuth Handler', status: 'healthy', color: '#34d399' },
            { name: 'Session Store', status: 'warning', color: '#fbbf24' },
        ]
    },
    {
        id: 'user-service',
        name: 'User Service',
        type: 'microservice',
        color: [0.13, 0.83, 0.93],   // cyan
        orbitRadius: 13.5,
        orbitTiltX: 0.8,
        orbitTiltY: 1.5,
        orbitSpeed: 0.16,
        orbitPhase: 2.5,
        size: 0.28,
        metrics: { latency: '15ms', load: '38%', rps: '2.1k', errors: '0.02%' },
        subs: [
            { name: 'Profile Manager', status: 'healthy', color: '#34d399' },
            { name: 'Avatar CDN', status: 'healthy', color: '#34d399' },
        ]
    },
    {
        id: 'payment-engine',
        name: 'Payment Engine',
        type: 'microservice',
        color: [0.98, 0.75, 0.14],   // gold
        orbitRadius: 10.0,
        orbitTiltX: 0.4,
        orbitTiltY: -1.2,
        orbitSpeed: 0.22,
        orbitPhase: 3.8,
        size: 0.32,
        metrics: { latency: '22ms', load: '61%', rps: '1.4k', errors: '0.05%' },
        subs: [
            { name: 'Stripe Adapter', status: 'healthy', color: '#34d399' },
            { name: 'Invoice Generator', status: 'healthy', color: '#34d399' },
            { name: 'Fraud Detector', status: 'warning', color: '#fbbf24' },
            { name: 'Refund Handler', status: 'healthy', color: '#34d399' },
        ]
    },
    {
        id: 'notification-hub',
        name: 'Notification Hub',
        type: 'microservice',
        color: [0.98, 0.44, 0.52],   // rose
        orbitRadius: 16.0,
        orbitTiltX: -1.5,
        orbitTiltY: 0.2,
        orbitSpeed: 0.12,
        orbitPhase: 5.0,
        size: 0.25,
        metrics: { latency: '5ms', load: '28%', rps: '8.9k', errors: '0.00%' },
        subs: [
            { name: 'Email Sender', status: 'healthy', color: '#34d399' },
            { name: 'Push Service', status: 'healthy', color: '#34d399' },
            { name: 'SMS Gateway', status: 'critical', color: '#fb7185' },
        ]
    },
    {
        id: 'data-pipeline',
        name: 'Data Pipeline',
        type: 'microservice',
        color: [0.20, 0.83, 0.60],   // green
        orbitRadius: 19.0,
        orbitTiltX: 1.4,
        orbitTiltY: 2.1,
        orbitSpeed: 0.10,
        orbitPhase: 0.8,
        size: 0.28,
        metrics: { latency: '45ms', load: '82%', rps: '950', errors: '0.12%' },
        subs: [
            { name: 'Kafka Consumer', status: 'healthy', color: '#34d399' },
            { name: 'ETL Processor', status: 'warning', color: '#fbbf24' },
            { name: 'Data Lake Writer', status: 'healthy', color: '#34d399' },
        ]
    },
    {
        id: 'ml-engine',
        name: 'ML Engine',
        type: 'ai-service',
        color: [0.80, 0.60, 0.98],   // lavender
        orbitRadius: 22.0,
        orbitTiltX: -0.5,
        orbitTiltY: 1.8,
        orbitSpeed: 0.08,
        orbitPhase: 4.2,
        size: 0.40,
        metrics: { latency: '120ms', load: '91%', rps: '420', errors: '0.08%' },
        subs: [
            { name: 'Model Serving', status: 'healthy', color: '#34d399' },
            { name: 'Feature Store', status: 'healthy', color: '#34d399' },
            { name: 'Training Pipeline', status: 'healthy', color: '#34d399' },
            { name: 'GPU Scheduler', status: 'warning', color: '#fbbf24' },
        ]
    },
    {
        id: 'cdn-edge',
        name: 'CDN Edge',
        type: 'infrastructure',
        color: [0.45, 0.78, 0.98],   // light blue
        orbitRadius: 26.0,
        orbitTiltX: 0.2,
        orbitTiltY: -0.5,
        orbitSpeed: 0.05,
        orbitPhase: 2.0,
        size: 0.24,
        metrics: { latency: '2ms', load: '55%', rps: '42k', errors: '0.00%' },
        subs: [
            { name: 'Cache Layer', status: 'healthy', color: '#34d399' },
            { name: 'Edge Functions', status: 'healthy', color: '#34d399' },
        ]
    },
];

/**
 * Connection definitions (energy beams between services)
 */
export const CONNECTIONS = [
    { from: 'api-gateway', to: 'auth-service', intensity: 0.9 },
    { from: 'api-gateway', to: 'user-service', intensity: 0.7 },
    { from: 'api-gateway', to: 'payment-engine', intensity: 0.8 },
    { from: 'api-gateway', to: 'notification-hub', intensity: 0.5 },
    { from: 'auth-service', to: 'user-service', intensity: 0.6 },
    { from: 'payment-engine', to: 'notification-hub', intensity: 0.7 },
    { from: 'data-pipeline', to: 'ml-engine', intensity: 0.85 },
    { from: 'user-service', to: 'cdn-edge', intensity: 0.4 },
    { from: 'notification-hub', to: 'data-pipeline', intensity: 0.3 },
    { from: 'ml-engine', to: 'api-gateway', intensity: 0.5 },
];
