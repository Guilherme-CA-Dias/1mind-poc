import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/server-auth";
import { Record } from "@/models/record";
import { connectToDatabase } from "@/lib/mongodb";
import { RecordActionKey } from "@/lib/constants";

export async function GET(request: NextRequest) {
	try {
		console.log("Starting GET request for records...");

		const auth = getAuthFromRequest(request);
		if (!auth.customerId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const searchParams = request.nextUrl.searchParams;
		const action = searchParams.get("action") as RecordActionKey;
		const instanceKey = searchParams.get("instanceKey");
		const cursor = searchParams.get("cursor");
		const search = searchParams.get("search");
		const integrationKey = searchParams.get("integrationKey");

		if (!action) {
			return NextResponse.json(
				{ error: "Action is required" },
				{ status: 400 }
			);
		}

		// For get-objects action, instanceKey is required
		if (action === "get-objects" && !instanceKey) {
			return NextResponse.json(
				{ error: "Instance key is required for get-objects action" },
				{ status: 400 }
			);
		}

		// Connect to MongoDB and fetch records
		await connectToDatabase();

		// Build the query
		const query: any = {
			customerId: auth.customerId,
			recordType: action === "get-objects" ? instanceKey : action,
		};

		// Add integration filter if provided
		if (integrationKey) {
			query.integrationKey = integrationKey;
		}

		// Add search conditions if search query exists
		if (search) {
			const searchRegex = new RegExp(search, "i");
			query.$or = [
				{ id: searchRegex },
				{ name: searchRegex },
				{ "fields.industry": searchRegex },
				{ "fields.domain": searchRegex },
			];
		}

		// Query MongoDB with pagination
		const pageSize = 100;
		const records = await Record.find(query)
			.sort({ _id: 1 })
			.skip(cursor ? parseInt(cursor) : 0)
			.limit(pageSize + 1)
			.lean();

		// Check if there are more records
		const hasMore = records.length > pageSize;
		const resultsToReturn = hasMore ? records.slice(0, -1) : records;
		const nextCursor = hasMore
			? (cursor ? parseInt(cursor) : 0) + pageSize
			: null;

		return NextResponse.json({
			records: resultsToReturn,
			cursor: nextCursor?.toString(),
		});
	} catch (error) {
		console.error("Error fetching records from MongoDB:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
