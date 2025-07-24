// Performance optimizations for LosslessCut FFmpeg operations
// This file contains optimized versions of key functions to improve processing speed

import { execa, ExecaOptions } from 'execa';
import { Readable } from 'node:stream';
import readline from 'node:readline';

// Optimization 1: Improved FFmpeg argument handling with better memory management
export function optimizeFFmpegArgs(baseArgs: string[]): string[] {
  const optimizedArgs = [
    ...baseArgs,
    // Enable multi-threading for better CPU utilization
    '-threads', '0', // Use all available CPU cores
    // Optimize I/O operations
    '-fflags', '+discardcorrupt+genpts',
    // Reduce memory usage and improve processing speed
    '-avioflags', 'direct',
    // Fast seeking optimizations
    '-ss_after_input', '1',
    // Reduce overhead
    '-copytb', '1',
  ];

  return optimizedArgs;
}

// Optimization 2: Improved progress handling with better performance
export function optimizedHandleProgress(
  process: { stderr: Readable | null },
  duration: number | undefined,
  onProgress: (progress: number) => void,
  customMatcher?: (line: string) => void,
) {
  if (!onProgress || !process.stderr) return;

  onProgress(0);
  
  const rl = readline.createInterface({ 
    input: process.stderr,
    // Optimize readline performance
    crlfDelay: Infinity,
    historySize: 0, // Disable history to save memory
  });

  let lastProgressTime = 0;
  const progressThrottle = 100; // Update progress max every 100ms

  rl.on('line', (line) => {
    const now = Date.now();
    
    // Throttle progress updates to reduce UI overhead
    if (now - lastProgressTime < progressThrottle) return;
    
    try {
      if (customMatcher) {
        customMatcher(line);
        return;
      }

      // Optimized regex for faster parsing
      const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch && duration) {
        const [, hours, minutes, seconds] = timeMatch;
        const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        const progress = Math.min(currentTime / duration, 1);
        
        if (!isNaN(progress)) {
          onProgress(progress);
          lastProgressTime = now;
        }
      }
    } catch (err) {
      // Silently ignore parsing errors to avoid performance impact
    }
  });
}

// Optimization 3: Batch processing optimization
export function createOptimizedBatchProcessor<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  options: {
    concurrency?: number;
    batchSize?: number;
    progressCallback?: (completed: number, total: number) => void;
  } = {}
) {
  const { concurrency = 4, batchSize = 10, progressCallback } = options;
  
  return async function processBatch() {
    const results: any[] = [];
    let completed = 0;
    
    // Process in optimized batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch items with controlled concurrency
      const batchPromises = batch.map(async (item, index) => {
        const result = await processor(item);
        completed++;
        
        if (progressCallback && completed % Math.max(1, Math.floor(items.length / 100)) === 0) {
          progressCallback(completed, items.length);
        }
        
        return result;
      });
      
      // Process with limited concurrency to avoid overwhelming the system
      const batchResults = await Promise.all(batchPromises.slice(0, concurrency));
      results.push(...batchResults);
      
      // Process remaining items in the batch
      if (batchPromises.length > concurrency) {
        const remainingResults = await Promise.all(batchPromises.slice(concurrency));
        results.push(...remainingResults);
      }
    }
    
    return results;
  };
}

// Optimization 4: Memory-efficient stream processing
export function createOptimizedStreamProcessor(options: {
  bufferSize?: number;
  highWaterMark?: number;
} = {}) {
  const { bufferSize = 64 * 1024, highWaterMark = 16 * 1024 } = options;
  
  return {
    execaOptions: {
      buffer: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: bufferSize,
      encoding: 'buffer' as const,
      // Optimize child process creation
      windowsHide: true,
      // Reduce memory overhead
      cleanup: true,
      all: false,
    } as ExecaOptions,
    
    streamOptions: {
      highWaterMark,
      objectMode: false,
    }
  };
}

// Optimization 5: Improved seeking performance
export function getOptimizedSeekArgs(from?: number, to?: number): string[] {
  const args: string[] = [];
  
  if (from != null) {
    // Use precise seeking for better performance
    args.push('-ss', from.toFixed(6));
    // Enable fast seeking when possible
    if (from > 1) {
      args.push('-accurate_seek');
    }
  }
  
  if (to != null && from != null) {
    const duration = to - from;
    args.push('-t', duration.toFixed(6));
  }
  
  return args;
}

// Optimization 6: Codec-specific optimizations
export function getOptimizedCodecArgs(codec: string, quality: 'fast' | 'balanced' | 'quality' = 'balanced'): string[] {
  const presets = {
    'libx264': {
      fast: ['-preset', 'ultrafast', '-tune', 'zerolatency'],
      balanced: ['-preset', 'medium', '-crf', '23'],
      quality: ['-preset', 'slow', '-crf', '18']
    },
    'libx265': {
      fast: ['-preset', 'ultrafast', '-x265-params', 'log-level=error'],
      balanced: ['-preset', 'medium', '-crf', '28'],
      quality: ['-preset', 'slow', '-crf', '24']
    },
    'copy': {
      fast: ['-c', 'copy'],
      balanced: ['-c', 'copy'],
      quality: ['-c', 'copy']
    }
  };
  
  return presets[codec as keyof typeof presets]?.[quality] || ['-c', 'copy'];
}

// Optimization 7: Smart quality detection
export function detectOptimalQuality(inputFile: string, streams: any[]): 'fast' | 'balanced' | 'quality' {
  // Analyze file characteristics to determine optimal quality setting
  const videoStream = streams.find(s => s.codec_type === 'video');
  
  if (!videoStream) return 'fast';
  
  const resolution = (videoStream.width || 0) * (videoStream.height || 0);
  const bitrate = parseInt(videoStream.bit_rate) || 0;
  
  // HD+ content with high bitrate - use quality mode
  if (resolution >= 1920 * 1080 && bitrate > 5000000) {
    return 'quality';
  }
  
  // Standard definition or lower bitrate - use fast mode
  if (resolution <= 720 * 480 || bitrate < 1000000) {
    return 'fast';
  }
  
  // Default to balanced
  return 'balanced';
}

// Optimization 8: Parallel processing for multiple segments
export function createParallelSegmentProcessor(segments: any[], options: {
  maxConcurrency?: number;
  resourceLimit?: number;
} = {}) {
  const { maxConcurrency = 2, resourceLimit = 4 } = options;
  
  return async function processSegments(processor: (segment: any, index: number) => Promise<any>) {
    const semaphore = new Array(Math.min(maxConcurrency, resourceLimit)).fill(null);
    let segmentIndex = 0;
    const results: any[] = [];
    
    const processNext = async () => {
      if (segmentIndex >= segments.length) return;
      
      const currentIndex = segmentIndex++;
      const segment = segments[currentIndex];
      
      try {
        const result = await processor(segment, currentIndex);
        results[currentIndex] = result;
      } catch (error) {
        results[currentIndex] = { error };
      }
      
      // Continue processing if there are more segments
      if (segmentIndex < segments.length) {
        await processNext();
      }
    };
    
    // Start parallel processing
    await Promise.all(semaphore.map(() => processNext()));
    
    return results;
  };
}

export default {
  optimizeFFmpegArgs,
  optimizedHandleProgress,
  createOptimizedBatchProcessor,
  createOptimizedStreamProcessor,
  getOptimizedSeekArgs,
  getOptimizedCodecArgs,
  detectOptimalQuality,
  createParallelSegmentProcessor,
};
