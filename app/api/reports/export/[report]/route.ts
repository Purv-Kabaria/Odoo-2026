import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { rowsToCsv } from '@/lib/reports/csv';
import {
  getAssetActivity,
  getAuditorPerformance,
  getAuditTrend,
  getDepartmentSummary,
  getMaintenanceOutlook,
  getSpendByCategory,
} from '@/lib/reports/queries';
import { authorizeReportRequest } from '@/lib/reports/route-helpers';
import { ASSET_STATUS_LABELS } from '@/lib/reports/status-colors';
import { REPORT_EXPORT_KEYS } from '@/types/reports-types';
import type { AssetStatus } from '@prisma/client';

const ReportParamSchema = z.object({ report: z.enum(REPORT_EXPORT_KEYS) });

const ASSET_STATUS_COLUMNS = Object.keys(ASSET_STATUS_LABELS) as AssetStatus[];

/** Every export shares the same auth/filter path as the JSON endpoints —
 * this route only differs in how it serializes the result, so it reuses
 * the exact query functions those routes call rather than duplicating
 * aggregation logic. */
export async function GET(
  req: Request,
  props: { params: Promise<{ report: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const params = await props.params;
    const paramValidation = ReportParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json(
        { error: { message: 'Unknown report', code: 'BAD_REQUEST' } },
        { status: 400 },
      );
    }

    const authResult = await authorizeReportRequest(req);
    if ('error' in authResult) return authResult.error;

    const { report } = paramValidation.data;
    const { filters } = authResult;

    let csv: string;

    switch (report) {
      case 'department-summary': {
        const rows = await getDepartmentSummary(filters);
        const columns = ['departmentId', 'departmentName', ...ASSET_STATUS_COLUMNS];
        csv = rowsToCsv(
          columns,
          rows.map((row) => ({
            departmentId: row.departmentId,
            departmentName: row.departmentName,
            ...row.counts,
          })),
        );
        break;
      }
      case 'audit-trend': {
        const rows = await getAuditTrend(filters);
        csv = rowsToCsv(['month', 'missing', 'damaged'], rows);
        break;
      }
      case 'asset-activity-most-audited': {
        const { mostAudited } = await getAssetActivity(filters);
        csv = rowsToCsv(
          ['assetTag', 'name', 'category', 'location', 'department', 'auditTouches'],
          mostAudited.map((row) => ({
            assetTag: row.assetTag,
            name: row.name,
            category: row.category,
            location: row.location,
            department: row.department?.name ?? '',
            auditTouches: row.auditTouches,
          })),
        );
        break;
      }
      case 'asset-activity-idle': {
        const { idle } = await getAssetActivity(filters);
        csv = rowsToCsv(
          ['assetTag', 'name', 'category', 'location', 'department', 'updatedAt'],
          idle.map((row) => ({
            assetTag: row.assetTag,
            name: row.name,
            category: row.category,
            location: row.location,
            department: row.department?.name ?? '',
            updatedAt: row.updatedAt,
          })),
        );
        break;
      }
      case 'maintenance-outlook-retirement': {
        const { nearingRetirement } = await getMaintenanceOutlook(filters);
        csv = rowsToCsv(
          ['assetTag', 'name', 'category', 'department', 'acquisitionDate'],
          nearingRetirement.map((row) => ({
            assetTag: row.assetTag,
            name: row.name,
            category: row.category,
            department: row.department?.name ?? '',
            acquisitionDate: row.acquisitionDate,
          })),
        );
        break;
      }
      case 'maintenance-outlook-flagged': {
        const { flaggedDamaged } = await getMaintenanceOutlook(filters);
        csv = rowsToCsv(
          ['assetTag', 'name', 'category', 'department', 'flaggedAt', 'note'],
          flaggedDamaged.map((row) => ({
            assetTag: row.assetTag,
            name: row.name,
            category: row.category,
            department: row.department?.name ?? '',
            flaggedAt: row.flaggedAt,
            note: row.note,
          })),
        );
        break;
      }
      case 'spend-by-category': {
        const rows = await getSpendByCategory(filters);
        csv = rowsToCsv(['category', 'totalCostCents', 'assetCount'], rows);
        break;
      }
      case 'auditor-performance': {
        const rows = await getAuditorPerformance(filters);
        csv = rowsToCsv(
          ['name', 'email', 'verified', 'missing', 'damaged', 'totalItems', 'passRate'],
          rows,
        );
        break;
      }
    }

    logger.info('reports.export', { requestId, report, userId: authResult.user.id });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${report}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('reports.export.failed', error, { requestId });
    return NextResponse.json(
      { error: { message: 'Failed to export report', code: 'INTERNAL_ERROR' } },
      { status: 500 },
    );
  }
}
