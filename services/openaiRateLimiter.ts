import OpenAI from 'openai';

// ============================================================================
// RATE LIMITING & RETRY SYSTEM
// ============================================================================

interface RateLimiter {
  queue: Array<() => Promise<any>>;
  running: number;
  maxConcurrent: number;
  minDelay: number;
  lastCallTime: number;
}

const rateLimiter: RateLimiter = {
  queue: [],
  running: 0,
  maxConcurrent: 2, // Max 2 concurrent requests
  minDelay: 1000, // Minimum 1 second between requests
  lastCallTime: 0,
};

async function executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    rateLimiter.queue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    processQueue();
  });
}

async function processQueue() {
  if (rateLimiter.running >= rateLimiter.maxConcurrent) {
    return;
  }

  if (rateLimiter.queue.length === 0) {
    return;
  }

  const now = Date.now();
  const timeSinceLastCall = now - rateLimiter.lastCallTime;
  const delayNeeded = Math.max(0, rateLimiter.minDelay - timeSinceLastCall);

  if (delayNeeded > 0) {
    setTimeout(() => processQueue(), delayNeeded);
    return;
  }

  rateLimiter.running++;
  rateLimiter.lastCallTime = Date.now();

  const task = rateLimiter.queue.shift();
  if (!task) {
    rateLimiter.running--;
    return;
  }

  task()
    .finally(() => {
      rateLimiter.running--;
      processQueue();
    });
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      const isRateLimit = error?.status === 429 || 
                         error?.code === 'rate_limit_exceeded' ||
                         error?.message?.includes('429') ||
                         error?.message?.toLowerCase().includes('rate limit') ||
                         error?.message?.toLowerCase().includes('quota') ||
                         error?.message?.toLowerCase().includes('exceeded');
      
      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff: baseDelay * 2^attempt
      // For 429 errors, use longer delays
      const delay = isRateLimit 
        ? baseDelay * Math.pow(2, attempt) * (attempt + 1) // Extra multiplier for 429
        : baseDelay * Math.pow(2, attempt);
      
      // Cap max delay at 60 seconds
      const cappedDelay = Math.min(delay, 60000);
      
      console.warn(`⚠️ Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${cappedDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, cappedDelay));
    }
  }
  
  throw lastError;
}

export async function callOpenAI<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  return executeWithRateLimit(() => retryWithBackoff(apiCall));
}

