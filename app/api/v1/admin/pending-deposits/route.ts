import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { query } from '@/lib/database/db';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN']);

    const res = await query(`
      SELECT 
        t.id,
        t.reference_no,
        t.amount_paise,
        t.status,
        t.description,
        t.created_at,
        t.destination_account_id,
        a.account_number,
        a.account_type,
        a.balance_paise,
        p.full_name as requester_name,
        p.email as requester_email
      FROM transactions t
      JOIN accounts a ON t.destination_account_id = a.id
      JOIN profiles p ON t.created_by = p.id
      WHERE t.type = 'DEPOSIT' AND t.status = 'PENDING'
      ORDER BY t.created_at DESC;
    `);

    const deposits = res.rows.map(row => ({
      id: row.id,
      reference_number: row.reference_no,
      amount_paise: Number(row.amount_paise),
      status: row.status,
      description: row.description,
      created_at: row.created_at,
      destination_account_id: row.destination_account_id,
      account_number: row.account_number,
      account_type: row.account_type,
      current_balance_paise: Number(row.balance_paise),
      requester_name: row.requester_name,
      requester_email: row.requester_email
    }));

    return apiSuccess({ pending_deposits: deposits, count: deposits.length }, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 500;
    return apiError(error.message || 'Failed to fetch pending deposits', status);
  }
}

