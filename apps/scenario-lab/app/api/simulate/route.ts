// ── Simulate API Route ───────────────────────────────────────
// Thin HTTP adapter. All logic lives in the orchestrator layer.

import { NextRequest, NextResponse } from 'next/server';
import { orchestrate, ActionType } from '@/lib/conversation/orchestrator';

export async function POST(req: NextRequest) {
  const { scenarioId, phone, action, body } = await req.json();

  const result = await orchestrate({
    scenarioId,
    phone,
    action: action as ActionType,
    body,
  });

  return NextResponse.json(result.data, { status: result.status });
}
