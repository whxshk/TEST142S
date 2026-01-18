/**
 * Environment variable validation on startup
 */

export function validateEnv() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_TOKEN_SECRET',
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.',
    );
  }

  // Warn about development defaults
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    const warns: string[] = [];

    if (process.env.JWT_SECRET?.includes('dev') || process.env.JWT_SECRET?.includes('change')) {
      warns.push('JWT_SECRET appears to be using a development default');
    }

    if (process.env.JWT_REFRESH_TOKEN_SECRET?.includes('dev') || process.env.JWT_REFRESH_TOKEN_SECRET?.includes('change')) {
      warns.push('JWT_REFRESH_TOKEN_SECRET appears to be using a development default');
    }

    if (warns.length > 0) {
      console.warn('⚠️  WARNING:', warns.join(', '));
    }
  }

  console.log(`✓ Environment validated (NODE_ENV: ${nodeEnv})`);
}
