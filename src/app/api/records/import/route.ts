import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/server-auth';
import { getIntegrationClient } from '@/lib/integration-app-client';
import { Record } from '@/models/record';
import { connectToDatabase } from '@/lib/mongodb';
import { RecordActionKey } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const actionKey = searchParams.get('action') as RecordActionKey;

    if (!actionKey) {
      return NextResponse.json(
        { error: 'Action key is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const client = await getIntegrationClient(auth);
    const connectionsResponse = await client.connections.find();
    const firstConnection = connectionsResponse.items?.[0];

    if (!firstConnection) {
      return NextResponse.json({ success: false, error: 'No connection found' });
    }

    let allRecords = [];
    let hasMoreRecords = true;
    let currentCursor = null;

    // Keep fetching while there are more records
    while (hasMoreRecords) {
      console.log(`Fetching records with cursor: ${currentCursor}`);
      
      const result = await client
        .connection(firstConnection.id)
        .action(actionKey)
        .run(currentCursor ? { cursor: currentCursor } : null);

      const records = result.output.records || [];
      allRecords = [...allRecords, ...records];

      // Save batch to MongoDB
      if (records.length > 0) {
        const recordsToSave = records.map(record => ({
          ...record,
          customerId: auth.customerId,
          recordType: actionKey,
        }));

        await Promise.all(recordsToSave.map(record => 
          Record.updateOne(
            { id: record.id, customerId: auth.customerId },
            record,
            { upsert: true }
          )
        ));

        console.log(`Saved ${records.length} records to MongoDB`);
      }

      // Check if there are more records to fetch
      currentCursor = result.output.cursor;
      hasMoreRecords = !!currentCursor;

      if (hasMoreRecords) {
        console.log('More records available, continuing to next page...');
      }
    }

    console.log(`Import completed. Total records: ${allRecords.length}`);

    return NextResponse.json({ 
      success: true,
      recordsCount: allRecords.length 
    });
  } catch (error) {
    console.error('Error in import:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 