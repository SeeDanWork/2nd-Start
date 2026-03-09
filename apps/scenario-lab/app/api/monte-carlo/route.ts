import { NextRequest, NextResponse } from 'next/server';
import { runMonteCarlo, sweepGuardrail, generateRegressionTests } from '@/lib/monte-carlo';
import { MonteCarloConfig, DEFAULT_MONTE_CARLO_CONFIG } from '@/lib/monte-carlo/types';

// Store results in memory (persist across HMR)
const globalForMC = globalThis as unknown as {
  __mcResults?: Map<string, unknown>;
};
const results = globalForMC.__mcResults ??= new Map<string, unknown>();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  if (action === 'run') {
    const config: MonteCarloConfig = {
      ...DEFAULT_MONTE_CARLO_CONFIG,
      ...body.config,
    };

    // Cap runs to prevent browser timeout
    config.runs = Math.min(config.runs, 10000);

    const summary = runMonteCarlo(config);
    const regressionTests = generateRegressionTests(summary);

    results.set(summary.simulation_id, { summary, regressionTests });

    return NextResponse.json({
      summary,
      regression_tests: regressionTests,
    });
  }

  if (action === 'sweep') {
    const { parameter, values, config } = body;
    if (!parameter || !values?.length) {
      return NextResponse.json({ error: 'parameter and values required' }, { status: 400 });
    }

    const baseConfig: MonteCarloConfig = {
      ...DEFAULT_MONTE_CARLO_CONFIG,
      ...config,
    };

    const calibration = sweepGuardrail(parameter, values, baseConfig);
    return NextResponse.json({ calibration });
  }

  if (action === 'list') {
    const ids = [...results.keys()];
    return NextResponse.json({ simulations: ids });
  }

  if (action === 'get') {
    const result = results.get(body.simulation_id);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
