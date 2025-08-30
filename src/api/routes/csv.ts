import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../middleware';
import { CSVController } from '../controllers/CSVController';

const csvController = new CSVController();

export const POST = withMiddleware(
  async (request: NextRequest) => {
    const body = await request.json();
    const { operation, csvData } = body;

    if (!operation || !csvData) {
      return NextResponse.json(
        { error: 'Operation and csvData are required' },
        { status: 400 }
      );
    }

    const csvResponse = await csvController.processCSV(operation, csvData);
    return NextResponse.json(csvResponse);
  },
  {
    rateLinearit: {
      maxRequests: 10,
      windowMs: 60 * 1000
    },
    validateInput: true,
    rbac: {
      allowedRoles: ['power_user', 'manager']
    },
    timeout: 30000
  }
);

export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation');
    const action = searchParams.get('action');

    if (action === 'template' && operation) {
      const csvTemplate = await csvController.getCSVTemplate(operation);
      return new NextResponse(csvTemplate, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${operation}_template.csv"`
        }
      });
    }

    const csvInfo = await csvController.getCSVInfo();
    return NextResponse.json(csvInfo);
  },
  {
    rateLinearit: {
      maxRequests: 100,
      windowMs: 60 * 1000
    }
  }
);
