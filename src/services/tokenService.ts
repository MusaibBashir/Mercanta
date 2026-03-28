import { supabase } from "../lib/supabaseClient";

export interface TokenCreateParams {
  sale_id: string;
  business_account_id: string;
  customer_name?: string;
  order_items?: string;
  notes?: string;
  is_restaurant_order: boolean;
}

export interface TokenStatusUpdate {
  token_id: string;
  new_status: 'ordered' | 'confirmed' | 'preparing' | 'prepared' | 'ready' | 'served' | 'cancelled';
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a new order token
 */
export async function createOrderToken(params: TokenCreateParams) {
  try {
    const { data, error } = await supabase!.rpc('create_order_token', {
      p_sale_id: params.sale_id,
      p_business_account_id: params.business_account_id,
      p_notes: params.notes
    });

    if (error) throw error;

    return {
      success: true,
      data: data?.[0] || null,
      tokenNumber: data?.[0]?.token_number
    };
  } catch (error) {
    console.error('Error creating order token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create token'
    };
  }
}

/**
 * Update token status
 */
export async function updateTokenStatus(params: TokenStatusUpdate) {
  try {
    const { data, error } = await supabase!.rpc('update_token_status', {
      p_token_id: params.token_id,
      p_new_status: params.new_status,
      p_reason: params.reason,
      p_metadata: params.metadata
    });

    if (error) throw error;

    return {
      success: true,
      data: data?.[0] || null
    };
  } catch (error) {
    console.error('Error updating token status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update token status'
    };
  }
}

/**
 * Get all active tokens for a business
 */
export async function getActiveTokens(businessAccountId: string) {
  try {
    const { data, error } = await supabase!.rpc('get_active_tokens', {
      p_business_account_id: businessAccountId
    });

    if (error) throw error;

    return {
      success: true,
      data: data || [],
      count: data?.length || 0
    };
  } catch (error) {
    console.error('Error fetching active tokens:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch tokens'
    };
  }
}

/**
 * Get unpaid but ready tokens
 */
export async function getReadyUnpaidTokens(businessAccountId: string) {
  try {
    const { data, error } = await supabase!.rpc('get_ready_unpaid_tokens', {
      p_business_account_id: businessAccountId
    });

    if (error) throw error;

    return {
      success: true,
      data: data || [],
      totalAmount: data?.reduce((sum: number, token: any) => sum + token.total_amount, 0) || 0
    };
  } catch (error) {
    console.error('Error fetching ready unpaid tokens:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch unpaid tokens'
    };
  }
}

/**
 * Get token status history
 */
export async function getTokenHistory(tokenId: string) {
  try {
    const { data, error } = await supabase!
      .from('token_status_history')
      .select('*')
      .eq('token_id', tokenId)
      .order('changed_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error fetching token history:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch history'
    };
  }
}

/**
 * Get KDS settings for business
 */
export async function getKDSSettings(businessAccountId: string) {
  try {
    const { data, error } = await supabase!
      .from('kds_settings')
      .select('*')
      .eq('business_account_id', businessAccountId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return {
      success: true,
      data: data || null
    };
  } catch (error) {
    console.error('Error fetching KDS settings:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch KDS settings'
    };
  }
}

/**
 * Subscribe to token updates for real-time KDS
 */
export function subscribeToTokenUpdates(
  businessAccountId: string,
  onUpdate: (payload: any) => void
) {
  const channel = supabase!
    .channel(`tokens:${businessAccountId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_tokens',
        filter: `business_account_id=eq.${businessAccountId}`
      },
      onUpdate
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

/**
 * Subscribe to token status history updates
 */
export function subscribeToTokenStatusUpdates(
  businessAccountId: string,
  onUpdate: (payload: any) => void
) {
  const channel = supabase!
    .channel(`token_status:${businessAccountId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_tokens',
        filter: `business_account_id=eq.${businessAccountId}`
      },
      onUpdate
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

/**
 * Batch create tokens from multiple sales
 */
export async function createTokensBatch(
  salesIds: string[],
  businessAccountId: string,
  notes?: string
) {
  try {
    const results = await Promise.all(
      salesIds.map(saleId =>
        createOrderToken({
          sale_id: saleId,
          business_account_id: businessAccountId,
          notes,
          is_restaurant_order: true
        })
      )
    );

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      success: failed.length === 0,
      created: successful.length,
      failed: failed.length,
      data: successful.map(r => r.data)
    };
  } catch (error) {
    console.error('Error batch creating tokens:', error);
    return {
      success: false,
      created: 0,
      failed: salesIds.length,
      error: error instanceof Error ? error.message : 'Failed to create tokens'
    };
  }
}

/**
 * Get queue position for token
 */
export async function getTokenQueuePosition(tokenId: string) {
  try {
    const { data, error } = await supabase!
      .from('token_queue_status')
      .select('queue_position, estimated_ready_time, estimated_minutes')
      .eq('token_id', tokenId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return {
      success: true,
      data: data || null
    };
  } catch (error) {
    console.error('Error fetching queue position:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch queue position'
    };
  }
}

/**
 * Update token queue position
 */
export async function updateTokenQueuePosition(
  tokenId: string,
  queuePosition: number,
  estimatedMinutes: number
) {
  try {
    const estimatedTime = new Date();
    estimatedTime.setMinutes(estimatedTime.getMinutes() + estimatedMinutes);

    const { data, error } = await supabase!
      .from('token_queue_status')
      .upsert({
        token_id: tokenId,
        queue_position: queuePosition,
        estimated_minutes: estimatedMinutes,
        estimated_ready_time: estimatedTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error updating queue position:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update queue position'
    };
  }
}

/**
 * Print token receipt
 */
export function printTokenReceipt(
  tokenNumber: number,
  customerName: string,
  orderItems: string,
  totalAmount: number,
  notes?: string
) {
  const printWindow = window.open('', '', 'width=400,height=600');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: monospace; margin: 0; padding: 10px; }
        .receipt { max-width: 250px; margin: 0 auto; }
        .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
        .token-number { font-size: 48px; text-align: center; font-weight: bold; margin: 20px 0; }
        .divider { text-align: center; margin: 10px 0; }
        .section { margin: 10px 0; }
        .label { font-weight: bold; }
        .items { white-space: pre-wrap; margin: 10px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        @media print {
          body { margin: 0; padding: 5mm; }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">ORDER TICKET</div>
        
        <div class="token-number">#${tokenNumber}</div>
        
        <div class="divider">-----------------------</div>
        
        <div class="section">
          <div class="label">Customer:</div>
          <div>${customerName || 'Guest'}</div>
        </div>
        
        <div class="divider">-----------------------</div>
        
        <div class="section">
          <div class="label">Order:</div>
          <div class="items">${orderItems}</div>
        </div>
        
        ${notes ? `
        <div class="divider">-----------------------</div>
        <div class="section">
          <div class="label">Special Instructions:</div>
          <div>${notes}</div>
        </div>
        ` : ''}
        
        <div class="divider">-----------------------</div>
        
        <div class="section">
          <div class="label">Total:</div>
          <div>₹${totalAmount.toFixed(2)}</div>
        </div>
        
        <div class="footer">
          <p>${new Date().toLocaleString()}</p>
          <p>Thank you!</p>
        </div>
      </div>
      
      <script>
        window.print();
        window.onafterprint = function() {
          window.close();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHTML);
  printWindow.document.close();
}
