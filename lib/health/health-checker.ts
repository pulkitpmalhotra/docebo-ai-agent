// lib/health/health-checker.ts
import { InputValidator } from '../validation/input-validator';
import { cache, apiCache } from '../cache/cache-manager';
import { rateLimiter } from '../middleware/rate-limit';
import { ErrorHandler } from '../errors/error-handler';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: any;
  lastCheck: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    environment: HealthCheck;
    docebo_api: HealthCheck;
    gemini_api: HealthCheck;
    cache: HealthCheck;
    rate_limiter: HealthCheck;
    memory: HealthCheck;
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  performance: {
    avg_response_time: number;
    slowest_check: string;
    fastest_check: string;
  };
}

export class HealthChecker {
  private static startTime = Date.now();
  private static lastHealthCheck: HealthStatus | null = null;
  private static checkCache = new Map<string, { result: HealthCheck; expiry: number }>();

  static async checkHealth(useCache: boolean = true): Promise<HealthStatus> {
    const startTime = Date.now();
    
    console.log('🏥 Starting comprehensive health check...');

    // Run all health checks in parallel for better performance
    const checks = await Promise.allSettled([
      this.checkEnvironment(useCache),
      this.checkDoceboAPI(useCache),
      this.checkGeminiAPI(useCache),
      this.checkCache(useCache),
      this.checkRateLimiter(useCache),
      this.checkMemory(useCache)
    ]);

    const healthChecks = {
      environment: this.getCheckResult(checks[0], 'environment'),
      docebo_api: this.getCheckResult(checks[1], 'docebo_api'),
      gemini_api: this.getCheckResult(checks[2], 'gemini_api'),
      cache: this.getCheckResult(checks[3], 'cache'),
      rate_limiter: this.getCheckResult(checks[4], 'rate_limiter'),
      memory: this.getCheckResult(checks[5], 'memory')
    };

    // Calculate overall status
    const checkValues = Object.values(healthChecks);
    const healthyCount = checkValues.filter(c => c.status === 'healthy').length;
    const degradedCount = checkValues.filter(c => c.status === 'degraded').length;
    const unhealthyCount = checkValues.filter(c => c.status === 'unhealthy').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Calculate performance metrics
    const responseTimes = checkValues.map(c => c.responseTime);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const slowestCheck = checkValues.reduce((slowest, current) => 
      current.responseTime > slowest.responseTime ? current : slowest
    );
    const fastestCheck = checkValues.reduce((fastest, current) => 
      current.responseTime < fastest.responseTime ? current : fastest
    );

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: healthChecks,
      summary: {
        total: checkValues.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount
      },
      performance: {
        avg_response_time: Math.round(avgResponseTime),
        slowest_check: slowestCheck.name,
        fastest_check: fastestCheck.name
      }
    };

    this.lastHealthCheck = healthStatus;
    
    const totalTime = Date.now() - startTime;
    console.log(`🏥 Health check completed in ${totalTime}ms - Status: ${overallStatus}`);

