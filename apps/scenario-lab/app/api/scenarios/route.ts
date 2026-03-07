import { NextRequest, NextResponse } from 'next/server';
import { createScenario, listScenarios, deleteScenario } from '@/lib/store';

export async function GET() {
  const scenarios = listScenarios();
  return NextResponse.json(scenarios);
}

export async function POST(req: NextRequest) {
  const config = await req.json();
  const scenario = createScenario(config);
  return NextResponse.json(scenario, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteScenario(id);
  return NextResponse.json({ ok: true });
}
