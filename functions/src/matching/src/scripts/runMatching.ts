import 'dotenv/config';
import { MatchingService } from '../services/matchingService.js';
import { generateSummaryReport, exportMatchesToCSV, formatMatch } from '../services/postProcessing.js';
import { logger } from '../utils/logger.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { MatchingConfig } from '../types/matching.types.js';

function parseArgs(): {
  frqWeight: number;
  quantWeight: number;
  outputDir: string;
  showTop: number;
} {
  const args = process.argv.slice(2);
  let frqWeight = 0.7;
  let quantWeight = 0.3;
  let outputDir = './matching-results';
  let showTop = 10;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--frq-weight':
        if (i + 1 < args.length) {
          frqWeight = parseFloat(args[++i]);
          if (isNaN(frqWeight) || frqWeight < 0 || frqWeight > 1) {
            logger.error(`Invalid frq-weight: ${args[i]}. Must be between 0 and 1`);
            process.exit(1);
          }
        }
        break;

      case '--quant-weight':
        if (i + 1 < args.length) {
          quantWeight = parseFloat(args[++i]);
          if (isNaN(quantWeight) || quantWeight < 0 || quantWeight > 1) {
            logger.error(`Invalid quant-weight: ${args[i]}. Must be between 0 and 1`);
            process.exit(1);
          }
        }
        break;

      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          outputDir = args[++i];
        }
        break;

      case '--show-top':
        if (i + 1 < args.length) {
          showTop = parseInt(args[++i], 10);
          if (isNaN(showTop) || showTop < 0) {
            logger.error(`Invalid show-top: ${args[i]}. Must be a positive number`);
            process.exit(1);
          }
        }
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  if (args.includes('--frq-weight') && !args.includes('--quant-weight')) {
    quantWeight = 1 - frqWeight;
  } else if (args.includes('--quant-weight') && !args.includes('--frq-weight')) {
    frqWeight = 1 - quantWeight;
  }

  return { frqWeight, quantWeight, outputDir, showTop };
}

function printHelp(): void {
  console.log(`
Tea @ 3 Matching Algorithm - CLI

Usage:
  npm run match [options]

Options:
  --frq-weight <number>       Weight for free-response similarity (default: 0.7)
  --quant-weight <number>     Weight for quantifiable scores (default: 0.3)
  -o, --output <dir>          Output directory (default: ./matching-results)
  --show-top <number>         Number of top matches to display (default: 10)
  -h, --help                  Show this help

Examples:
  npm run match
  npm run match -- --frq-weight 0.5 --quant-weight 0.5
  npm run match -- --output ./results --show-top 20

Notes:
  - Uses Hungarian algorithm (optimal matching)
  - Weights must sum to 1.0
  - Results saved as CSV, JSON, and summary text
  `);
}

async function main(): Promise<void> {
  try {
    logger.info('Tea @ 3 Matching Algorithm');
    logger.info('='.repeat(60));

    // Validate environment
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }

    const { frqWeight, quantWeight, outputDir, showTop } = parseArgs();

    const config: Partial<MatchingConfig> = { frqWeight, quantWeight };

    const service = new MatchingService(config);
    const result = await service.runMatching();
    console.log('\n');
    console.log(generateSummaryReport(result.matches, result.statistics, result.config));

    // Display top matches
    if (showTop > 0 && result.matches.length > 0) {
      console.log(`Top ${Math.min(showTop, result.matches.length)} Matches:`);
      console.log('='.repeat(60));
      result.matches.slice(0, showTop).forEach((match) => {
        console.log(formatMatch(match));
        console.log('');
      });
    }

    // Save results to files
    logger.info(`Saving results to ${outputDir}...`);

    // Create output directory if it doesn't exist
    const fs = await import('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate timestamp for filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // Save CSV
    const csvPath = join(outputDir, `matches-${timestamp}.csv`);
    const csv = exportMatchesToCSV(result.matches);
    writeFileSync(csvPath, csv, 'utf-8');
    logger.info(`✓ Saved CSV: ${csvPath}`);

    // Save JSON
    const jsonPath = join(outputDir, `matches-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
    logger.info(`✓ Saved JSON: ${jsonPath}`);

    // Save summary report
    const reportPath = join(outputDir, `summary-${timestamp}.txt`);
    const report = generateSummaryReport(result.matches, result.statistics, result.config);
    writeFileSync(reportPath, report, 'utf-8');
    logger.info(`✓ Saved summary: ${reportPath}`);

    logger.info('\n' + '='.repeat(60));
    logger.info('MATCHING COMPLETE');
    logger.info('='.repeat(60));

    process.exit(0);

  } catch (error) {
    logger.error('Fatal error:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }

    process.exit(1);
  }
}

// Run main function
main();