    return healthStatus;
  }

  // Individual health check methods
  private static async checkEnvironment(useCache: boolean): Promise<HealthCheck> {
    return this.runCheck('environment', useCache, async () => {
      const validation = InputValidator.validateEnvironment();
      
      if (validation.success) {
        return {
          status: 'healthy' as const,
          message: 'All required environment variables are set',
          details: { variables_count: Object.keys(validation.data || {}).length }
        };
      } else {
        return {
          status: 'unhealthy' as const,
          message: 'Missing required environment variables',
          details: { missing: validation.errors }
        };
      }
    });
  }

  private static async checkDoceboAPI(useCache: boolean): Promise<HealthCheck> {
    return this.runCheck('docebo_api', useCache, async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`https://${process.env.DOCEBO_DOMAIN}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: process.env.DOCEBO_CLIENT_ID!,
            client_secret: process.env.DOCEBO_CLIENT_SECRET!,
            scope: 'api',
            username: process.env.DOCEBO_USERNAME!,
            password: process.env.DOCEBO_PASSWORD!,
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            status: 'healthy' as const,
            message: 'Docebo API is accessible and responding',
            details: { 
              response_status: response.status,
              has_token: !!data.access_token,
              token_type: data.token_type
            }
          };
        } else {
          return {
            status: 'degraded' as const,
            message: `Docebo API returned ${response.status}`,
            details: { response_status: response.status }
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: 'Docebo API is unreachable',
          details: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            domain: process.env.DOCEBO_DOMAIN
          }
        };
      }
    });
  }

  private static async checkGeminiAPI(useCache: boolean): Promise<HealthCheck> {
    return this.runCheck('gemini_api', useCache, async () => {
      try {
        const hasValidKey = !!process.env.GOOGLE_GEMINI_API_KEY?.startsWith('AI');
        
        if (hasValidKey) {
          // Could do a simple API test here, but for now just validate key format
          return {
            status: 'healthy' as const,
            message: 'Gemini API key is configured',
            details: { 
              key_format_valid: true,
              key_prefix: process.env.GOOGLE_GEMINI_API_KEY?.substring(0, 5)
            }
          };
        } else {
          return {
            status: 'unhealthy' as const,
            message: 'Invalid or missing Gemini API key',
            details: { key_format_valid: false }
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: 'Gemini API check failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    });
  }

  private static async checkCache(useCache: boolean): Promise<HealthCheck> {
    return this.runCheck('cache', useCache, async () => {
      try {
        // Test cache operations
        const testKey = `health_check_${Date.now()}`;
        const testValue = { test: true, timestamp: Date.now() };
        
        // Test set/get operations
        cache.set(testKey, testValue, { ttl: 1000 });
        const retrieved = cache.get(testKey);
        cache.delete(testKey);
        
        if (retrieved && retrieved.test === true) {
          const stats = cache.getStats();
          const apiStats = apiCache.getStats();
          
          return {
            status: 'healthy' as const,
            message: 'Cache system is working correctly',
            details: {
              main_cache: {
                size: stats.size,
                hit_rate: stats.hitRate.toFixed(2) + '%',
                memory_usage: Math.round(stats.memoryUsage / 1024) + ' KB'
              },
              api_cache: {
                size: apiStats.size,
                hit_rate: apiStats.hitRate.toFixed(2) + '%',
                memory_usage: Math.round(apiStats.memoryUsage / 1024) + ' KB'
              }
            }
          };
        } else {
          return {
            status: 'degraded' as const,
            message: 'Cache operations are not working correctly',
            details: { test_failed: true }
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: 'Cache system error',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    });
  }

  private static async checkRateLimiter(useCache: boolean): Promise<HealthCheck> {
    return this.runCheck('rate_limiter', useCache, async () => {
      try {
        // Test rate limiter
        const testId = `health_check_${Date.now()}`;
        const result = rateLimiter.checkRateLimit(testId, 'user');
        rateLimiter.resetUserLimit(testId);
        
        if (result.allowed !== undefined) {
          const stats = rateLimiter.getStats();
          
          return {
            status: 'healthy' as const,
            message: 'Rate limiter is functioning correctly',
            details: {
              active_users: stats.activeUsers,
              total_tracked: stats.totalUsers,
              memory_usage: Math.round(stats.memoryUsage / 1024) + ' KB'
            }
          };
        } else {
          return {
            status: 'degraded' as const,
            message: 'Rate limiter test failed',
            details: { test_result: result }
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: 'Rate limiter error',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    });
  }

  private static async checkMemory(useCache: boolean): Promise<HealthCheck> {
    return this.runCheck('memory', useCache, async () => {
      try {
        const usage = process.memoryUsage();
        const totalMB = Math.round(usage.rss / 1024 / 1024);
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
        
        let status: 'healthy' | 'degraded' | 'unhealthy';
        let message: string;
        
        if (totalMB > 1000) { // Over 1GB
          status = 'unhealthy';
          message = 'High memory usage detected';
        } else if (totalMB > 500) { // Over 500MB
          status = 'degraded';
          message = 'Elevated memory usage';
        } else {
          status = 'healthy';
          message = 'Memory usage is normal';
        }
        
        return {
          status,
          message,
          details: {
            rss: totalMB + ' MB',
            heap_used: heapUsedMB + ' MB',
            heap_total: heapTotalMB + ' MB',
            external: Math.round(usage.external / 1024 / 1024) + ' MB'
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: 'Memory check failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    });
  }

  // Helper method to run checks with caching and error handling
  private static async runCheck(
    name: string, 
    useCache: boolean, 
    checkFn: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string; details?: any }>
  ): Promise<HealthCheck> {
    const startTime = Date.now();
    
    // Check cache first
    if (useCache) {
      const cached = this.checkCache.get(name);
      if (cached && cached.expiry > Date.now()) {
        return cached.result;
      }
    }
    
    try {
      const result = await checkFn();
      const responseTime = Date.now() - startTime;
      
      const healthCheck: HealthCheck = {
        name,
        status: result.status,
        responseTime,
        message: result.message,
        details: result.details,
        lastCheck: Date.now()
      };
      
      // Cache the result for 30 seconds
      this.checkCache.set(name, {
        result: healthCheck,
        expiry: Date.now() + 30000
      });
      
      return healthCheck;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name,
        status: 'unhealthy',
        responseTime,
        message: 'Health check threw an error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: Date.now()
      };
    }
  }

  // Helper to extract check result from Promise.allSettled
  private static getCheckResult(result: PromiseSettledResult<HealthCheck>, name: string): HealthCheck {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        name,
        status: 'unhealthy',
        responseTime: 0,
        message: 'Health check failed to execute',
        details: { error: result.reason },
        lastCheck: Date.now()
      };
    }
  }

  // Quick health check (cached, faster)
  static async quickHealthCheck(): Promise<{ status: string; timestamp: number }> {
    if (this.lastHealthCheck && (Date.now() - this.lastHealthCheck.timestamp) < 60000) {
      return {
        status: this.lastHealthCheck.status,
        timestamp: this.lastHealthCheck.timestamp
      };
    }
    
    const health = await this.checkHealth(true);
    return {
      status: health.status,
      timestamp: health.timestamp
    };
  }

  // Get error statistics
  static getErrorStats(): any {
    return ErrorHandler.getErrorStats();
  }

  // Reset health check cache
  static resetCache(): void {
    this.checkCache.clear();
    this.lastHealthCheck = null;
  }
}
