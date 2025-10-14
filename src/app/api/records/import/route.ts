import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/server-auth";
import { getIntegrationClient } from "@/lib/integration-app-client";
import { Record, IRecord } from "@/models/record";
import { connectToDatabase } from "@/lib/mongodb";
import { RecordActionKey, RECORD_ACTIONS } from "@/lib/constants";

export async function GET(request: NextRequest) {
	try {
		const auth = getAuthFromRequest(request);
		if (!auth.customerId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const searchParams = request.nextUrl.searchParams;
		const actionKey = searchParams.get("action") as RecordActionKey;
		const instanceKey = searchParams.get("instanceKey");
		const integrationKey = searchParams.get("integrationKey");

		if (!actionKey) {
			return NextResponse.json(
				{ error: "Action key is required" },
				{ status: 400 }
			);
		}

		// Get default form types from RECORD_ACTIONS
		const defaultFormTypes = RECORD_ACTIONS.filter(
			(action) => action.type === "default"
		).map((action) => action.key.replace("get-", ""));

		// Extract the form ID from the action key
		const formId = actionKey?.startsWith("get-")
			? actionKey.substring(4)
			: null;
		const isCustomForm = formId && !defaultFormTypes.includes(formId);

		// For custom forms, instanceKey is required
		if (isCustomForm && !instanceKey) {
			return NextResponse.json(
				{ error: "Instance key is required for custom forms" },
				{ status: 400 }
			);
		}

		await connectToDatabase();
		const client = await getIntegrationClient(auth);
		const connectionsResponse = await client.connections.find();

		// Use specific integration if provided, otherwise use first available
		let targetConnection = connectionsResponse.items?.[0];
		if (integrationKey) {
			const foundConnection = connectionsResponse.items?.find(
				(conn) => conn.integration?.key === integrationKey
			);
			if (foundConnection) {
				targetConnection = foundConnection;
			}
		}

		console.log("Integration key parameter:", integrationKey);
		console.log("Target connection:", targetConnection?.integration?.key);
		console.log(
			"Available connections:",
			connectionsResponse.items?.map((c) => c.integration?.key)
		);

		if (!targetConnection) {
			return NextResponse.json({
				success: false,
				error: integrationKey
					? `No connection found for integration: ${integrationKey}`
					: "No connection found",
			});
		}

		let allRecords: IRecord[] = [];
		let hasMoreRecords = true;
		let currentCursor = null;
		let newRecordsCount = 0;
		let existingRecordsCount = 0;

		// Keep fetching while there are more records
		while (hasMoreRecords) {
			console.log(`Fetching records with cursor: ${currentCursor}`);

			try {
				// Use the correct syntax for running the action
				const result = await client
					.connection(targetConnection.id)
					.action(actionKey, {
						instanceKey: instanceKey || undefined,
					})
					.run({ cursor: currentCursor });

				console.log("API result structure:", JSON.stringify(result, null, 2));

				// Handle different response structures
				let records = [];
				if (result.output && (result.output as any).records) {
					records = (result.output as any).records;
				} else if ((result as any).records) {
					records = (result as any).records;
				} else if (Array.isArray(result)) {
					records = result;
				} else {
					console.log("Unexpected result structure:", result);
					records = [];
				}

				allRecords = [...allRecords, ...records];
			} catch (actionError) {
				console.error("Error running action:", actionError);
				// If the action fails, try to get records using a different approach
				try {
					console.log("Trying alternative approach...");
					const dataSourceKey =
						actionKey === "get-objects"
							? instanceKey || ""
							: actionKey.replace("get-", "");
					if (!dataSourceKey) {
						throw new Error(
							"No data source key available for alternative approach"
						);
					}

					const alternativeResult: any = await (
						client
							.connection(targetConnection.id)
							.dataSource(dataSourceKey) as any
					).list({ cursor: currentCursor });

					console.log(
						"Alternative result:",
						JSON.stringify(alternativeResult, null, 2)
					);

					let records = [];
					if (alternativeResult.output && alternativeResult.output.records) {
						records = alternativeResult.output.records;
					} else if (alternativeResult.records) {
						records = alternativeResult.records;
					} else if (Array.isArray(alternativeResult)) {
						records = alternativeResult;
					}

					allRecords = [...allRecords, ...records];
					currentCursor =
						alternativeResult.output?.cursor || alternativeResult.cursor;
					hasMoreRecords = !!currentCursor;
					continue;
				} catch (alternativeError) {
					console.error("Alternative approach also failed:", alternativeError);
					throw actionError; // Re-throw the original error
				}
			}

			// Debug: Log the structure of the first record to understand the data format
			if (allRecords.length > 0 && allRecords.length <= 10) {
				console.log(
					"Sample record structure:",
					JSON.stringify(allRecords[allRecords.length - 1], null, 2)
				);
			}

			// Save batch to MongoDB with duplicate checking
			if (allRecords.length > 0) {
				const finalIntegrationKey =
					integrationKey || targetConnection.integration?.key || "unknown";
				console.log("Final integration key being used:", finalIntegrationKey);

				if (!finalIntegrationKey || finalIntegrationKey === "unknown") {
					console.error(
						"No integration key available! This will cause filtering issues."
					);
				}

				const recordsToSave = allRecords.map((record: IRecord) => ({
					...record,
					// Ensure name field exists - use id as fallback if name is missing
					name: record.name || record.id || "Unnamed Record",
					customerId: auth.customerId,
					recordType: isCustomForm ? instanceKey : actionKey,
					integrationKey: finalIntegrationKey,
				}));

				console.log(
					"Sample record to save:",
					JSON.stringify(recordsToSave[0], null, 2)
				);

				// Check for existing records and only save new ones
				for (const record of recordsToSave) {
					const existingRecord = await Record.findOne({
						id: record.id,
						customerId: auth.customerId,
						recordType: record.recordType,
					});

					if (existingRecord) {
						existingRecordsCount++;
						console.log(`Record ${record.id} already exists, skipping...`);
					} else {
						console.log(
							`Creating record with integrationKey:`,
							record.integrationKey
						);
						// Ensure integrationKey is explicitly set
						const recordToSave = {
							...record,
							integrationKey: record.integrationKey || null,
						};

						console.log(
							"Record to save before MongoDB create:",
							JSON.stringify(recordToSave, null, 2)
						);

						// Try using new Record() constructor instead of create()
						const newRecord = new Record(recordToSave);
						const savedRecord = await newRecord.save();
						newRecordsCount++;
						console.log(
							`Saved new record ${record.id} to MongoDB with _id:`,
							savedRecord._id
						);
						console.log(
							`Saved record integrationKey:`,
							savedRecord.integrationKey
						);
					}
				}

				console.log(
					`Processed ${allRecords.length} records: ${newRecordsCount} new, ${existingRecordsCount} existing`
				);
			}

			// Check if there are more records to fetch
			// This will be handled in the next iteration or break the loop
			hasMoreRecords = false; // For now, let's process all records in one batch
		}

		console.log(
			`Import completed. Total records processed: ${allRecords.length}, New: ${newRecordsCount}, Existing: ${existingRecordsCount}`
		);

		return NextResponse.json({
			success: true,
			recordsCount: allRecords.length,
			newRecordsCount,
			existingRecordsCount,
		});
	} catch (error) {
		console.error("Error in import:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
